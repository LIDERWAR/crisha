import fitz  # PyMuPDF
import openai
import os
import json
from django.conf import settings

# Initialize OpenAI client
client = openai.OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

def extract_text_from_pdf(file_stream):
    """
    Extracts text from a PDF file stream using PyMuPDF.
    """
    try:
        doc = fitz.open(stream=file_stream.read(), filetype="pdf")
        text = ""
        for page in doc:
            text += page.get_text()
        return text
    except Exception as e:
        print(f"Error extracting text: {e}")
        return None

def analyze_contract_with_ai(contract_text):
    """
    Sends contract text to OpenAI for legal analysis.
    If API key is missing or invalid, returns a mock response for testing.
    """
    api_key = os.getenv("OPENAI_API_KEY")
    
    # Check for placeholder or missing key
    if not api_key or api_key.startswith("sk-placeholder"):
        print("--- USING MOCK AI RESPONSE (No API Key) ---")
        return {
            "score": 85,
            "summary": "Это тестовый анализ, так как API ключ OpenAI не настроен. Договор выглядит стандартным, но содержит несколько рисков, требующих внимания.",
            "risks": [
                {"title": "Право одностороннего расторжения", "description": "Арендодатель может расторгнуть договор без суда с уведомлением за 30 дней.", "severity": "high"},
                {"title": "Индексация цены", "description": "Цена может быть увеличена в одностороннем порядке раз в год.", "severity": "medium"},
                {"title": "Штрафы за просрочку", "description": "Пеня составляет 1% от суммы за каждый день просрочки (выше среднего).", "severity": "low"}
            ],
            "recommendations": ["Предложить протокол разногласий", "Снизить пеню до 0.1%"]
        }

    if not contract_text or len(contract_text) < 50:
        return {"error": "Text is too short or empty. Likely a scan without OCR."}

    prompt = (
        "Ты профессиональный юрист по недвижимости РФ. "
        "Проанализируй этот текст договора аренды/купли-продажи. "
        "Твоя задача: найти скрытые риски, невыгодные условия и 'токсичные' пункты для клиента. "
        "Сфокусируйся на: праве одностороннего расторжения, штрафах, скрытых комиссиях, индексации цены. "
        "\\n\\n"
        "Формат ответа JSON: "
        "{"
        "  'score': (число 0-100, где 100 - безопасно), "
        "  'summary': 'Краткое резюме (1-2 предложения)', "
        "  'risks': [" 
        "    {'title': 'Название риска', 'description': 'Описание', 'severity': 'high/medium/low'}" 
        "  ], "
        "  'recommendations': ['Совет 1', 'Совет 2']"
        "}"
        "\\n\\n"
        f"Текст договора:\\n{contract_text[:15000]}" # Limit text length for token safety
    )

    try:
        response = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": "You are a helpful legal assistant. Output valid JSON only."},
                {"role": "user", "content": prompt}
            ],
            response_format={"type": "json_object"}
        )
        content = response.choices[0].message.content
        return json.loads(content)
    except Exception as e:
        print(f"!!! AI Service Error: {e} !!!")
        # Fallback to mock on error too, to keep flow working
        return {
            "score": 0,
            "summary": f"Ошибка AI сервиса: {str(e)}. Проверьте API ключ.",
            "risks": [{"title": "Ошибка анализа", "description": str(e), "severity": "high"}],
            "recommendations": ["Проверить настройки сервера"]
        }
