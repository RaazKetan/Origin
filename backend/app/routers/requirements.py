from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from .. import schemas, models, auth
from ..database import get_db
from ..gemini_agent import refine_pitch
from ..utils import embed_text
import math

router = APIRouter(prefix="/requirements", tags=["Requirements"])


class RequirementsAnalysis(BaseModel):
    requirements: str


class UserRecommendation(BaseModel):
    id: int
    username: str
    name: str
    email: str
    skills: list[str]
    bio: str
    avatar_url: str
    org_type: str
    org_name: str
    match_score: float

    class Config:
        from_attributes = True


@router.post("/analyze", response_model=list[UserRecommendation])
def analyze_requirements(
    data: RequirementsAnalysis,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    try:
        print(
            f"Analyzing requirements for user {current_user.id}: {data.requirements[:100]}..."
        )

        # Use Gemini to refine the requirements and extract key terms
        try:
            refined = refine_pitch(data.requirements)
            refined_text = refined.get("refined_pitch", data.requirements)
            print(f"Refined text: {refined_text[:100]}...")
        except Exception as e:
            print(f"Gemini refine_pitch failed: {e}")
            refined_text = data.requirements  # Fallback to original text

        # Create embedding for the requirements
        try:
            req_embedding = embed_text(refined_text)
            print(
                f"Generated embedding with {len(req_embedding) if req_embedding else 0} dimensions"
            )
        except Exception as e:
            print(f"Embedding generation failed: {e}")
            req_embedding = None

        # Get all users except current user
        users = (
            db.query(models.User)
            .filter(models.User.id != current_user.id, models.User.is_active == True)
            .all()
        )
        print(f"Found {len(users)} users to analyze")

        # Calculate similarity scores
        recommendations = []
        for user in users:
            score = 0.0

            # Use embedding similarity if available
            if req_embedding and user.user_vector:
                try:
                    score = cosine_similarity(req_embedding, user.user_vector)
                except Exception as e:
                    print(f"Cosine similarity failed for user {user.id}: {e}")
                    score = 0.0
            else:
                # Fallback to skill overlap
                req_skills = set(refined_text.lower().split())
                user_skills = set((user.skills or []) + (user.top_languages or []))
                user_skills_lower = {s.lower() for s in user_skills}

                if req_skills and user_skills_lower:
                    overlap = len(req_skills.intersection(user_skills_lower))
                    score = overlap / len(req_skills.union(user_skills_lower))

            if score > 0.1:  # Only include users with some relevance
                recommendations.append(
                    UserRecommendation(
                        id=user.id,
                        username=user.username,
                        name=user.name,
                        email=user.email,
                        skills=user.skills or [],
                        bio=user.bio or "",
                        avatar_url=user.avatar_url or "",
                        org_type=user.org_type or "",
                        org_name=user.org_name or "",
                        match_score=round(score, 3),
                    )
                )

        # Sort by match score descending
        recommendations.sort(key=lambda x: x.match_score, reverse=True)

        print(f"Returning {len(recommendations)} recommendations")
        return recommendations[:10]  # Return top 10 matches

    except Exception as e:
        print(f"Requirements analysis failed: {e}")
        import traceback

        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


def cosine_similarity(a, b):
    """Calculate cosine similarity between two vectors"""
    try:
        if not a or not b or len(a) != len(b):
            return 0.0

        dot_product = sum(x * y for x, y in zip(a, b))
        magnitude_a = math.sqrt(sum(x * x for x in a))
        magnitude_b = math.sqrt(sum(x * x for x in b))

        if magnitude_a == 0 or magnitude_b == 0:
            return 0.0

        return dot_product / (magnitude_a * magnitude_b)
    except Exception:
        return 0.0
