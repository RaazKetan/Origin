from pydantic import BaseModel, EmailStr
from typing import List, Optional, Literal
from datetime import datetime


class UserProfileUpdate(BaseModel):
    name: Optional[str] = None
    bio: Optional[str] = None
    skills: Optional[List[str]] = None
    org_type: Optional[Literal["college", "company"]] = None
    org_name: Optional[str] = None
    github_profile_url: Optional[str] = None
    github_selected_repos: Optional[List[str]] = None


class UserCreate(BaseModel):
    username: str
    name: str
    email: EmailStr
    password: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: int
    username: str
    name: str
    email: str
    skills: List[str]
    embedding_summary: Optional[str]
    bio: Optional[str]
    avatar_url: Optional[str]
    is_active: bool
    created_at: datetime
    org_type: Optional[str] = None
    org_name: Optional[str] = None
    github_profile_url: Optional[str] = None
    github_selected_repos: Optional[List[dict]] = None
    activity_score: Optional[int] = None
    top_languages: Optional[List[str]] = None
    top_frameworks: Optional[List[str]] = None
    portfolio_score: Optional[int] = None
    portfolio_rank: Optional[str] = None
    analysis_notification: Optional[bool] = False

    class Config:
        from_attributes = True


class ProjectCreate(BaseModel):
    title: str
    summary: str
    repo_url: Optional[str]
    languages: List[str]
    frameworks: List[str]
    project_type: str
    domains: List[str]
    skills: List[str]
    complexity: str
    roles: List[str]


class ProjectResponse(BaseModel):
    id: int
    title: str
    summary: str
    repo_url: Optional[str]
    languages: List[str]
    frameworks: List[str]
    project_type: str
    domains: List[str]
    skills: List[str]
    complexity: str
    roles: List[str]
    embedding_summary: Optional[str]
    owner_id: int
    is_active: bool
    created_at: datetime
    # Match scoring fields
    match_score: Optional[float] = None
    match_strength: Optional[str] = None
    is_reshow: Optional[bool] = None

    class Config:
        from_attributes = True


class OwnerMatchItem(BaseModel):
    # Project plus the user who liked it
    id: int
    title: str
    summary: str
    repo_url: Optional[str]
    languages: List[str]
    frameworks: List[str]
    project_type: str
    domains: List[str]
    skills: List[str]
    complexity: str
    roles: List[str]
    embedding_summary: Optional[str]
    owner_id: int
    is_active: bool
    created_at: datetime
    liked_by_user_id: int
    approved_by_owner: bool | None = False


class MatchResponse(BaseModel):
    # Project data with the user who matched (liker)
    id: int
    title: str
    summary: str
    repo_url: Optional[str]
    languages: List[str]
    frameworks: List[str]
    project_type: str
    domains: List[str]
    skills: List[str]
    complexity: str
    roles: List[str]
    embedding_summary: Optional[str]
    owner_id: int
    is_active: bool
    created_at: datetime
    liker_user_id: int  # The user who liked this project (the matcher)


class SwipeCreate(BaseModel):
    project_id: int
    is_like: bool


class SwipeResponse(BaseModel):
    id: int
    user_id: int
    project_id: int
    is_like: bool
    approved_by_owner: bool | None = False
    created_at: datetime

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    token_type: str


class TokenData(BaseModel):
    user_id: Optional[int] = None


class CreateProjectFromRepo(BaseModel):
    repo_url: str


class ProjectAnalyzeResponse(BaseModel):
    title: str
    summary: str
    repo_url: Optional[str]
    languages: List[str]
    frameworks: List[str]
    project_type: str
    domains: List[str]
    skills: List[str]
    complexity: str
    roles: List[str]


class ApproveLike(BaseModel):
    project_id: int
    liker_user_id: int


class DiscoverFilters(BaseModel):
    skills: Optional[List[str]] = None
    domains: Optional[List[str]] = None
    complexity: Optional[List[str]] = None
    languages: Optional[List[str]] = None


class ChatMessageCreate(BaseModel):
    project_id: int
    to_user_id: int
    content: str


