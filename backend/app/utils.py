from dotenv import load_dotenv

from .llm import embed

load_dotenv()


def embed_text(text: str, task_type: str = "RETRIEVAL_DOCUMENT"):
    """Generate embedding for the given text. Use task_type='RETRIEVAL_QUERY'
    for search queries, 'RETRIEVAL_DOCUMENT' for stored documents."""
    try:
        return embed(text, model="gemini-embedding-001", task_type=task_type.upper())
    except Exception as e:
        print(f"Error generating embedding: {e}")
        return None
