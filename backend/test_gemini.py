#!/usr/bin/env python3
"""
Simple test script to verify Gemini API is working
"""
import os
from dotenv import load_dotenv
import google.generativeai as genai

# Load .env
env_path = os.path.join(os.path.dirname(__file__), ".env")
print(f"📄 Loading .env from: {env_path}")
load_dotenv(dotenv_path=env_path)

# Get API key
api_key = os.getenv("GOOGLE_API_KEY")
print(f"🔑 API Key found: {'Yes' if api_key else 'No'}")
if api_key:
    print(f"🔑 API Key (first 20 chars): {api_key[:20]}...")
    print(f"🔑 API Key length: {len(api_key)}")

# Try to initialize
print("\n🤖 Attempting to initialize Gemini...")
try:
    genai.configure(api_key=api_key)
    print("✅ genai.configure() successful")
    
    model = genai.GenerativeModel("gemini-2.5-flash")  # Using the correct model
    print("✅ Model (gemini-2.5-flash) created successfully")
    
    # Test with simple prompt
    print("\n🧪 Testing with simple prompt...")
    test_text = """Ceramide
Mochi Toner
CONTAINS CERAMIDE 5,000 ppb
NOURISHING AND MOISTURIZING MULTI-USE
TONER FOR BOUNCY, MOCHI-LIKE SKIN"""
    
    prompt = f"""Extract product name and brand from this product label text:

{test_text}

Return as JSON with keys: product_name, brand"""
    
    print("📤 Sending request to Gemini...")
    response = model.generate_content(prompt)
    print("✅ Response received!")
    print(f"\nGemini Response:\n{response.text}")
    
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
