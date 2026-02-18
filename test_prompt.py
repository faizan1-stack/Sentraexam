
import google.generativeai as genai
import os
import json

genai.configure(api_key=os.environ.get("GEMINI_API_KEY"))

model = genai.GenerativeModel("gemini-flash-latest")

print("Sending test prompt...")
try:
    response = model.generate_content("Say 'Hello' in JSON format: {'greeting': 'Hello'}")
    print("Response received:")
    print(response.text)
except Exception as e:
    print(f"Error: {e}")
