from fastapi import APIRouter, Request, Depends
from pydantic import BaseModel, Field
from typing import List
from app import auth
from app.gemini_agent import analyze_commit, analyze_repo, refine_pitch
from app.limiter import limiter

router = APIRouter(
    prefix="/ai", tags=["AI"], dependencies=[Depends(auth.get_current_user)]
)

# Companion router for endpoints that must be reachable without a JWT
# (e.g. the landing-page demo). Same /ai prefix, no auth dependency.
public_router = APIRouter(prefix="/ai", tags=["AI Public"])


class RefinePitchRequest(BaseModel):
    raw_idea: str = Field(..., min_length=10, max_length=5000)


class AnalyzeRepoRequest(BaseModel):
    readme: str = Field("", max_length=20000)
    files: List[str] = Field(default_factory=list, max_length=500)


class AnalyzeCommitRequest(BaseModel):
    code: str = Field(..., min_length=20, max_length=8000)


@router.post("/refine_pitch")
@limiter.limit("10/minute")
def refine_pitch_route(request: Request, data: RefinePitchRequest):
    return refine_pitch(data.raw_idea)


@router.post("/analyze_repo")
@limiter.limit("5/minute")
def analyze_repo_route(request: Request, data: AnalyzeRepoRequest):
    return analyze_repo(data.readme, data.files)


@public_router.post("/analyze_commit")
@limiter.limit("3/minute")
def analyze_commit_route(request: Request, data: AnalyzeCommitRequest):
    """Public endpoint for the landing-page demo. Strictly rate-limited
    because it spends Gemini quota on un-authenticated traffic."""
    return analyze_commit(data.code)
