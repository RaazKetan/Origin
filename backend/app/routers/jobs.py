from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime

from ..database import get_db
from ..models import User, Job, JobMatch, Application
from ..schemas import (
    JobCreate,
    JobResponse,
    ApplicationCreate,
    ApplicationResponse,
    ApplicationDetailResponse,
    ConnectionResponse,
)
from ..auth import get_current_user
from ..utils import embed_text
from ..background_jobs import trigger_job_matching
from ..scoring import compute_visibility_score

router = APIRouter(
    prefix="/jobs",
    tags=["jobs"],
    responses={404: {"description": "Not found"}},
)


def increment_exposure(db: Session, match_ids: List[int]):
    """Background task to increment times_shown for displayed jobs"""
    try:
        # Bulk update would be better but iterating is fine for small batch
        matches = db.query(JobMatch).filter(JobMatch.id.in_(match_ids)).all()
        for match in matches:
            match.times_shown += 1
            match.last_shown_at = datetime.now()
        db.commit()
    except Exception as e:
        print(f"Error updating exposure: {e}")
    finally:
        db.close()  # Important since this runs in background


@router.post("/", response_model=JobResponse)
async def create_job(
    job: JobCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # User must be an employer? For now, any user can post.
    # Maybe check org_type?
    # if current_user.org_type != "company":
    #     raise HTTPException(status_code=403, detail="Only companies can post jobs")

    # Generate embedding
    text_to_embed = (
        f"{job.title} {job.description} {job.requirements or ''} {' '.join(job.skills)}"
    )
    job_vector = embed_text(text_to_embed)

    db_job = Job(
        employer_id=current_user.id,
        title=job.title,
        description=job.description,
        requirements=job.requirements,
        skills=job.skills,
        location=job.location,
        salary_range=job.salary_range,
        job_vector=job_vector,
        status="active",
    )

    db.add(db_job)
    db.commit()
    db.refresh(db_job)

    # Trigger matching against candidates
    trigger_job_matching(db_job.id)

    return db_job


@router.get("/feed", response_model=List[JobResponse])
async def get_job_feed(
    background_tasks: BackgroundTasks,
    limit: int = 20,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get personalized job feed for the current user.
    Applies visibility scoring based on match score and exposure.
    """
    # Get active matches for this user
    matches = (
        db.query(JobMatch)
        .join(Job)
        .filter(
            JobMatch.user_id == current_user.id,
            JobMatch.is_active == True,
            Job.status == "active",
        )
        .all()
    )

    # Calculate visibility scores
    scored_matches = []

    # Check if user is "fresh" (e.g. created in last 7 days)
    is_fresh_user = (
        datetime.now() - current_user.created_at.replace(tzinfo=None)
    ).days < 7

    for match in matches:
        # Determine if underexposed (high match score but low exposure)
        is_underexposed = match.final_match_score > 70 and match.times_shown < 5

        vis_score = compute_visibility_score(
            final_match_score=float(match.final_match_score or 0),
            times_shown=match.times_shown,
            is_fresh_user=is_fresh_user,
            is_underexposed=is_underexposed,
        )

        scored_matches.append((vis_score, match))

    # Sort by visibility score descending
    scored_matches.sort(key=lambda x: x[0], reverse=True)

    # Take top N
    top_matches = scored_matches[:limit]

    # Prepare response
    response_jobs = []
    match_ids_to_update = []

    for score, match in top_matches:
        job = match.job
        # Attach dynamic scores to job object for response
        # We need to create a copy or attach attributes if Pydantic model allows extra fields
        # JobResponse has visibility_score and final_match_score fields
        job.visibility_score = score
        job.final_match_score = match.final_match_score

        response_jobs.append(job)
        match_ids_to_update.append(match.id)

    # Trigger exposure update
    # We need a new session for background task
    from ..database import SessionLocal

    def bg_update_wrapper(ids):
        session = SessionLocal()
        increment_exposure(session, ids)

    background_tasks.add_task(bg_update_wrapper, match_ids_to_update)

    return response_jobs


@router.post("/{job_id}/apply", response_model=ApplicationResponse)
async def apply_to_job(
    job_id: int,
    application: ApplicationCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Check if job exists
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Check if already applied
    existing_app = (
        db.query(Application)
        .filter(Application.job_id == job_id, Application.user_id == current_user.id)
        .first()
    )

    if existing_app:
        raise HTTPException(status_code=400, detail="Already applied to this job")

    new_app = Application(
        job_id=job_id,
        user_id=current_user.id,
        cover_letter=application.cover_letter,
        status="applied",
    )

    db.add(new_app)
    db.commit()
    db.refresh(new_app)

    return new_app


@router.get("/my-applications", response_model=List[ApplicationDetailResponse])
async def get_my_applications(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get all applications for the current user with job and employer details."""
    applications = (
        db.query(Application)
        .filter(Application.user_id == current_user.id)
        .order_by(Application.created_at.desc())
        .all()
    )

    results = []
    for app in applications:
        job = db.query(Job).filter(Job.id == app.job_id).first()
        if not job:
            continue
        employer = db.query(User).filter(User.id == job.employer_id).first()

        results.append(
            ApplicationDetailResponse(
                id=app.id,
                job_id=app.job_id,
                user_id=app.user_id,
                status=app.status,
                cover_letter=app.cover_letter,
                created_at=app.created_at,
                job_title=job.title,
                job_description=job.description,
                job_skills=job.skills or [],
                job_location=job.location,
                job_salary_range=job.salary_range,
                employer_id=job.employer_id,
                employer_name=employer.name if employer else None,
                employer_org_name=employer.org_name if employer else None,
            )
        )

    return results


@router.get("/my-connections", response_model=List[ConnectionResponse])
async def get_my_connections(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get connections — applications where the recruiter responded.
    Only returns applications with status != 'applied'.
    """
    applications = (
        db.query(Application)
        .filter(
            Application.user_id == current_user.id,
            Application.status != "applied",
        )
        .order_by(Application.created_at.desc())
        .all()
    )

    results = []
    for app in applications:
        job = db.query(Job).filter(Job.id == app.job_id).first()
        if not job:
            continue
        employer = db.query(User).filter(User.id == job.employer_id).first()

        results.append(
            ConnectionResponse(
                id=app.id,
                job_id=app.job_id,
                status=app.status,
                created_at=app.created_at,
                job_title=job.title,
                job_skills=job.skills or [],
                job_location=job.location,
                employer_id=job.employer_id,
                employer_name=employer.name if employer else None,
                employer_org_name=employer.org_name if employer else None,
                employer_avatar_url=employer.avatar_url if employer else None,
            )
        )

    return results
