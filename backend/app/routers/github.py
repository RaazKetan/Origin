"""GitHub integration — list a user's public repos so the frontend can
present them for selection instead of asking for a profile URL."""

import os
import re
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session
import requests

from .. import auth, models
from ..database import get_db
from ..github_data import fetch_contribution_grid
from ..limiter import limiter

router = APIRouter(
    prefix="/github",
    tags=["GitHub"],
    dependencies=[Depends(auth.get_current_user)],
)

# GitHub usernames: alphanumeric or hyphens, no consecutive hyphens, 1-39 chars.
_USERNAME_RE = re.compile(r"^(?!-)(?!.*--)[A-Za-z0-9-]{1,39}(?<!-)$")


class RepoSummary(BaseModel):
    name: str
    full_name: str
    url: str  # html_url
    description: Optional[str] = None
    language: Optional[str] = None
    stars: int = 0
    forks: int = 0
    updated_at: Optional[str] = None
    is_fork: bool = False


def _gh_headers():
    headers = {"Accept": "application/vnd.github.v3+json"}
    # Use a server-side PAT if present — bumps the rate limit from 60 to
    # 5000 requests per hour and stays out of the browser bundle.
    token = (os.getenv("GITHUB_TOKEN") or "").strip()
    if token:
        headers["Authorization"] = f"token {token}"
    return headers


@router.get("/repos", response_model=List[RepoSummary])
@limiter.limit("20/minute")
def list_user_repos(
    request: Request,
    username: str,
    current_user: models.User = Depends(auth.get_current_user),
):
    """Return up to 30 of a user's most recently-updated public repos."""
    username = (username or "").strip().lstrip("@")
    if not _USERNAME_RE.match(username):
        raise HTTPException(status_code=400, detail="Invalid GitHub username")

    url = f"https://api.github.com/users/{username}/repos"
    params = {"sort": "updated", "per_page": 30, "type": "owner"}

    def _fetch(use_auth: bool):
        headers = _gh_headers() if use_auth else {"Accept": "application/vnd.github.v3+json"}
        return requests.get(url, params=params, headers=headers, timeout=10)

    try:
        resp = _fetch(use_auth=True)
        # If our server-side PAT is bad/expired, fall back to unauthenticated.
        # Unauth is rate-limited (60/hr per IP) but still works for public repos.
        if resp.status_code == 401:
            print("[github/repos] server token returned 401 — retrying without auth")
            resp = _fetch(use_auth=False)
    except requests.RequestException as e:
        raise HTTPException(status_code=502, detail=f"GitHub unreachable: {e}")

    if resp.status_code == 404:
        raise HTTPException(status_code=404, detail="GitHub user not found")
    if resp.status_code == 403:
        raise HTTPException(
            status_code=503,
            detail="GitHub rate limit hit. Try again in a minute.",
        )
    if resp.status_code >= 400:
        raise HTTPException(
            status_code=502,
            detail=f"GitHub returned {resp.status_code}",
        )

    repos = resp.json() or []
    # Forks first hidden so users surface original work; they can still
    # filter on the client if they want them.
    return [
        RepoSummary(
            name=r.get("name", ""),
            full_name=r.get("full_name", ""),
            url=r.get("html_url", ""),
            description=r.get("description"),
            language=r.get("language"),
            stars=int(r.get("stargazers_count") or 0),
            forks=int(r.get("forks_count") or 0),
            updated_at=r.get("updated_at"),
            is_fork=bool(r.get("fork")),
        )
        for r in repos
    ]


class ContributionGridResponse(BaseModel):
    grid: List[int]
    total: int


@router.post("/refresh-contributions", response_model=ContributionGridResponse)
@limiter.limit("5/minute")
def refresh_my_contributions(
    request: Request,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    """Re-pull this user's GitHub contribution grid + persist it. Used to
    backfill users created before contribution_grid was populated, or to
    refresh after their activity changed."""
    if not current_user.github_profile_url:
        raise HTTPException(status_code=400, detail="No GitHub profile URL on file")

    username = current_user.github_profile_url.rstrip("/").split("/")[-1]
    if not _USERNAME_RE.match(username or ""):
        raise HTTPException(status_code=400, detail="Stored GitHub username is invalid")

    data = fetch_contribution_grid(username, user_token=current_user.github_access_token)
    if not data:
        # Useful message — distinguish "user has no token + server token is dead"
        # from a generic network failure.
        if not current_user.github_access_token:
            raise HTTPException(
                status_code=503,
                detail="GitHub unreachable. Sign in with GitHub to use your own quota.",
            )
        raise HTTPException(
            status_code=503,
            detail="Couldn't reach GitHub. Your token may have been revoked — sign in with GitHub again.",
        )
    from datetime import datetime, timezone
    current_user.contribution_grid = data["grid"]
    current_user.contributions_total = data["total"]
    current_user.contribution_fetched_at = datetime.now(timezone.utc)
    db.add(current_user)
    db.commit()
    return data
