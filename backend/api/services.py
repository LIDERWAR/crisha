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
    """
    if not contract_text or len(contract_text) < 50:
        return {"error": "Text is too short or empty. Likely a scan without OCR."}

    prompt = (
        "Ты профессиональный юрист по недвижимости РФ. "
        "Проанализируй этот текст договора аренды/купли-продажи. "
        "Твоя задача: найти скрытые риски, невыгодные условия и 'токсичные' пункты для клиента. "
        "Сфокусируйся на: праве одностороннего расторжения, штрафах, скрытых комиссиях, индексации цены. "
        "\n\n"
        "Формат ответа JSON: "
        "{"
        "  'score': (число 0-100, где 100 - безопасно), "
        "  'summary': 'Краткое резюме (1-2 предложения)', "
        "  'risks': [" 
        "    {'title': 'Название риска', 'description': 'Описание', 'severity': 'high/medium/low'}" 
        "  ], "
        "  'recommendations': ['Совет 1', 'Совет 2']"
        "}"
        "\n\n"
        f"Текст договора:\n{contract_text[:15000]}" # Limit text length for token safety
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
        return {"error": f"AI Analysis failed: {e}"}
