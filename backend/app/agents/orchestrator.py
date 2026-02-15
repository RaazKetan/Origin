import os
from google.adk.agents import Agent
from .search import search_projects_tool
from .resume import parse_resume_tool
from .jobs import find_jobs_tool
# We'll need to expose the GitHub capabilities too.
# Assuming github.py has tools defined or we can wrap them.
# For now, we'll focus on the requested 3 (+ github).


def create_orchestrator_agent(user_id: int):
    from functools import partial

    # Bind user_id to tools
    find_jobs_with_user = partial(find_jobs_tool, user_id=user_id)
    # Update docstring/name so the agent knows how to use it
    find_jobs_with_user.__name__ = "find_jobs_tool"
    find_jobs_with_user.__doc__ = (
        "Finds and recommends jobs for the current user based on their profile."
    )

    parse_resume_with_user = partial(parse_resume_tool, user_id=user_id)
    parse_resume_with_user.__name__ = "parse_resume_tool"
    parse_resume_with_user.__doc__ = (
        "Parses the current user's uploaded resume to extract skills and info."
    )

    return Agent(
        model=os.getenv("GEMINI_PRO_MODEL", "gemini-2.5-pro"),
        name="orchestrator",
        instruction="""
        You are the main intelligent assistant for the Conekt platform.
        Your goal is to help users with their career development and project discovery.
        
        You have access to the following specialized tools:
        - Search Projects: Use this when the user is looking for projects, ideas, or codebase examples.
        - Parse Resume: Use this when the user wants to analyze their resume or extract skills from it.
        - Find Jobs: Use this when the user is looking for job opportunities or career matching.
        
        RULES:
        1. If a user asks a general question, answer it directly using your knowledge.
        2. If a user asks about a specific domain covered by your tools, YOU MUST delegate to the appropriate tool.
        3. Do not make up information about the user's data (jobs, resume) without calling the tools.
        4. If a tool returns an error, apologize and explain what went wrong.
        5. Keep responses concise and helpful.
        
        ALWAYS be helpful, professional, and encouraging.
        """,
        tools=[search_projects_tool, parse_resume_with_user, find_jobs_with_user],
    )
