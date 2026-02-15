from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from .. import schemas, models, auth
from ..database import get_db
from ..gemini_agent import analyze_user_repos
from ..utils import embed_text
import requests

router = APIRouter(prefix="/profile", tags=["Profile"])


@router.post("/setup", response_model=schemas.UserResponse)
def setup_profile(
    data: schemas.UserProfileUpdate,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    if not (1 <= len(data.github_selected_repos) <= 5):
        raise HTTPException(status_code=400, detail="Select between 1 and 5 repos")

    # Fetch minimal repo metadata via GitHub API (unauthenticated)
    repos_meta = []
    for url in data.github_selected_repos:
        try:
            # Expect https://github.com/{owner}/{repo}
            parts = url.rstrip("/").split("/")
            owner, repo = parts[-2], parts[-1]
            meta = requests.get(
                f"https://api.github.com/repos/{owner}/{repo}", timeout=10
            ).json()
            langs = requests.get(
                f"https://api.github.com/repos/{owner}/{repo}/languages", timeout=10
            ).json()
            repos_meta.append(
                {
                    "name": meta.get("name", repo),
                    "languages": list(langs.keys() or []),
                    "description": meta.get("description") or "",
                }
            )
        except Exception:
            repos_meta.append({"name": "unknown", "languages": [], "description": ""})

    ai = analyze_user_repos(current_user.username, repos_meta)

    current_user.org_type = data.org_type
    current_user.org_name = data.org_name
    current_user.github_profile_url = data.github_profile_url
    current_user.github_selected_repos = [
        {"url": u} for u in data.github_selected_repos
    ]
    current_user.embedding_summary = (
        ai.get("embedding_summary") or current_user.embedding_summary
    )
    current_user.top_languages = ai.get("core_skills") or []
    # Compute user embedding vector
    try:
        vec_text = f"{current_user.name} {current_user.bio} {' '.join(current_user.skills or [])} {' '.join(current_user.top_languages or [])}"
        current_user.user_vector = embed_text(vec_text)
    except Exception:
        pass
    current_user.activity_score = 70  # simple placeholder; compute via GitHub later
    db.add(current_user)
    db.commit()
    db.refresh(current_user)
    return current_user
