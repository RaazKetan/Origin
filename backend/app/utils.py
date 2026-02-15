import os
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()
genai.configure(api_key=(os.getenv("GEMINI_API_KEY") or "").strip())


def embed_text(text: str):
    """
    Generate embedding for the given text using Gemini
    """
    try:
        model = "models/text-embedding-004"
        return genai.embed_content(
            model=model, content=text, task_type="retrieval_document"
        )["embedding"]
    except Exception as e:
        print(f"Error generating embedding: {e}")
        return None
