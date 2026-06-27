"""
Profile Setup Router

Handles user profile setup after registration, including:
- Resume upload and parsing
- Manual profile entry
- GitHub repository analysis
- Portfolio score calculation
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Request
from ..limiter import limiter
from sqlalchemy.orm import Session
from .. import schemas, models, auth
from ..database import get_db
from ..resume_parser import parse_resume

from ..utils import embed_text
import os
import requests

router = APIRouter(prefix="/profile-setup", tags=["Profile Setup"])

# Uploads go to Vercel Blob in production (set BLOB_READ_WRITE_TOKEN). For
# local dev we fall back to writing under UPLOAD_DIR. The Vercel platform
# filesystem is read-only outside /tmp and not durable across invocations,
# so production must use Blob.
UPLOAD_DIR = os.getenv("UPLOAD_DIR", "/tmp/uploads/resumes")
USE_VERCEL_BLOB = bool(os.getenv("BLOB_READ_WRITE_TOKEN"))
if not USE_VERCEL_BLOB:
    os.makedirs(UPLOAD_DIR, exist_ok=True)


MAX_RESUME_BYTES = 2 * 1024 * 1024  # 2 MB
PDF_MAGIC = b"%PDF-"


@router.get("/check-username")
@limiter.limit("30/minute")
async def check_username(request: Request, username: str, db: Session = Depends(get_db)):
    """Check if a username is available"""
    existing = db.query(models.User).filter(models.User.username == username).first()
    return {"available": existing is None}


@router.post("/upload-resume", response_model=schemas.ResumeParseResponse)
@limiter.limit("5/minute")
async def upload_resume(
    request: Request,
    file: UploadFile = File(...),
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    """
    Upload and parse a PDF resume. Max 2 MB.
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    # Reject by declared content-type early when possible.
    if file.content_type and file.content_type not in ("application/pdf", "application/octet-stream"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported")

    try:
        file_content = await file.read()

        if len(file_content) == 0:
            raise HTTPException(status_code=400, detail="File is empty")

        if len(file_content) > MAX_RESUME_BYTES:
            raise HTTPException(
                status_code=413,
                detail=f"File too large. Max size is {MAX_RESUME_BYTES // (1024 * 1024)} MB.",
            )

        # Magic-byte check: real PDFs start with "%PDF-". Stops renamed
        # executables / arbitrary uploads from reaching the parser.
        if not file_content.startswith(PDF_MAGIC):
            raise HTTPException(
                status_code=400, detail="File is not a valid PDF document"
            )

        # Persist to Supabase Storage (private bucket, PDF-only, 2 MB cap
        # enforced bucket-side too). Falls back to local disk in dev.
        from ..storage import put_resume
        current_user.resume_url = put_resume(
            current_user.id, file.filename, file_content
        )
        db.commit()

        # Parse resume
        parsed_data = await parse_resume(file_content, file.filename)

        return schemas.ResumeParseResponse(**parsed_data)

    except HTTPException:
        # Already a typed HTTP error (e.g. 413 oversize, 400 bad type) —
        # let it propagate instead of being masked as a 500 below.
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        print(f"Error uploading/parsing resume: {e}")
        import traceback

        traceback.print_exc()
        raise HTTPException(
            status_code=500,
            detail="Failed to process resume. Please try again or use manual entry.",
        )


@router.get("/resume-url")
@limiter.limit("30/minute")
async def get_resume_url(
    request: Request,
    current_user: models.User = Depends(auth.get_current_user),
):
    """Mint a short-lived signed URL for the user's own resume."""
    if not current_user.resume_url:
        raise HTTPException(status_code=404, detail="No resume on file")
    from ..storage import signed_url
    url = signed_url(current_user.resume_url, expires_in=3600)
    if not url:
        raise HTTPException(status_code=503, detail="Storage not configured")
    return {"url": url, "expires_in": 3600}


@router.post("/complete-profile", response_model=schemas.UserResponse)
@limiter.limit("5/minute")
async def complete_profile(
    request: Request,
    data: schemas.ProfileSetupRequest,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    """
    Complete user profile setup.
    Takes a GitHub profile URL, auto-fetches top 5 repos for analysis.
    Calculates portfolio score and ranking.
    Sets profile_completed = True.
    """
    # If the frontend's Connect-GitHub flow gave us explicit repos, use those.
    # Otherwise fall back to extracting top-5 from the profile URL (legacy flow).
    github_repos_to_analyze: list[str] = []
    if data.selected_repos:
        # Cap at 5, dedupe, and only accept github.com URLs.
        seen = set()
        for url in data.selected_repos:
            if not url or "github.com" not in url:
                continue
            if url in seen:
                continue
            seen.add(url)
            github_repos_to_analyze.append(url)
            if len(github_repos_to_analyze) >= 5:
                break
    elif data.github_profile_url:
        try:
            username = data.github_profile_url.rstrip("/").split("/")[-1]
            response = requests.get(
                f"https://api.github.com/users/{username}/repos?sort=updated&per_page=100",
                timeout=10,
                headers={"Accept": "application/vnd.github.v3+json"},
            )
            if response.status_code == 200:
                repos = response.json()
                sorted_repos = sorted(
                    repos,
                    key=lambda x: (
                        x.get("stargazers_count", 0),
                        x.get("updated_at", ""),
                    ),
                    reverse=True,
                )
                github_repos_to_analyze = [
                    r["html_url"] for r in sorted_repos[:5]
                ]
            else:
                print(
                    f"Failed to fetch repos for {username}. Status: {response.status_code}"
                )
        except Exception as e:
            print(f"Error fetching GitHub repos: {e}")

    # Default to passing empty array to background job if fetching fails,
    # or handle it gracefully. The user can still proceed.

    try:
        # Start background job for repository analysis. AI failures here
        # must NOT 500 the whole request — the user's profile is still
        # valid; we just won't have the AI analysis until they retry.
        from ..background_jobs import start_background_job

        if github_repos_to_analyze:
            print(
                f"Starting inline analysis for {len(github_repos_to_analyze)} repositories..."
            )
            try:
                job_id = await start_background_job(current_user.id, github_repos_to_analyze)
                print(f"Inline job {job_id} completed for user {current_user.id}")
            except BaseException as e:
                # BaseException so we also catch BaseExceptionGroup from
                # anyio task groups (Google ADK / MCP toolset). Without
                # this the request dies with "No response returned."
                print(f"[complete-profile] inline analysis skipped: {type(e).__name__}: {e}")
                if isinstance(e, (KeyboardInterrupt, SystemExit)):
                    raise

        # Update basic profile information immediately
        current_user.profile_completed = True
        current_user.bio = data.bio or ""
        current_user.awards = data.awards or []
        current_user.college_name = data.college_name
        current_user.college_gpa = data.college_gpa
        current_user.college_years = data.college_years
        current_user.certifications = data.certifications or []
        current_user.github_profile_url = data.github_profile_url

        # Add manually entered skills
        current_user.skills = data.skills or []

        # Store GitHub repos (will be analyzed in background)
        current_user.github_selected_repos = [
            {"url": url} for url in github_repos_to_analyze
        ]

        # Fetch real GitHub contribution grid (best-effort). Uses the user's
        # own GitHub OAuth token when available — preserves rate limit at scale.
        # Cache for 6h to avoid hammering GitHub if the user resubmits the form.
        gh_username = None
        if data.github_profile_url:
            gh_username = data.github_profile_url.rstrip("/").split("/")[-1] or None
        if gh_username:
            from datetime import datetime, timedelta, timezone
            from ..github_data import fetch_contribution_grid

            now = datetime.now(timezone.utc)
            stale = (
                not current_user.contribution_fetched_at
                or current_user.contribution_fetched_at < (now - timedelta(hours=6))
            )
            if stale:
                contrib = fetch_contribution_grid(
                    gh_username, user_token=current_user.github_access_token
                )
                if contrib:
                    current_user.contribution_grid = contrib["grid"]
                    current_user.contributions_total = contrib["total"]
                    current_user.contribution_fetched_at = now

        # Set initial portfolio score (will be updated after analysis)
        current_user.portfolio_score = 50  # Default score
        current_user.portfolio_rank = "Intermediate"  # Default rank

        # Calculate user embedding with current data
        try:
            vec_text = f"{current_user.name} {current_user.bio} {' '.join(current_user.skills or [])}"
            current_user.user_vector = embed_text(vec_text)
        except Exception as e:
            print(f"Error generating user embedding: {e}")

        # Set activity score
        current_user.activity_score = 50  # Default, will be updated after analysis

        db.commit()
        db.refresh(current_user)

        print(
            f"Profile completed for user {current_user.username} (analysis running in background)"
        )
        return current_user

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error completing profile: {e}")
        import traceback

        traceback.print_exc()
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Failed to complete profile setup. Please try again.",
        )


@router.get("/check-completion", response_model=schemas.ProfileCompletionResponse)
async def check_profile_completion(
    current_user: models.User = Depends(auth.get_current_user),
):
    """Check if user has completed profile setup"""
    return schemas.ProfileCompletionResponse(
        profile_completed=current_user.profile_completed or False,
        portfolio_score=current_user.portfolio_score,
        portfolio_rank=current_user.portfolio_rank,
    )
