import os
import httpx
import base64
from groq import Groq

# PASTE YOUR KEY HERE FOR TESTING
API_KEY = os.environ.get("GROQ_API_KEY", "REPLACE_WITH_YOUR_KEY_HERE") 

# A simple 1x1 white pixel gif
IMAGE_B64 = "R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw=="

http_client = httpx.Client(verify=False)
client = Groq(api_key=API_KEY, http_client=http_client)

models_to_test = [
    "meta-llama/llama-4-scout-17b-16e-instruct",
    "meta-llama/llama-4-maverick-17b-128e-instruct",
    "qwen/qwen3-32b",
    "openai/gpt-oss-120b"
]

for model in models_to_test:
    print(f"\n--- Testing Vision: {model} ---")
    try:
        chat_completion = client.chat.completions.create(
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": "Describe this image."},
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/gif;base64,{IMAGE_B64}"
                            },
                        },
                    ],
                }
            ],
            model=model,
        )
        print(f"✅ SUCCESS: {model} supports vision!")
        print(chat_completion.choices[0].message.content)
    except Exception as e:
        print(f"❌ FAILURE: {model} - {str(e)}")
