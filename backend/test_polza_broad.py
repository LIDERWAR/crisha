
import os
import openai
import time

# Configure API key
api_key = "pza_8jn0OSAF0rVZxerN8rkVyKFSlZA04RWi"
base_url = "https://api.polza.ai/api/v1"

client = openai.OpenAI(
    api_key=api_key,
    base_url=base_url
)

# List of models to try from different providers
models_to_test = [
    "openai/gpt-3.5-turbo",
    "openai/gpt-4o-mini",
    "qwen/qwen-2.5-72b-instruct",
    "anthropic/claude-3.5-sonnet",
    "google/gemini-2.5-flash"
]

print(f"Testing models at {base_url}...")

for model_name in models_to_test:
    print(f"\n--- Testing {model_name} ---")
    try:
        response = client.chat.completions.create(
            model=model_name,
            messages=[
                {"role": "user", "content": "Hi"}
            ]
        )
        print(f"SUCCESS! Response: {response.choices[0].message.content}")
        # If we found a working one, stop
        break
    except Exception as e:
        print(f"Error: {e}")
    
    time.sleep(1)
