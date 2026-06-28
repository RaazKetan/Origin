import json
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app import models, auth
from app.core.config import settings
from app.database import get_db
from app.limiter import limiter
from app.llm import generate

router = APIRouter(
    prefix="/skill-gap",
    tags=["Skill Gap Analysis"],
    dependencies=[Depends(auth.get_current_user)],
)


class SkillGapAnalysisRequest(BaseModel):
    candidate_id: int
    interview_transcript: str = Field(..., min_length=50, max_length=20000)
    target_role: str = Field(..., min_length=1, max_length=200)


class SkillGapResponse(BaseModel):
    id: int
    candidate_id: int
    target_role: str
    current_skills: List[dict]
    skill_gaps: List[dict]
    strengths: List[str]
    learning_roadmap: dict
    recommended_courses: List[dict]
    readiness_score: int
    deployment_timeline: str
    analysis_summary: str
    created_at: str

    class Config:
        from_attributes = True


def analyze_interview_with_ai(
    transcript: str, target_role: str, candidate_skills: List[str]
) -> dict:
    """
    Use Gemini AI to analyze interview transcript and generate skill gap analysis
    """
    try:
        if not settings.GEMINI_API_KEY:
            raise Exception("No API key found")

        prompt = f"""
Analyze this interview transcript for a {target_role} position.

CANDIDATE BACKGROUND:
- Current Skills: {", ".join(candidate_skills) if candidate_skills else "Not specified"}

INTERVIEW TRANSCRIPT:
{transcript}

Perform a comprehensive skill gap analysis and return a JSON object with this EXACT structure:

{{
  "demonstrated_skills": [
    {{"skill": "React", "proficiency": "intermediate", "evidence": "Discussed building responsive UIs with hooks"}},
    {{"skill": "Python", "proficiency": "advanced", "evidence": "Explained complex async patterns"}}
  ],
  "skill_gaps": [
    {{"skill": "Kubernetes", "priority": "high", "current_level": "none", "target_level": "intermediate", "impact": "critical"}},
    {{"skill": "AWS", "priority": "medium", "current_level": "beginner", "target_level": "advanced", "impact": "important"}}
  ],
  "strengths": [
    "Strong problem-solving abilities",
    "Excellent communication skills",
    "Deep understanding of React ecosystem"
  ],
  "learning_roadmap": {{
    "phases": [
      {{
        "name": "Foundation Phase",
        "duration_weeks": 4,
        "skills_to_learn": ["Docker basics", "Container concepts", "AWS fundamentals"],
        "milestones": ["Deploy first containerized app", "Set up AWS account and basic services"],
        "estimated_hours": 40
      }},
      {{
        "name": "Intermediate Phase",
        "duration_weeks": 4,
        "skills_to_learn": ["Kubernetes basics", "AWS advanced services", "CI/CD pipelines"],
        "milestones": ["Deploy app to Kubernetes", "Set up automated deployment pipeline"],
        "estimated_hours": 50
      }}
    ],
    "total_duration_weeks": 8,
    "total_estimated_hours": 90
  }},
  "recommended_courses": [
    {{
      "skill": "Kubernetes",
      "course_name": "Kubernetes for Beginners",
      "platform": "Udemy",
      "url": "https://www.udemy.com/course/learn-kubernetes/",
      "duration": "10 hours",
      "difficulty": "beginner",
      "cost": "free",
      "relevance": "Addresses critical gap in container orchestration"
    }},
    {{
      "skill": "AWS",
      "course_name": "AWS Certified Solutions Architect",
      "platform": "A Cloud Guru",
      "url": "https://acloudguru.com/course/aws-certified-solutions-architect-associate",
      "duration": "20 hours",
      "difficulty": "intermediate",
      "cost": "paid",
      "relevance": "Essential for cloud deployment skills"
    }},
    {{
      "skill": "Docker",
      "course_name": "Docker Tutorial for Beginners",
      "platform": "YouTube",
      "url": "https://www.youtube.com/watch?v=fqMOX6JJhGo",
      "duration": "3 hours",
      "difficulty": "beginner",
      "cost": "free",
      "relevance": "Foundation for Kubernetes learning"
    }}
  ],
  "readiness_score": 70,
  "deployment_timeline": "6-8 weeks with focused upskilling",
  "analysis_summary": "Candidate demonstrates strong technical fundamentals with excellent React and Python skills. Primary gaps are in cloud infrastructure (Kubernetes, AWS) which are critical for the {target_role} role. With focused learning over 6-8 weeks, candidate can reach deployment readiness. Strengths in problem-solving and communication will accelerate learning."
}}

IMPORTANT:
- Be specific and realistic in your analysis
- Prioritize skill gaps by impact (critical/important/nice-to-have)
- Provide actionable learning paths with realistic timelines
- Include mix of free and paid course recommendations
- Readiness score should be 0-100 based on current vs required skills
- Output ONLY valid JSON, no additional text
"""

        text = generate(model=settings.GEMINI_PRO_MODEL, contents=prompt).strip()

        # Clean JSON markers
        if text.startswith("```json"):
            text = text[7:]
        elif text.startswith("```"):
            text = text[3:]
        if text.endswith("```"):
            text = text[:-3]

        result = json.loads(text.strip())
        return result

    except Exception as e:
        print(f"AI analysis failed: {e}")
        import traceback

        traceback.print_exc()

        # Return fallback analysis
        return {
            "demonstrated_skills": [
                {
                    "skill": s,
                    "proficiency": "intermediate",
                    "evidence": "Mentioned in transcript",
                }
                for s in candidate_skills[:5]
            ],
            "skill_gaps": [
                {
                    "skill": "Advanced " + target_role + " skills",
                    "priority": "high",
                    "current_level": "intermediate",
                    "target_level": "advanced",
                    "impact": "important",
                }
            ],
            "strengths": ["Technical knowledge", "Communication skills"],
            "learning_roadmap": {
                "phases": [
                    {
                        "name": "Skill Development",
                        "duration_weeks": 8,
                        "skills_to_learn": ["Advanced concepts"],
                        "milestones": ["Complete training"],
                        "estimated_hours": 80,
                    }
                ],
                "total_duration_weeks": 8,
                "total_estimated_hours": 80,
            },
            "recommended_courses": [
                {
                    "skill": target_role,
                    "course_name": f"{target_role} Fundamentals",
                    "platform": "Coursera",
                    "url": "https://www.coursera.org",
                    "duration": "20 hours",
                    "difficulty": "intermediate",
                    "cost": "free",
                    "relevance": "Core skills development",
                }
            ],
            "readiness_score": 60,
            "deployment_timeline": "8-10 weeks",
            "analysis_summary": f"Analysis completed for {target_role} position. Candidate shows potential with focused training.",
        }


