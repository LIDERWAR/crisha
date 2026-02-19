
import os
import openai
from django.conf import settings

# Configure API key
api_key = "pza_8jn0OSAF0rVZxerN8rkVyKFSlZA04RWi"
base_url = "https://api.polza.ai/api/v1"

client = openai.OpenAI(
    api_key=api_key,
    base_url=base_url
)

print(f"Checking models at {base_url}...")
try:
    models = client.models.list()
    print("Available models:")
    for model in models.data:
        print(f" - {model.id}")
        
    # Test a specific model if needed
    # test_model = "openai/gpt-3.5-turbo"
    # ...
    
except Exception as e:
    print(f"Error listing models: {e}")
