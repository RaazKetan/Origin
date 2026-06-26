from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from .. import schemas, models, auth
from ..database import get_db
from ..gemini_agent import analyze_user_repository
from ..limiter import limiter

router = APIRouter(
    prefix="/analyze-repo",
    tags=["Repository Analysis"],
    dependencies=[Depends(auth.get_current_user)],
)


@router.post("/user-repo", response_model=schemas.AnalyzeRepoResponse)
@limiter.limit("5/minute")
async def analyze_user_repo(
    request: Request,
    data: schemas.AnalyzeRepoRequest,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    """
    Analyze a GitHub repository for user profile.
    Extracts commit history, contributions, skills, and technologies.
    """
    try:
        print(f"Analyzing repository: {data.repo_url}")

        # Validate URL
        if not data.repo_url or "github.com" not in data.repo_url:
            raise HTTPException(status_code=400, detail="Invalid GitHub repository URL")

        # Analyze the repository using ADK agent
        analysis = await analyze_user_repository(data.repo_url)

        print(f"Analysis complete: {analysis}")
        return analysis

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error analyzing repository: {e}")
        import traceback

        traceback.print_exc()
        raise HTTPException(
            status_code=500, detail=f"Failed to analyze repository: {str(e)}"
        )
