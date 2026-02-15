import os
from google.adk.agents import Agent
from ..utils import embed_text

# We'll need a way to run DB queries.
# For now, let's assume we can import database functions or use a direct connection.
# Ideally, this should use the CRUD methods or similar.
from ..database import SessionLocal
from sqlalchemy import text


def search_projects_tool(query: str):
    """
    Searches for projects matching the query using semantic search.
    """
    try:
        embedding = embed_text(query)
        if not embedding:
            return "Could not generate embedding for query."

        # This is a synchronous wrapper around what might be async logic depending on the app structure
        # but for ADK tools, synchronous return is often expected unless configured otherwise.

        db = SessionLocal()
        try:
            # Postgres pgvector syntax
            embedding_str = str(embedding)
            sql = text(
                "SELECT id, title, summary, 1 - (embedding <=> :embedding) as score FROM projects ORDER BY embedding <=> :embedding LIMIT 5"
            )
            result = db.execute(sql, {"embedding": embedding_str}).fetchall()

            projects = []
            for row in result:
                projects.append(
                    f"Title: {row.title}\nSummary: {row.summary}\nScore: {row.score:.2f}"
                )

            return "\n\n".join(projects) if projects else "No matching projects found."
        finally:
            db.close()
    except Exception as e:
        return f"Search failed: {str(e)}"


def create_search_agent():
    return Agent(
        model=os.getenv("GEMINI_MODEL", "gemini-2.5-flash"),
        name="search_agent",
        instruction="You are a search specialist. Your goal is to find projects relevant to the user's query.",
        tools=[search_projects_tool],
    )
