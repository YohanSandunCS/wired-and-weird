import os
import httpx
from groq import Groq

# PASTE YOUR KEY HERE FOR TESTING
API_KEY = os.environ.get("GROQ_API_KEY", "REPLACE_WITH_YOUR_KEY_HERE") 

try:
    # This combines the fixes: disabled SSL
    http_client = httpx.Client(verify=False)
    client_insecure = Groq(api_key=API_KEY, http_client=http_client)
    
    models = client_insecure.models.list()
    print("Available Models:")
    for model in models.data:
        print(f"- {model.id}")
        
except Exception as e:
    print("\n❌ FAILURE")
    print(f"Error details: {e}")
