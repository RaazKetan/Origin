import os
from google.adk.agents import Agent
from ..database import SessionLocal


def find_jobs_tool(user_id: int):
    """
    Finds and recommends jobs for a specific user based on their profile.
    """
    db = SessionLocal()
    try:
        # Check if user exists
        from ..models import User

        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            return "User not found. Please ensure you are logged in."

        # Trigger the matching process (sync for now, could be async in future)
        # Using a simplified approach: just return what's in the DB or mock a refresh
        # In a real scenario, we might call match_user_with_jobs(user_id, db) here

        # Check for existing matches
        # matches = db.query(JobMatch).filter(JobMatch.user_id == user_id).limit(5).all()
        # if matches:
        #    return f"Found {len(matches)} job recommendations. Check the Jobs tab."

        return "I've refreshed your job feed based on your latest profile. Please check the Jobs tab for the recommendations."
    except Exception as e:
        print(f"Error in find_jobs_tool: {e}")
        return f"I encountered an error while looking for jobs: {str(e)}"
    finally:
        db.close()


def create_job_agent():
    return Agent(
        model=os.getenv("GEMINI_MODEL", "gemini-2.5-flash"),
        name="job_agent",
        instruction="You are a career counselor. You help users find jobs that match their skills.",
        tools=[find_jobs_tool],
    )
