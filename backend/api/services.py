import fitz  # PyMuPDF
import openai
import os
import json
from django.conf import settings
import docx
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage

# Инициализация клиента OpenAI (совместимый с DeepSeek)
client = openai.OpenAI(
    api_key=os.getenv("DEEPSEEK_API_KEY"),
    base_url="https://api.polza.ai/api/v1"
)

def extract_text_from_pdf(file_stream):
    """
    Извлекает текст из потока PDF-файла, используя PyMuPDF.
    """
    try:
        doc = fitz.open(stream=file_stream.read(), filetype="pdf")
        text = ""
        for page in doc:
            text += page.get_text()
        return text
    except Exception as e:
        print(f"Ошибка извлечения текста (PDF): {e}")
        return None

def extract_text_from_docx(file_stream):
    """
    Извлекает текст из .docx файла.
    """
    try:
        doc = docx.Document(file_stream)
        text = "\n".join([para.text for para in doc.paragraphs])
        return text
    except Exception as e:
        print(f"Ошибка извлечения текста (DOCX): {e}")
        return None

def extract_text_from_txt(file_stream):
    """
    Извлекает текст из .txt файла.
    """
    try:
        return file_stream.read().decode('utf-8')
    except Exception as e:
        print(f"Ошибка извлечения текста (TXT): {e}")
        return None

def analyze_contract_with_ai(contract_text):
    """
    Отправляет текст договора в DeepSeek для юридического анализа.
    Возвращает JSON с рисками, рекомендациями и УЛУЧШЕННЫМ текстом.
    """
    api_key = os.getenv("DEEPSEEK_API_KEY")
    use_mock = os.getenv("USE_MOCK_AI", "False").lower() == "true"
    
    # Проверка на заглушку
    if not api_key or api_key.startswith("sk-placeholder") or use_mock:
        print("--- ИСПОЛЬЗУЮ MOCK AI (Режим симуляции или нет ключа) ---")
        return {
            "score": 85,
            "summary": "Это тестовый анализ (Режим симуляции). Договор выглядит стандартным, но содержит несколько рисков.",
            "risks": [
                {"title": "Право одностороннего расторжения", "description": "Арендодатель может расторгнуть договор без суда с уведомлением за 30 дней.", "severity": "high"},
                {"title": "Индексация цены", "description": "Цена может быть увеличена в одностороннем порядке раз в год.", "severity": "medium"},
                {"title": "Штрафы за просрочку", "description": "Пеня составляет 1% от суммы за каждый день просрочки.", "severity": "low"}
            ],
            "recommendations": [
                {
                    "title": "Предложить протокол разногласий", 
                    "description": "Необходимо исключить право одностороннего расторжения. Это создает риск внезапного выселения.",
                    "clause_example": "Арендодатель имеет право расторгнуть договор только в судебном порядке при существенном нарушении условий Арендатором."
                },
                {
                    "title": "Снизить пеню", 
                    "description": "Пеня 1% в день - это 365% годовых. Это кабальная сделка. Нормальная практика - 0.1%.",
                    "clause_example": "За просрочку платежа Арендатор уплачивает пени в размере 0.1% от суммы задолженности за каждый день просрочки."
                }
            ],
            "rewritten_text": "ДОГОВОР АРЕНДЫ (УЛУЧШЕННЫЙ)\n\n1. Арендодатель имеет право расторгнуть договор только в судебном порядке...\n2. За просрочку платежа Арендатор уплачивает пени в размере 0.1%..."
        }

    if not contract_text or len(contract_text) < 50:
        return {"error": "Текст слишком короткий или пустой."}

    prompt = (
        "Ты профессиональный юрист. Проанализируй договор. "
        "Твоя задача: найти риски и ПЕРЕПИСАТЬ договор, устранив эти риски. "
        "\\n\\n"
        "Формат JSON: "
        "{"
        "  'score': (0-100), "
        "  'summary': '...', "
        "  'risks': [{'title': '...', 'description': '...', 'severity': '...'}], "
        "  'recommendations': [{'title': '...', 'description': '...', 'clause_example': '...'}], "
        "  'rewritten_text': 'ПОЛНЫЙ текст договора, в который уже внесены все изменения для максимальной защиты интересов клиента. Сохрани структуру, но исправь опасные пункты.' "
        "}"
        "\\n\\n"
        f"Текст договора:\\n{contract_text[:12000]}" 
    )

    try:
        print("--- Отправка запроса к DeepSeek ---")
        response = client.chat.completions.create(
            model="deepseek/deepseek-chat",
            messages=[
                {"role": "system", "content": "Output valid JSON only."},
                {"role": "user", "content": prompt}
            ],
            response_format={"type": "json_object"}
        )
        content = response.choices[0].message.content
        
        if content.startswith("```"):
            content = content.strip("`").replace("json\n", "").replace("json", "")
        
        result = json.loads(content)
        if 'score' in result: result['score'] = int(result['score'])
             
        return result
    except Exception as e:
        print(f"!!! Ошибка сервиса AI: {e} !!!")
        return {
            "score": 0,
            "summary": f"Ошибка AI: {str(e)}",
            "risks": [],
            "recommendations": []
        }

def save_improved_document(text, original_filename):
    """
    Сохраняет улучшенный текст в файл (.docx или .txt) и возвращает объект ContentFile.
    """
    filename_base = os.path.splitext(original_filename)[0]
    
    # Всегда стараемся сохранить как DOCX для удобства
    try:
        doc = docx.Document()
        for line in text.split('\n'):
            doc.add_paragraph(line)
        
        # Сохраняем во временный буфер или сразу в storage
        # Django FileField принимает ContentFile
        from io import BytesIO
        f = BytesIO()
        doc.save(f)
        f.seek(0)
        return ContentFile(f.read(), name=f"{filename_base}_improved.docx")
    except Exception as e:
        print(f"Ошибка создания DOCX: {e}. Сохраняем как TXT.")
        return ContentFile(text.encode('utf-8'), name=f"{filename_base}_improved.txt")
