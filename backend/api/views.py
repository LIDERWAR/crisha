from rest_framework.views import APIView
import os
import fitz # PyMuPDF
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework import status
from rest_framework import generics
from django.conf import settings
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
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
            print("--- НАЧАЛО ОБРАБОТКИ ДОКУМЕНТА ---")
            
            # 1. Сначала сохраняем документ
            user = request.user if request.user.is_authenticated else None
            try:
                document = Document.objects.create(file=file_obj, user=user, status='pending')
                print(f"--- Документ создан: ID {document.id} ---")
            except Exception as e:
                 logger.error(f"Ошибка при создании документа: {e}")
                 print(f"!!! Ошибка при создании документа: {e} !!!")
                 return Response({"error": f"Ошибка базы данных: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

            # 2. Извлечение текста
            try:
                print(f"--- Начало извлечения текста ({file_ext}) ---")
                
                # В зависимости от расширения выбираем метод
                from .services import extract_text_from_pdf, extract_text_from_docx, extract_text_from_txt, analyze_contract_with_ai, save_improved_document
                
                text = None
                with document.file.open('rb') as f:
                    # Для python-docx нужен stream, но иногда file-like object. 
                    # fitz.open тоже принимает bytes или stream.
                    # Лучше прочитать в BytesIO для надежности
                    from io import BytesIO
                    file_content = f.read()
                    stream = BytesIO(file_content)

                    if file_ext == '.pdf':
                        text = extract_text_from_pdf(stream)
                    elif file_ext == '.docx':
                        text = extract_text_from_docx(stream)
                    elif file_ext == '.doc':
                         # .doc binary format is not supported by python-docx
                         return Response({"error": "Формат .doc (Word 97-2003) не поддерживается. Пожалуйста, сохраните файл как .docx"}, status=status.HTTP_400_BAD_REQUEST)
                    elif file_ext == '.txt':
                        text = extract_text_from_txt(stream)
                
                if text:
                    print(f"--- Текст извлечен: Длина {len(text)} ---")
                else:
                    print(f"!!! Текст не извлечен ({file_ext}) !!!")

            except Exception as e:
                 logger.error(f"Ошибка извлечения текста: {e}")
                 print(f"!!! Ошибка извлечения текста: {e} !!!")
                 document.status = 'failed'
                 document.summary = f"Ошибка извлечения текста: {str(e)}"
                 document.save()
                 serializer = DocumentSerializer(document)
                 return Response(serializer.data, status=status.HTTP_201_CREATED)
            
            if not text:
                 print("!!! Текст не извлечен !!!")
                 document.status = 'failed'
                 document.summary = "Не удалось извлечь текст. Файл может быть поврежден или не поддерживается."
                 document.save()
                 serializer = DocumentSerializer(document)
                 return Response(serializer.data, status=status.HTTP_201_CREATED)
            
            # 3. Анализ
            try:
                print("--- Запуск AI анализа ---")
                analysis_result = analyze_contract_with_ai(text)
                print("--- AI анализ завершен ---")
            except Exception as e:
                logger.error(f"Ошибка AI: {e}")
                print(f"!!! Ошибка AI: {e} !!!")
                document.status = 'failed'
                document.summary = f"Ошибка AI анализа: {str(e)}"
                document.save()
                serializer = DocumentSerializer(document)
                return Response(serializer.data, status=status.HTTP_201_CREATED)
            
            if "error" in analysis_result:
                print(f"!!! AI анализ вернул ошибку: {analysis_result} !!!")
                document.status = 'failed'
                document.summary = f"Ошибка AI: {analysis_result.get('error')}"
                document.save()
                serializer = DocumentSerializer(document)
                return Response(serializer.data, status=status.HTTP_201_CREATED)

            # 4. Обновление документа
            try:
                print("--- Сохранение результатов ---")
                document.status = 'processed'
                document.score = analysis_result.get('score')
                document.summary = analysis_result.get('summary')
                document.risks = analysis_result.get('risks')
                document.recommendations = analysis_result.get('recommendations')
                
                # Сохранение улучшенного файла
                rewritten_text = analysis_result.get('rewritten_text')
                if rewritten_text:
                    print("--- Сохранение улучшенного документа ---")
                    improved_content_file = save_improved_document(rewritten_text, document.file.name)
                    document.improved_file.save(improved_content_file.name, improved_content_file, save=False)
                
                document.save()

                print("--- Результаты сохранены ---")
            except Exception as e:
                logger.error(f"Ошибка сохранения результатов: {e}")
                print(f"!!! Ошибка сохранения результатов: {e} !!!")
                # Даже если сохранение деталей анализа не удалось, помечаем как ошибку
                try:
                    document.status = 'failed'
                    document.summary = "Ошибка сохранения результатов анализа."
                    document.save()
                except:
                    pass
                # Возвращаем 201 с тем, что есть
                serializer = DocumentSerializer(document)
                return Response(serializer.data, status=status.HTTP_201_CREATED)



            # Return serialized data
            serializer = DocumentSerializer(document)
            return Response(serializer.data, status=status.HTTP_201_CREATED)

        except Exception as e:
            logger.error(f"Unexpected error in view: {e}")
            print(f"!!! Непредвиденная ошибка в представлении: {e} !!!")
            import traceback
            traceback.print_exc()
            return Response({"error": f"Непредвиденная ошибка сервера: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

from rest_framework.permissions import IsAuthenticated

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
