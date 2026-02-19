
import os
import openai

# Configure API key
api_key = "pza_8jn0OSAF0rVZxerN8rkVyKFSlZA04RWi"
base_url = "https://polza.ai/api/v1"

client = openai.OpenAI(
    api_key=api_key,
    base_url=base_url
)

models_to_test = [
    "deepseek/deepseek-chat",
    "deepseek/deepseek-r1",
    "openai/gpt-4o-mini"
]

print(f"Testing models at {base_url}...")

for model_name in models_to_test:
    print(f"\n--- Testing {model_name} ---")
    try:
        response = client.chat.completions.create(
            model=model_name,
            messages=[
                {"role": "user", "content": "Hello, are you working?"}
            ]
        )
        print(f"Success! Response: {response.choices[0].message.content}")
    except Exception as e:
        print(f"Error with {model_name}: {e}")