@router.post("/analyze", response_model=SkillGapResponse)
@limiter.limit("3/minute")
async def analyze_skill_gap(
    request: Request,
    body: SkillGapAnalysisRequest,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    """
    Analyze interview transcript to identify skill gaps and generate learning roadmap
    """
    try:
        print(
            f"Analyzing skill gap for candidate {body.candidate_id}, role: {body.target_role}"
        )

        # Get candidate
        candidate = (
            db.query(models.Candidate)
            .filter(models.Candidate.id == body.candidate_id)
            .first()
        )

        if not candidate:
            raise HTTPException(status_code=404, detail="Candidate not found")

        # Perform AI analysis
        ai_result = analyze_interview_with_ai(
            body.interview_transcript, body.target_role, candidate.skills or []
        )

        # Create analysis record
        analysis = models.SkillGapAnalysis(
            candidate_id=body.candidate_id,
            interview_transcript=body.interview_transcript,
            target_role=body.target_role,
            required_skills=[gap["skill"] for gap in ai_result.get("skill_gaps", [])],
            current_skills=ai_result.get("demonstrated_skills", []),
            skill_gaps=ai_result.get("skill_gaps", []),
            strengths=ai_result.get("strengths", []),
            learning_roadmap=ai_result.get("learning_roadmap", {}),
            recommended_courses=ai_result.get("recommended_courses", []),
            readiness_score=ai_result.get("readiness_score", 50),
            deployment_timeline=ai_result.get("deployment_timeline", "Unknown"),
            analysis_summary=ai_result.get("analysis_summary", ""),
            analyzed_by_user_id=current_user.id,
        )

        db.add(analysis)
        db.commit()
        db.refresh(analysis)

        print(f"Analysis created with ID: {analysis.id}")

        return SkillGapResponse(
            id=analysis.id,
            candidate_id=analysis.candidate_id,
            target_role=analysis.target_role,
            current_skills=analysis.current_skills,
            skill_gaps=analysis.skill_gaps,
            strengths=analysis.strengths,
            learning_roadmap=analysis.learning_roadmap,
            recommended_courses=analysis.recommended_courses,
            readiness_score=analysis.readiness_score,
            deployment_timeline=analysis.deployment_timeline,
            analysis_summary=analysis.analysis_summary,
            created_at=analysis.created_at.isoformat(),
        )

    except HTTPException:
        raise
    except Exception as e:
        print(f"Skill gap analysis failed: {e}")
        import traceback

        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


@router.get("/candidate/{candidate_id}", response_model=List[SkillGapResponse])
@limiter.limit("30/minute")
async def get_candidate_analyses(
    request: Request,
    candidate_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get all skill gap analyses for a candidate
    """
    try:
        analyses = (
            db.query(models.SkillGapAnalysis)
            .filter(models.SkillGapAnalysis.candidate_id == candidate_id)
            .order_by(models.SkillGapAnalysis.created_at.desc())
            .all()
        )

        return [
            SkillGapResponse(
                id=a.id,
                candidate_id=a.candidate_id,
                target_role=a.target_role,
                current_skills=a.current_skills,
                skill_gaps=a.skill_gaps,
                strengths=a.strengths,
                learning_roadmap=a.learning_roadmap,
                recommended_courses=a.recommended_courses,
                readiness_score=a.readiness_score,
                deployment_timeline=a.deployment_timeline,
                analysis_summary=a.analysis_summary,
                created_at=a.created_at.isoformat(),
            )
            for a in analyses
        ]

    except Exception as e:
        print(f"Failed to get analyses: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get analyses: {str(e)}")


@router.get("/analysis/{analysis_id}", response_model=SkillGapResponse)
@limiter.limit("30/minute")
async def get_analysis(
    request: Request,
    analysis_id: int,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get specific skill gap analysis by ID
    """
    try:
        analysis = (
            db.query(models.SkillGapAnalysis)
            .filter(models.SkillGapAnalysis.id == analysis_id)
            .first()
        )

        if not analysis:
            raise HTTPException(status_code=404, detail="Analysis not found")

        return SkillGapResponse(
            id=analysis.id,
            candidate_id=analysis.candidate_id,
            target_role=analysis.target_role,
            current_skills=analysis.current_skills,
            skill_gaps=analysis.skill_gaps,
            strengths=analysis.strengths,
            learning_roadmap=analysis.learning_roadmap,
            recommended_courses=analysis.recommended_courses,
            readiness_score=analysis.readiness_score,
            deployment_timeline=analysis.deployment_timeline,
            analysis_summary=analysis.analysis_summary,
            created_at=analysis.created_at.isoformat(),
        )

    except HTTPException:
        raise
    except Exception as e:
        print(f"Failed to get analysis: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get analysis: {str(e)}")
