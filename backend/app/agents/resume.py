import os
from google.adk.agents import Agent
# For this simplified version, let's assume it can parse text or a mock "parse my resume" command
# that triggers looking up the latest uploaded resume.


def parse_resume_tool(user_id: int):
    """
    Parses the user's uploaded resume and returns the extracted skills and info.
    """
    # Check if the user has a resume uploaded
    # For now, we'll return a placeholder message, but in a real app query User model
    if not user_id:
        return "I need to know who you are to parse your resume. Please log in."

    # Mock check
    return f"I've analyzed the resume for user {user_id}. It highlights skills in Python and specific expertise in AI agents."


def create_resume_agent():
    return Agent(
        model=os.getenv("GEMINI_MODEL", "gemini-2.5-flash"),
        name="resume_agent",
        instruction="You are a resume expert. You extract structured data from resumes.",
        tools=[parse_resume_tool],  # We can refine this tool later
    )
