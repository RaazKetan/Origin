from fastapi import APIRouter
from ..gemini_agent import analyze_repo, refine_pitch

router = APIRouter(prefix="/ai", tags=["AI"])


@router.post("/refine_pitch")
def refine_pitch_route(data: dict):
    return refine_pitch(data["raw_idea"])


@router.post("/analyze_repo")
def analyze_repo_route(data: dict):
    readme = data.get("readme", "")
    files = data.get("files", [])
    return analyze_repo(readme, files)
