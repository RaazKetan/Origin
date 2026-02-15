"""
Profile Setup Router

Handles user profile setup after registration, including:
- Resume upload and parsing
- Manual profile entry
- GitHub repository analysis
- Portfolio score calculation
"""

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from .. import schemas, models, auth
from ..database import get_db
from ..resume_parser import parse_resume

from ..utils import embed_text
import os

router = APIRouter(prefix="/profile-setup", tags=["Profile Setup"])

# Create uploads directory if it doesn't exist
UPLOAD_DIR = "uploads/resumes"
os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.get("/check-username")
async def check_username(username: str, db: Session = Depends(get_db)):
    """Check if a username is available"""
    existing = db.query(models.User).filter(models.User.username == username).first()
    return {"available": existing is None}


@router.post("/upload-resume", response_model=schemas.ResumeParseResponse)
async def upload_resume(
    file: UploadFile = File(...),
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    """
    Upload and parse resume file.
    Returns extracted data for user to review and edit.
    """
    # Validate file type
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")

    filename_lower = file.filename.lower()
    if not (filename_lower.endswith(".pdf") or filename_lower.endswith(".docx")):
        raise HTTPException(
            status_code=400, detail="Only PDF and DOCX files are supported"
        )

    try:
        # Read file content
        file_content = await file.read()

        if len(file_content) == 0:
            raise HTTPException(status_code=400, detail="File is empty")

        # Save file
        file_path = os.path.join(UPLOAD_DIR, f"{current_user.id}_{file.filename}")
        with open(file_path, "wb") as f:
            f.write(file_content)

        # Update user's resume_url
        current_user.resume_url = file_path
        db.commit()

        # Parse resume
        parsed_data = await parse_resume(file_content, file.filename)

        return schemas.ResumeParseResponse(**parsed_data)

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


@router.post("/complete-profile", response_model=schemas.UserResponse)
async def complete_profile(
    data: schemas.ProfileSetupRequest,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    """
    Complete user profile setup.
    Requires 1-5 GitHub repos for analysis.
    Calculates portfolio score and ranking.
    Sets profile_completed = True.
    """
    # Validate GitHub repos (1-5 required)
    if not data.github_repos or len(data.github_repos) < 1:
        raise HTTPException(
            status_code=400, detail="At least 1 GitHub repository is required"
        )

    if len(data.github_repos) > 5:
        raise HTTPException(
            status_code=400, detail="Maximum 5 GitHub repositories allowed"
        )

    try:
        # Start background job for repository analysis
        from ..background_jobs import start_background_job

        print(
            f"Starting background analysis for {len(data.github_repos)} repositories..."
        )
        job_id = start_background_job(current_user.id, data.github_repos)
        print(f"Background job {job_id} started for user {current_user.id}")

        # Update basic profile information immediately
        current_user.profile_completed = True
        current_user.bio = data.bio or ""
        current_user.awards = data.awards or []
        current_user.college_name = data.college_name
        current_user.college_gpa = data.college_gpa
        current_user.college_years = data.college_years
        current_user.certifications = data.certifications or []

        # Add manually entered skills
        current_user.skills = data.skills or []

        # Store GitHub repos (will be analyzed in background)
        current_user.github_selected_repos = [{"url": url} for url in data.github_repos]

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
