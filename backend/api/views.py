from rest_framework.views import APIView
import fitz # PyMuPDF
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework import status
from rest_framework import generics
from django.conf import settings
from .services import extract_text_from_pdf, analyze_contract_with_ai
from .models import Document
from .serializers import DocumentSerializer
import logging

logger = logging.getLogger(__name__)

from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.models import User
from rest_framework.permissions import AllowAny

from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from rest_framework.permissions import AllowAny
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
        return Response({"status": "ok", "message": "Crisha Backend is running"}, status=status.HTTP_200_OK)

class ContractAnalysisView(APIView):
    parser_classes = (MultiPartParser, FormParser)

    def post(self, request, *args, **kwargs):
        file_obj = request.FILES.get('file')
        
        if not file_obj:
            return Response({"error": "No file provided"}, status=status.HTTP_400_BAD_REQUEST)
        
        if not file_obj.name.endswith('.pdf'):
            return Response({"error": "Only PDF files are supported"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            print("--- STARTING DOCUMENT PROCESSING ---")
            
            # 1. Save Document first (to get ID and store file)
            user = request.user if request.user.is_authenticated else None
            try:
                document = Document.objects.create(file=file_obj, user=user)
                print(f"--- Document Created: ID {document.id} ---")
            except Exception as e:
                 logger.error(f"Error creating document: {e}")
                 print(f"!!! Error creating document: {e} !!!")
                 return Response({"error": f"Database error: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

            # 2. Extract Text
            try:
                print("--- Starting Text Extraction ---")
                # Open in binary mode
                with document.file.open('rb') as f:
                    file_content = f.read()
                    
                # Use fitz on bytes
                doc = fitz.open(stream=file_content, filetype="pdf")
                text = ""
                for page in doc:
                    text += page.get_text()
                doc.close() # Close fitz document
                print(f"--- Text Extracted: Length {len(text)} ---")
                
            except Exception as e:
                 logger.error(f"Text extraction error: {e}")
                 print(f"!!! Text extraction error: {e} !!!")
                 document.delete()
                 return Response({"error": f"PDF parse error: {str(e)}"}, status=status.HTTP_422_UNPROCESSABLE_ENTITY)
            
            if not text:
                 print("!!! No text extracted !!!")
                 document.delete() 
                 return Response({"error": "Failed to extract text. File might be empty or encrypted."}, status=status.HTTP_422_UNPROCESSABLE_ENTITY)
            
            # 3. Analyze
            try:
                print("--- Starting AI Analysis ---")
                analysis_result = analyze_contract_with_ai(text)
                print("--- AI Analysis Completed ---")
            except Exception as e:
                logger.error(f"AI error: {e}")
                print(f"!!! AI error: {e} !!!")
                document.delete()
                return Response({"error": f"AI service error: {str(e)}"}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
            
            if "error" in analysis_result:
                print(f"!!! AI Analysis returned error: {analysis_result} !!!")
                document.delete()
                return Response(analysis_result, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

            # 4. Update Document
            try:
                print("--- Saving Results ---")
                document.score = analysis_result.get('score')
                document.summary = analysis_result.get('summary')
                document.risks = analysis_result.get('risks')
                document.save()
                print("--- Results Saved ---")
            except Exception as e:
                logger.error(f"Saving results error: {e}")
                print(f"!!! Saving results error: {e} !!!")
                return Response({"error": "Failed to save analysis results"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

            # Return serialized data
            serializer = DocumentSerializer(document)
            return Response(serializer.data, status=status.HTTP_201_CREATED)

        except Exception as e:
            logger.error(f"Unexpected error in view: {e}")
            print(f"!!! Unexpected error in view: {e} !!!")
            import traceback
            traceback.print_exc()
            return Response({"error": f"Unexpected server error: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class DocumentListView(generics.ListAPIView):
    serializer_class = DocumentSerializer
    
    def get_queryset(self):
        user = self.request.user
        if user.is_authenticated:
            return Document.objects.filter(user=user).order_by('-uploaded_at')
        return Document.objects.none()

