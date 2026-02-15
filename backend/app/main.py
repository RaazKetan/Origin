from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import Base, engine
from .routers import (
    users,
    ai,
    auth,
    matching,
    profile,
    chat,
    requirements,
    analyze_repo,
    talent,
    skill_gap,
    profile_setup,
    analysis_status,
    jobs,
    agent,
)


Base.metadata.create_all(bind=engine)
app = FastAPI(title="Origin API")

# CORS middleware for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(profile_setup.router)
app.include_router(analysis_status.router)
app.include_router(users.router)
app.include_router(ai.router)
app.include_router(matching.router)
app.include_router(profile.router)
app.include_router(chat.router)
app.include_router(requirements.router)
app.include_router(analyze_repo.router)
app.include_router(talent.router)
app.include_router(skill_gap.router)
app.include_router(jobs.router)
app.include_router(agent.router)
