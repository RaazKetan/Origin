import os
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()
genai.configure(api_key=(os.getenv("GEMINI_API_KEY") or "").strip())


def embed_text(text: str, task_type: str = "retrieval_document"):
    """
    Generate embedding for the given text using Gemini.
    Use task_type="retrieval_query" for search queries,
    and task_type="retrieval_document" for stored documents.
    """
    try:
        model = "gemini-embedding-001"
        return genai.embed_content(model=model, content=text, task_type=task_type)[
            "embedding"
        ]
    except Exception as e:
        print(f"Error generating embedding: {e}")
        return None
