from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from ..agents.orchestrator import create_orchestrator_agent
from .. import models, auth

# Depending on ADK version, we might need a runner or session management here.
# For simplicity, we'll instantiate and run the agent synchronously or via simple async wrapper if possible.
# Given the ADK usage elsewhere (Runner, Session), we should probably follow that pattern.
from google.adk import Runner
from google.adk.sessions import InMemorySessionService
import uuid
from types import SimpleNamespace

router = APIRouter(prefix="/agent", tags=["Agent"])


class ChatRequest(BaseModel):
    message: str
    session_id: str = None


@router.post("/chat")
async def chat_with_agent(
    request: ChatRequest, current_user: models.User = Depends(auth.get_current_user)
):
    try:
        # Pass the authenticated user's ID to the orchestrator
        agent = create_orchestrator_agent(user_id=current_user.id)

        # Simple session management (in-memory for now)
        session_service = InMemorySessionService()
        # Use a session ID that persists or create a new one
        session_id = request.session_id or f"session_{uuid.uuid4()}"

        # We can use the user's actual ID for the session user_id
        session_user_id = str(current_user.id)

        await session_service.create_session(
            app_name="orchestrator", user_id=session_user_id, session_id=session_id
        )

        runner = Runner(
            app_name="orchestrator", agent=agent, session_service=session_service
        )

        # Construct message
        # ADK usually expects a specific message structure
        # We'll use the same duck-typing as in gemini_agent.py
        part = SimpleNamespace(text=request.message)
        msg = SimpleNamespace(role="user", parts=[part])

        response_text = ""
        async for event in runner.run_async(
            user_id=session_user_id, session_id=session_id, new_message=msg
        ):
            if hasattr(event, "text") and event.text:
                response_text += event.text
            elif hasattr(event, "content"):
                c = event.content
                if hasattr(c, "parts"):
                    for p in c.parts:
                        if hasattr(p, "text") and p.text:
                            response_text += p.text

        return {"response": response_text, "session_id": session_id}

    except Exception as e:
        import traceback

        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
