"""
Analysis Status Router

Handles checking analysis status, retrieving pending skills,
and accepting/dismissing analyzed skills from background jobs.
"""

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from app import schemas, models, auth
from app.database import get_db
from app.background_jobs import job_queue, JobStatus
from app.limiter import limiter

router = APIRouter(
    prefix="/analysis", tags=["Analysis"], dependencies=[Depends(auth.get_current_user)]
)


@router.get("/status", response_model=schemas.AnalysisStatusResponse)
@limiter.limit("60/minute")
async def get_analysis_status(
    request: Request,
    current_user: models.User = Depends(auth.get_current_user),
):
    """
    Check if user has pending repository analysis.
    Returns analysis status and whether notification should be shown.
    """
    job = job_queue.get_user_job(current_user.id)

    if not job:
        return schemas.AnalysisStatusResponse(
            has_pending_analysis=current_user.analysis_notification or False,
            analysis_complete=current_user.analysis_notification or False,
            job_status=None,
        )

    return schemas.AnalysisStatusResponse(
        has_pending_analysis=True,
        analysis_complete=job.status == JobStatus.COMPLETED,
        job_status=job.status.value,
    )


@router.get("/pending-skills", response_model=schemas.PendingSkillsResponse)
@limiter.limit("30/minute")
async def get_pending_skills(
    request: Request,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get all pending skills from completed repository analysis.
    Skills are grouped by repository source.
    """
    # Check if there's a completed job
    job = job_queue.get_user_job(current_user.id)

    if job and job.status == JobStatus.COMPLETED:
        # Update user's pending analysis if not already done
        if not current_user.pending_repo_analysis:
            current_user.pending_repo_analysis = job.results
            current_user.analysis_notification = True
            db.commit()
            db.refresh(current_user)

    # Get pending analysis from user record
    pending_analysis = current_user.pending_repo_analysis or []

    # Extract skills with their source repositories
    pending_skills = []
    for repo_data in pending_analysis:
        repo_name = repo_data.get("name", "Unknown")
        repo_url = repo_data.get("url", "")
        skills = repo_data.get("skills_detected", [])

        for skill in skills:
            pending_skills.append(
                schemas.PendingSkill(
                    skill=skill, repo_name=repo_name, repo_url=repo_url
                )
            )

    return schemas.PendingSkillsResponse(
        skills=pending_skills, total_count=len(pending_skills)
    )


@router.post("/accept-skills")
@limiter.limit("20/minute")
async def accept_skills(
    request: Request,
    data: schemas.AcceptSkillsRequest,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    """
    Accept selected skills from pending analysis and add them to user profile.
    Clears the pending analysis and notification flag.
    """
    if not current_user.pending_repo_analysis:
        raise HTTPException(status_code=400, detail="No pending analysis found")

    # Get current skills
    current_skills = set(current_user.skills or [])

    # Add accepted skills
    for skill in data.accepted_skills:
        current_skills.add(skill)

    # Update user profile
    current_user.skills = list(current_skills)
    current_user.pending_repo_analysis = None
    current_user.analysis_notification = False

    # Update embedding if needed
    try:
        from app.services.embeddings import embed_text

        vec_text = f"{current_user.name} {current_user.bio} {' '.join(current_user.skills or [])} {' '.join(current_user.top_languages or [])}"
        current_user.user_vector = embed_text(vec_text)
    except Exception as e:
        print(f"Error updating user embedding: {e}")

    db.commit()
    db.refresh(current_user)

    return {
        "message": f"Successfully added {len(data.accepted_skills)} skills to your profile"
    }


@router.get("/repo-reviews")
@limiter.limit("30/minute")
async def list_repo_reviews(
    request: Request,
    current_user: models.User = Depends(auth.get_current_user),
):
    """Every connected repo, with the agent's review when available."""
    reviews_by_url = {
        (r.get("url") or "").rstrip("/"): r
        for r in (current_user.pending_repo_analysis or [])
        if isinstance(r, dict)
    }
    selected = [
        (s.get("url") if isinstance(s, dict) else s) or ""
        for s in (current_user.github_selected_repos or [])
    ]
    # ponytail: union of selected + analyzed so users see repos they picked
    # even if analysis hasn't run yet
    urls = list(dict.fromkeys([u.rstrip("/") for u in selected if u] + list(reviews_by_url)))

    out = []
    for url in urls:
        r = reviews_by_url.get(url) or {}
        out.append({
            "url": url,
            "name": r.get("name") or url.rstrip("/").split("/")[-1] or "repository",
            "summary": r.get("analysis_summary") or r.get("contributions") or "",
            "languages": r.get("languages") or [],
            "frameworks": r.get("frameworks") or [],
            "skills_detected": r.get("skills_detected") or [],
            "commits_count": int(r.get("commits_count") or 0),
            "last_analyzed": r.get("last_analyzed") or None,
            "analyzed": bool(r),
        })
    return {"reviews": out, "count": len(out)}


@router.post("/dismiss")
@limiter.limit("20/minute")
async def dismiss_analysis(
    request: Request,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    """
    Dismiss pending analysis without accepting any skills.
    Clears the notification flag.
    """
    current_user.pending_repo_analysis = None
    current_user.analysis_notification = False
    db.commit()

    return {"message": "Analysis dismissed"}
