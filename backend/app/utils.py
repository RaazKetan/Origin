"""Embedding wrapper. Returns None instead of raising so callers can no-op."""

from app.llm import embed


def embed_text(text: str, task_type: str = "RETRIEVAL_DOCUMENT"):
    """task_type='RETRIEVAL_QUERY' for search inputs, default for stored docs."""
    try:
        return embed(text, task_type=task_type.upper())
    except Exception as e:
        print(f"Error generating embedding: {e}")
        return None
