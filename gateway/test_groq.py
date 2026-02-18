import os
import httpx
from groq import Groq

# PASTE YOUR KEY HERE FOR TESTING
API_KEY = os.environ.get("GROQ_API_KEY", "REPLACE_WITH_YOUR_KEY_HERE") 

print(f"Testing connectivity with key: {API_KEY[:4]}...{API_KEY[-4:]}")

print("\n--- Running Final Diagnostic Test ---")
print("Model: meta-llama/llama-4-scout-17b-16e-instruct")
print("SSL Verification: DISABLED")

try:
    # This combines the fixes: disabled SSL and correct vision model
    http_client = httpx.Client(verify=False)
    client_insecure = Groq(api_key=API_KEY, http_client=http_client)
    
    chat_completion = client_insecure.chat.completions.create(
        messages=[{"role": "user", "content": "Say 'Vision Model Connection Successful'"}],
        model="meta-llama/llama-4-scout-17b-16e-instruct",
    )
    print("\n✅ SUCCESS!")
    print(chat_completion.choices[0].message.content)
    print("\nThis confirms the connection works. The main app should now function correctly.")
except Exception as e:
    print("\n❌ FAILURE")
    print(f"Error details: {e}")


