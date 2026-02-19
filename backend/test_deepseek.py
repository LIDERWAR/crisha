
import os
import django
from django.conf import settings

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from api.services import analyze_contract_with_ai

print("Testing DeepSeek API with new key...")
sample_text = "Договор аренды жилого помещения. Арендодатель сдает, а Арендатор принимает..."
try:
    result = analyze_contract_with_ai(sample_text)
    print("API Result:", result)
    if "error" in result:
        print("API returned error:", result["error"])
    else:
        print("API success!")
except Exception as e:
    print("Exception during test:", e)
