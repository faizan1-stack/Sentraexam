
import google.generativeai as genai
import os

api_key = os.environ.get("GEMINI_API_KEY")
print(f"Using API Key: {api_key[:5]}...{api_key[-3:]}")

genai.configure(api_key=api_key)

print("Listing available models:")
try:
    for m in genai.list_models():
        if 'generateContent' in m.supported_generation_methods:
            print(f"- {m.name}")
except Exception as e:
    print(f"Error listing models: {e}")
