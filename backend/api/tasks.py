import os
import logging
from io import BytesIO
from celery import shared_task
from django.conf import settings
from .models import Document
from .services import (
    extract_text_from_pdf, 
    extract_text_from_docx, 
    extract_text_from_txt, 
    analyze_contract_with_ai, 
    save_improved_document, 
    convert_doc_to_docx
)

logger = logging.getLogger(__name__)

@shared_task
def analyze_document_task(document_id):
    try:
        document = Document.objects.get(id=document_id)
        print(f"--- [CELERY] Начало задачи для документа {document_id} ---")
        
        file_path = document.file.path
        file_ext = os.path.splitext(file_path)[1].lower()
        
        text = None
        
        # 1. Извлечение текста
        try:
            if file_ext == '.doc':
                print(f"--- [CELERY] Конвертация .doc для ID {document_id} ---")
                docx_path = convert_doc_to_docx(file_path)
                if docx_path and os.path.exists(docx_path):
                    with open(docx_path, "rb") as f_docx:
                        stream_docx = BytesIO(f_docx.read())
                        text = extract_text_from_docx(stream_docx)
                else:
                    raise Exception("Ошибка конвертации .doc")
            else:
                with open(file_path, 'rb') as f:
                    file_content = f.read()
                    stream = BytesIO(file_content)
                    
                    if file_ext == '.pdf':
                        text = extract_text_from_pdf(stream)
                    elif file_ext == '.docx':
                        text = extract_text_from_docx(stream)
                    elif file_ext == '.txt':
                        text = extract_text_from_txt(stream)
            
            if not text:
                raise Exception("Текст не извлечен")
                
            print(f"--- [CELERY] Текст извлечен для ID {document_id}: {len(text)} символов ---")

        except Exception as e:
            logger.error(f"[CELERY] Ошибка извлечения текста ID {document_id}: {e}")
            document.status = 'failed'
            document.summary = f"Ошибка извлечения текста: {str(e)}"
            document.save()
            return f"Failed: {str(e)}"

        # 2. AI Анализ
        try:
            print(f"--- [CELERY] Запуск AI для ID {document_id} ---")
            analysis_result = analyze_contract_with_ai(text)
            
            if "error" in analysis_result:
                raise Exception(analysis_result.get('error'))
            
            print(f"--- [CELERY] AI анализ завершен для ID {document_id} ---")

        except Exception as e:
            logger.error(f"[CELERY] Ошибка AI ID {document_id}: {e}")
            document.status = 'failed'
            document.summary = f"Ошибка AI анализа: {str(e)}"
            document.save()
            return f"Failed AI: {str(e)}"

        # 3. Сохранение результатов
        try:
            document.score = analysis_result.get('score')
            document.summary = analysis_result.get('summary')
            document.risks = analysis_result.get('risks')
            document.recommendations = analysis_result.get('recommendations')
            
            # Сохранение улучшенного файла
            rewritten_text = analysis_result.get('rewritten_text')
            if rewritten_text:
                improved_content_file = save_improved_document(rewritten_text, document.file.name)
                document.improved_file.save(improved_content_file.name, improved_content_file, save=False)
            
            document.status = 'processed'
            document.save()

            # 4. Обновление баланса пользователя (decrement only on success)
            if document.user:
                profile = document.user.profile
                profile.checks_remaining -= 1
                profile.total_checks_count += 1
                profile.save()
                print(f"--- [CELERY] Баланс пользователя {document.user.username} обновлен ---")

            print(f"--- [CELERY] Задача для ID {document_id} успешно завершена ---")
            return "Success"
            
        except Exception as e:
            logger.error(f"[CELERY] Ошибка сохранения ID {document_id}: {e}")
            document.status = 'failed'
            document.summary = "Ошибка сохранения результатов анализа."
            document.save()
            return f"Failed saving: {str(e)}"

    except Document.DoesNotExist:
        logger.error(f"[CELERY] Документ {document_id} не найден")
        return "Not Found"
    except Exception as e:
        logger.error(f"[CELERY] Непредвиденная ошибка задачи {document_id}: {e}")
        return f"Unexpected Error: {str(e)}"
