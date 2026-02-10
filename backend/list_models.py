#!/usr/bin/env python3
"""
List available Gemini models for this API key
"""
import os
from dotenv import load_dotenv
import google.generativeai as genai

# Load .env
env_path = os.path.join(os.path.dirname(__file__), ".env")
load_dotenv(dotenv_path=env_path)

api_key = os.getenv("GOOGLE_API_KEY")
print(f"🔑 Using API Key: {api_key[:20]}...")

try:
    genai.configure(api_key=api_key)
    print("✅ Configured Gemini\n")
    
    # List available models
    print("📋 Available models:")
    for model in genai.list_models():
        if 'generateContent' in model.supported_generation_methods:
            print(f"  ✅ {model.name}")
            
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
