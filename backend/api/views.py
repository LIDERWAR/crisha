from rest_framework.views import APIView
import os
import hashlib
import logging
from rest_framework.response import Response
from django.http import HttpResponse
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework import status
from rest_framework import generics
from django.conf import settings
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
from .models import Document, Transaction, UserProfile
from .serializers import DocumentSerializer, UserSerializer
from .tasks import analyze_document_task

logger = logging.getLogger(__name__)

from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.authtoken.models import Token

class RegisterView(APIView):
    permission_classes = [AllowAny]
    def post(self, request):
        username = request.data.get('username') or request.data.get('email')
        password = request.data.get('password')
        email = request.data.get('email')
        
        if not username or not password:
             return Response({"error": "Username and password required"}, status=status.HTTP_400_BAD_REQUEST)
             
        if User.objects.filter(username=username).exists():
             return Response({"error": "User already exists"}, status=status.HTTP_400_BAD_REQUEST)
             
        user = User.objects.create_user(username=username, email=email, password=password)
        token, created = Token.objects.get_or_create(user=user)
        return Response({"status": "created", "token": token.key, "username": user.username, "email": user.email}, status=status.HTTP_201_CREATED)

class LoginView(APIView):
    permission_classes = [AllowAny]
    def post(self, request):
        username = request.data.get('username') or request.data.get('email')
        password = request.data.get('password')
        
        user = authenticate(request, username=username, password=password)
        if user is not None:
            token, created = Token.objects.get_or_create(user=user)
            return Response({"status": "ok", "token": token.key, "username": user.username, "email": user.email}, status=status.HTTP_200_OK)
        else:
            return Response({"error": "Invalid credentials"}, status=status.HTTP_401_UNAUTHORIZED)

class LogoutView(APIView):
    def post(self, request):
        logout(request)
        return Response({"status": "logged out"}, status=status.HTTP_200_OK)

class HealthCheckView(APIView):
    def get(self, request):
        return Response({"status": "ok", "message": "ContractCheck Backend is running"}, status=status.HTTP_200_OK)

