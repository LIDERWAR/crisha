
import os
import openai

# Configure API key
api_key = "pza_8jn0OSAF0rVZxerN8rkVyKFSlZA04RWi"
base_url = "https://api.polza.ai/api/v1"

client = openai.OpenAI(
    api_key=api_key,
    base_url=base_url
)

print(f"Testing DeepSeek on {base_url}...")

model = "deepseek/deepseek-chat"

print(f"\n--- Testing {model} ---")
try:
    response = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "user", "content": "Hello! Are you working?"}
        ]
    )
    print(f"SUCCESS! Response: {response.choices[0].message.content}")
except Exception as e:
    print(f"Error: {e}")
