"""Coaching feedback from the candidate's OWN repo (the coaching loop).

Evidence = mechanical Repo features from the analysis pipeline, never a
pasted transcript (that was a prompt-injection hole and measured a proxy).
Rules: top 3 gaps max, each names the gap in THEIR work + the skill behind
it. No point values, no thresholds, no rubric anywhere in the output.

ponytail: stateless v1 — feedback isn't persisted; the re-score on their
next push is the durable record. Add persistence when anti-gaming telemetry
(feedback-then-instant-giant-commit) ships.
"""

import json
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app import models, auth
from app.core import constants
from app.database import get_db
from app.limiter import limiter
from app.llm import generate
from app.services.json_parse import parse_json

router = APIRouter(
    prefix="/skill-gap",
    tags=["Skill Gap Analysis"],
    dependencies=[Depends(auth.get_current_user)],
)


class RepoFeedbackRequest(BaseModel):
    repo_id: int
    target_role: str = Field("Software Engineer", min_length=1, max_length=200)


class RepoFeedbackResponse(BaseModel):
    repo_name: str
    target_role: str
    skill_gaps: List[dict]        # [{skill, gap_in_your_work, why_it_matters}]
    strengths: List[str]
    learning_roadmap: dict
    recommended_courses: List[dict]
    readiness_score: int
    analysis_summary: str


_PROMPT = """You are a senior engineer reviewing a fresher's project like a mentor.

Their repo "{repo_name}" (target role: {target_role}) was mechanically analyzed:
{evidence}

Detected work summary: {summary}

Give feedback the way a senior reviewer would in a real code review:
- Identify the TOP {n_gaps} most important gaps IN THIS SPECIFIC WORK, each tied to the skill behind it. Be concrete about what is missing in their repo, not generic advice.
- Never mention scores, points, weights, thresholds, or ranking criteria.
- Then their genuine strengths (only what the evidence supports).
- A short learning roadmap (phases with skills_to_learn + milestones) and 2-3 course/resource recommendations matched to the gaps.
- readiness_score: your 0-100 judgment of how ready this work is for a {target_role} interview.

Reply ONLY JSON:
{{"skill_gaps": [{{"skill": str, "gap_in_your_work": str, "why_it_matters": str}}],
  "strengths": [str],
  "learning_roadmap": {{"phases": [{{"name": str, "skills_to_learn": [str], "milestones": [str]}}]}},
  "recommended_courses": [{{"skill": str, "course_name": str, "platform": str, "url": str}}],
  "readiness_score": int,
  "analysis_summary": str}}"""


def _evidence(repo: models.Repo) -> dict:
    """Only mechanically-measured facts. Nulls omitted — never invent."""
    facts = {
        "source_loc": repo.authored_loc,
        "has_tests": repo.has_tests,
        "tests_actually_assert": repo.tests_assert,
        "has_ci": repo.has_ci,
        "build_setup_complete": repo.builds,
        "commit_history_incremental": (
            None if repo.cadence_score is None else repo.cadence_score >= 50
        ),
    }
    return {k: v for k, v in facts.items() if v is not None}


@router.post("/repo-feedback", response_model=RepoFeedbackResponse)
@limiter.limit("3/minute")
def repo_feedback(
    request: Request,
    body: RepoFeedbackRequest,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    """Mentor-style feedback on one of the current user's analyzed repos."""
    repo = (
        db.query(models.Repo)
        .filter(models.Repo.id == body.repo_id, models.Repo.user_id == current_user.id)
        .first()
    )
    if not repo:
        raise HTTPException(status_code=404, detail="Repo not found. Run /github/analyze first.")

    summary = ""
    for r in (current_user.pending_repo_analysis or []):
        if isinstance(r, dict) and repo.repo_name.endswith("/" + (r.get("name") or "")):
            summary = (r.get("analysis_summary") or "")[:800]
            break

    prompt = _PROMPT.format(
        repo_name=repo.repo_name,
        target_role=body.target_role,
        evidence=json.dumps(_evidence(repo)),
        summary=summary or "n/a",
        n_gaps=3,
    )
    try:
        out = parse_json(generate(constants.GEMINI_MODEL, prompt))
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Feedback generation unavailable: {e}")

    return RepoFeedbackResponse(
        repo_name=repo.repo_name,
        target_role=body.target_role,
        skill_gaps=(out.get("skill_gaps") or [])[:3],  # hard cap — an audit becomes a rubric
        strengths=out.get("strengths") or [],
        learning_roadmap=out.get("learning_roadmap") or {},
        recommended_courses=out.get("recommended_courses") or [],
        readiness_score=max(0, min(100, int(out.get("readiness_score") or 0))),
        analysis_summary=out.get("analysis_summary") or "",
    )


@router.get("/my-repos")
@limiter.limit("30/minute")
def my_analyzed_repos(
    request: Request,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    """Analyzed repos the user can request feedback on."""
    rows = db.query(models.Repo).filter_by(user_id=current_user.id).all()
    return [
        {"repo_id": r.id, "repo_name": r.repo_name, "analyzed_at": r.analyzed_at}
        for r in rows
    ]