@method_decorator(csrf_exempt, name='dispatch')
class ContractAnalysisView(APIView):
    parser_classes = (MultiPartParser, FormParser)

    def post(self, request, *args, **kwargs):
        file_obj = request.FILES.get('file')
        
        if not file_obj:
            return Response({"error": "No file provided"}, status=status.HTTP_400_BAD_REQUEST)
        
        # Valid extensions
        valid_extensions = ['.pdf', '.docx', '.doc', '.txt']
        file_ext = os.path.splitext(file_obj.name)[1].lower()
        if file_ext not in valid_extensions:
             return Response({"error": f"Unsupported file type. Supported: {', '.join(valid_extensions)}"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            # 0. Check limits if user is authenticated
            user = request.user if request.user.is_authenticated else None
            if user:
                # Use get_or_create to ensure profile exists
                profile, created = UserProfile.objects.get_or_create(user=user)
                if profile.checks_remaining <= 0:
                     return Response({
                         "error": "Limit reached", 
                         "details": "У вас закончились доступные проверки. Пожалуйста, обновите тариф."
                     }, status=status.HTTP_403_FORBIDDEN)
            
            # 1. Сначала сохраняем документ со статусом pending
            try:
                document = Document.objects.create(file=file_obj, user=user, status='pending')
                print(f"--- Document created: ID {document.id}. Triggering task. ---")
            except Exception as e:
                 logger.error(f"Error creating document: {e}")
                 return Response({"error": f"Database error: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

            # 2. Trigger asynchronous task
            analyze_document_task.delay(document.id)

            # Return serialized data immediately (202 Accepted would be more semantic, but 201 is fine)
            serializer = DocumentSerializer(document)
            return Response(serializer.data, status=status.HTTP_201_CREATED)

        except Exception as e:
            logger.error(f"Unexpected error in view: {e}")
            return Response({"error": f"Unexpected server error: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class DocumentListView(generics.ListAPIView):
    serializer_class = DocumentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.is_authenticated:
            return Document.objects.filter(user=user).order_by('-uploaded_at')
        return Document.objects.none()

class DocumentDetailView(generics.RetrieveDestroyAPIView):
    serializer_class = DocumentSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if user.is_authenticated:
            return Document.objects.filter(user=user)
        return Document.objects.none()

class UserInfoView(APIView):
    permission_classes = [IsAuthenticated]
    def get(self, request):
        # Ensure profile exists before serialization
        UserProfile.objects.get_or_create(user=request.user)
        serializer = UserSerializer(request.user)
        return Response(serializer.data)

class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        current_password = request.data.get("current_password")
        new_password = request.data.get("new_password")

        if not current_password or not new_password:
            return Response({"error": "Требуются старый и новый пароли"}, status=status.HTTP_400_BAD_REQUEST)

        user = request.user
        if not user.check_password(current_password):
            return Response({"error": "Неверный текущий пароль"}, status=status.HTTP_400_BAD_REQUEST)
        
        if len(new_password) < 8:
            return Response({"error": "Пароль должен быть не менее 8 символов"}, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(new_password)
        user.save()
        return Response({"status": "ok", "message": "Пароль успешно изменен"}, status=status.HTTP_200_OK)

# --- ROBOKASSA INTEGRATION ---

PLANS = {
    'pro': {'price': 990, 'checks': 20, 'name': 'PRO Plan'},
    'business': {'price': 4900, 'checks': 100, 'name': 'Business Plan'},
}

class CreatePaymentView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        plan_id = request.data.get('plan_id')
        if plan_id not in PLANS:
            return Response({"error": "Invalid plan"}, status=status.HTTP_400_BAD_REQUEST)

        plan = PLANS[plan_id]
        
        # 1. Create pending transaction
        transaction = Transaction.objects.create(
            user=request.user,
            amount=plan['price'],
            checks_count=plan['checks'],
            status='pending'
        )

        # 2. Prepare Robokassa parameters
        merchant_login = os.getenv('ROBOKASSA_MERCHANT_LOGIN')
        password_1 = os.getenv('ROBOKASSA_PASSWORD_1')
        inv_id = transaction.id
        out_sum = f"{plan['price']:.2f}"
        
        # Signature: MerchantLogin:OutSum:InvId:Password1
        signature_str = f"{merchant_login}:{out_sum}:{inv_id}:{password_1}"
        signature = hashlib.md5(signature_str.encode()).hexdigest()

        # 3. Generate URL
        is_test = os.getenv('ROBOKASSA_TEST_MODE', 'False').lower() == 'true'
        base_url = "https://auth.robokassa.ru/Merchant/Index.aspx"
        
        payment_url = (
            f"{base_url}?MerchantLogin={merchant_login}"
            f"&OutSum={out_sum}"
            f"&InvId={inv_id}"
            f"&Description=Top-up {plan['checks']} checks for {request.user.username}"
            f"&SignatureValue={signature}"
        )
        
        if is_test:
            payment_url += "&IsTest=1"

        return Response({"payment_url": payment_url})

@method_decorator(csrf_exempt, name='dispatch')
class PaymentWebhookView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        # Robokassa sends: OutSum, InvId, SignatureValue, and custom fields
        out_sum = request.data.get('OutSum')
        inv_id = request.data.get('InvId')
        signature_received = request.data.get('SignatureValue')
        
        password_2 = os.getenv('ROBOKASSA_PASSWORD_2')
        
        # Valid signature: OutSum:InvId:Password2
        signature_str = f"{out_sum}:{inv_id}:{password_2}"
        signature_calculated = hashlib.md5(signature_str.encode()).hexdigest()

        if not signature_received or signature_received.lower() != signature_calculated.lower():
            logger.error(f"Robokassa: Signature mismatch. Received: {signature_received}, Calculated: {signature_calculated}")
            return Response("fail", status=status.HTTP_400_BAD_REQUEST)

        try:
            transaction = Transaction.objects.get(id=inv_id)
            if transaction.status == 'pending':
                transaction.status = 'completed'
                transaction.save()

                # Credit user profile (ensure it exists)
                profile, created = UserProfile.objects.get_or_create(user=transaction.user)
                profile.checks_remaining += transaction.checks_count
                
                # Update tier if applicable
                if transaction.checks_count >= 100:
                    profile.subscription_tier = 'business'
                elif transaction.checks_count >= 20:
                    if profile.subscription_tier != 'business':
                        profile.subscription_tier = 'pro'
                
                profile.save()
                
                logger.info(f"Robokassa: Success. Credited {transaction.checks_count} checks to {transaction.user.username}")
            
            return HttpResponse(f"OK{inv_id}", status=200) # Robokassa expects plain OK + InvId
        except Transaction.DoesNotExist:
            logger.error(f"Robokassa: Transaction {inv_id} not found")
            return HttpResponse("fail", status=404)
