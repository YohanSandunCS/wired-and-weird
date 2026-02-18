import base64
import os
import io
import time
from typing import List, Dict, Any
from groq import Groq
import json
import httpx

# --- CONFIGURATION ---
# Replace this with your actual API key or set GROQ_API_KEY environment variable
GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "TODO_SET_YOUR_GROQ_API_KEY_HERE")
MODEL_ID = "meta-llama/llama-4-scout-17b-16e-instruct" 

def process_image(image_bytes: bytes, possible_words: List[str] = None) -> Dict[str, Any]:
    """
    Process image using Groq Vision API to detect sign text and directions.
    Params:
        image_bytes: Raw image data
        possible_words: List of known sign labels (e.g. ["DENTAL", "EMERGENCY"])
    Returns:
        Dict with 'detected' list and 'logs' list.
    """
    logs = []
    def log(msg):
        print(f"[AI-DEBUG] {msg}")
        logs.append(msg)

    client = None
    try:
        # Check if key is valid (not placeholder)
        if GROQ_API_KEY and "YOUR_GROQ_API_KEY" not in GROQ_API_KEY:
            # HACK: Bypass SSL verification for corporate/restricted networks
            http_client = httpx.Client(verify=False)
            client = Groq(api_key=GROQ_API_KEY, http_client=http_client)
            log("Groq client initialized with SSL verification DISABLED.")
        else:
            msg = "Warning: No valid API Key found. Set GROQ_API_KEY env var or update constant."
            log(msg)
            return {"detected": [], "logs": logs, "error": "API Key missing"}
            
    except Exception as e:
        log(f"Failed to initialize Groq client: {e}")
        return {"detected": [], "logs": logs, "error": str(e)}

    try:
        # Encode image to base64
        # Note: image_bytes is raw bytes (e.g. JPEG format).
        # We need to encode it to base64 string for the API.
        base64_image = base64.b64encode(image_bytes).decode('utf-8')
        log(f"Image encoded. Size: {len(image_bytes)} bytes")

        # Construct prompt
        vocab_context = ""
        if possible_words:
            w_str = ", ".join(possible_words)
            vocab_context = f"The text labels are likely to be from this list: [{w_str}]."

        prompt_text = f"""
        Act as a high-precision OCR and symbol detection system for a hospital robot.
        Analyze the provided image of a hospital directory sign (faster the better).

        CONSTRAINTS:
        1. Identification: Identify every text label (e.g., "DENTAL", "ICU").
        2. Vocab: {vocab_context}
        3. Symbol Location: Arrows are ALWAYS located immediately to the RIGHT of their corresponding text labels. Ignore marks to the left.
        4. Arrow Types: Possible directions are ONLY: "UP", "DOWN", "LEFT", "RIGHT".
        5. Visual Reasoning: Pay close attention to the arrowhead orientation (triangular tip) vs the tail.
        6. No Symbol: If a text label exists but there is no arrow next to it (empty space on the right), set direction to null.

        OUTPUT FORMAT:
        Return valid JSON only. 
        Before outputting 'detected', include an 'analysis_logs' field where you describe the visual evidence for each arrow (e.g., "For DENTAL, the triangular tip points right, tail points left").
        
        Format:
        {{
            "analysis_logs": ["evidence 1", "evidence 2"],
            "detected": [
                {{
                    "label": "EXACT_TEXT_FOUND",
                    "direction": "UP|DOWN|LEFT|RIGHT|null",
                    "confidence": 0.0-1.0
                }}
            ]
        }}
        """

        log("Sending request to Groq...")
        start_time = time.time()
        
        completion = client.chat.completions.create(
            model=MODEL_ID,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": prompt_text
                        },
                        {
                            "type": "image_url",
                            "image_url": {
                                "url": f"data:image/jpeg;base64,{base64_image}"
                            }
                        }
                    ]
                }
            ],
            temperature=0.0, 
            max_tokens=1024,
            response_format={"type": "json_object"}
        )
        
        duration = time.time() - start_time
        log(f"Groq API roundtrip time: {duration:.2f}s")

        response_content = completion.choices[0].message.content
        # log(f"Raw response: {response_content}")

        # Parse JSON
        data = json.loads(response_content)
        results = data.get("detected", [])
        ai_analysis = data.get("analysis_logs", [])

        if ai_analysis:
            for analysis in ai_analysis:
                log(f"AI Reasoning: {analysis}")
        
        log(f"Response received. Parsed {len(results)} items.")
        return {"detected": results, "logs": logs}

    except Exception as e:
        log(f"Groq API Error: {str(e)}")
        return {"detected": [], "logs": logs, "error": str(e)}