class ChatMessageResponse(BaseModel):
    id: int
    project_id: int
    from_user_id: int
    to_user_id: int
    content: str
    created_at: datetime

    class Config:
        from_attributes = True


class AnalyzeRepoRequest(BaseModel):
    repo_url: str


class AnalyzeRepoResponse(BaseModel):
    url: str
    name: str
    commits_count: Optional[int] = 0
    contributions: Optional[str] = ""
    skills_detected: List[str] = []
    languages: List[str] = []
    frameworks: List[str] = []
    last_analyzed: str
    analysis_summary: Optional[str] = ""


class AddRepositoryRequest(BaseModel):
    repo_data: dict  # Contains the analyzed repository data


# Profile Setup Schemas
class CheckUsernameRequest(BaseModel):
    username: str


class ResumeParseResponse(BaseModel):
    github_repos: List[str] = []
    awards: List[str] = []
    skills: List[str] = []
    college_name: Optional[str] = None
    college_gpa: Optional[str] = None
    college_years: Optional[str] = None
    certifications: List[str] = []


class ProfileSetupRequest(BaseModel):
    setup_method: Literal["resume", "manual"]
    # For resume upload path
    resume_data: Optional[dict] = None
    # Common fields (can be from resume or manual)
    github_repos: List[str]  # 1-5 repos required
    awards: Optional[List[str]] = []
    skills: Optional[List[str]] = []
    college_name: Optional[str] = None
    college_gpa: Optional[str] = None
    college_years: Optional[str] = None
    certifications: Optional[List[str]] = []
    bio: Optional[str] = ""


class ProfileCompletionResponse(BaseModel):
    profile_completed: bool
    portfolio_score: Optional[int] = None
    portfolio_rank: Optional[str] = None


class AnalysisStatusResponse(BaseModel):
    has_pending_analysis: bool
    analysis_complete: bool
    job_status: Optional[str] = None


class PendingSkill(BaseModel):
    skill: str
    repo_name: str
    repo_url: str


class PendingSkillsResponse(BaseModel):
    skills: List[PendingSkill]
    total_count: int


class AcceptSkillsRequest(BaseModel):
    accepted_skills: List[str]  # List of skill names to accept


# Job System Schemas


class JobCreate(BaseModel):
    title: str
    description: str
    requirements: Optional[str] = None
    skills: List[str]
    location: Optional[str] = None
    salary_range: Optional[str] = None


class JobResponse(BaseModel):
    id: int
    employer_id: int
    title: str
    description: str
    requirements: Optional[str]
    skills: List[str]
    location: Optional[str]
    salary_range: Optional[str]
    status: str
    created_at: datetime
    # Visibility fields for feed
    visibility_score: Optional[float] = None
    final_match_score: Optional[float] = None

    class Config:
        from_attributes = True


class ApplicationCreate(BaseModel):
    job_id: int
    cover_letter: Optional[str] = None


class ApplicationResponse(BaseModel):
    id: int
    job_id: int
    user_id: int
    status: str
    cover_letter: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class ApplicationDetailResponse(BaseModel):
    """Application with embedded job and employer details for the tracker view"""

    id: int
    job_id: int
    user_id: int
    status: str
    cover_letter: Optional[str]
    created_at: datetime
    # Embedded job info
    job_title: str
    job_description: Optional[str] = None
    job_skills: List[str] = []
    job_location: Optional[str] = None
    job_salary_range: Optional[str] = None
    # Embedded employer info
    employer_id: int
    employer_name: Optional[str] = None
    employer_org_name: Optional[str] = None


class ConnectionResponse(BaseModel):
    """Connections — applications where recruiter responded (status != 'applied')"""

    id: int
    job_id: int
    status: str
    created_at: datetime
    # Job info
    job_title: str
    job_skills: List[str] = []
    job_location: Optional[str] = None
    # Employer info
    employer_id: int
    employer_name: Optional[str] = None
    employer_org_name: Optional[str] = None
    employer_avatar_url: Optional[str] = None
