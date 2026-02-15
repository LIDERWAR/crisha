from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework import status
from django.conf import settings
from .services import extract_text_from_pdf, analyze_contract_with_ai
import logging

logger = logging.getLogger(__name__)

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
            # 1. Extract Text
            # Note: We pass the uploaded file directly to PyMuPDF. Django's InMemoryUploadedFile behaves like a file.
            # But PyMuPDF needs bytes or stream. If file is large, it might be on disk.
            # Let's read it into memory for simplicity (MVP).
            
            # Reset file pointer just in case
            if hasattr(file_obj, 'seek'):
                file_obj.seek(0)
                
            text = extract_text_from_pdf(file_obj)
            
            if not text:
                 return Response({"error": "Failed to extract text. File might be empty or encrypted."}, status=status.HTTP_422_UNPROCESSABLE_ENTITY)
            
            # 2. Analyze
            analysis_result = analyze_contract_with_ai(text)
            
            return Response(analysis_result, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"Analysis error: {e}")
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
