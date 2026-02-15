from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    UniqueConstraint,
    JSON,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import JSONB
from .database import Base, is_postgres


def json_column():
    """Helper to create JSON column that works with both PostgreSQL and SQLite"""
    if is_postgres:
        return Column(JSONB)
    else:
        # For SQLite, use SQLAlchemy's JSON type which handles serialization automatically
        return Column(JSON)


def vector_column(dimensions=768):
    """Helper to create vector column for PostgreSQL or JSON for SQLite"""
    if is_postgres:
        from pgvector.sqlalchemy import Vector

        return Column(Vector(dimensions))
    else:
        # For SQLite, store vectors as JSON arrays
        return Column(JSON)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    skills = json_column()
    embedding_summary = Column(Text)
    bio = Column(Text)
    avatar_url = Column(String)
    is_active = Column(Boolean, default=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    org_type = Column(String)
    org_name = Column(String)
    github_profile_url = Column(String)
    github_selected_repos = json_column()
    activity_score = Column(Integer)
    top_languages = json_column()
    top_frameworks = json_column()
    user_vector = vector_column(768)

    # Profile completion and onboarding fields
    profile_completed = Column(Boolean, default=False, index=True)
    resume_url = Column(String)  # Path to uploaded resume file
    awards = json_column()  # List of awards/extra activities
    college_name = Column(String)
    college_gpa = Column(String)
    college_years = Column(String)  # e.g., "2020-2024"
    certifications = json_column()  # List of certifications
    portfolio_score = Column(Integer, default=0, index=True)  # 0-100
    portfolio_rank = Column(String)  # "Beginner", "Intermediate", "Advanced", "Expert"

    # Background analysis tracking
    pending_repo_analysis = (
        json_column()
    )  # Stores analyzed skills waiting for user review
    analysis_notification = Column(
        Boolean, default=False, index=True
    )  # Flag to show notification dot

    # Relationships
    projects = relationship(
        "Project", back_populates="owner", cascade="all, delete-orphan"
    )
    swipes = relationship("Swipe", back_populates="user", cascade="all, delete-orphan")
    sent_messages = relationship(
        "ChatMessage", foreign_keys="ChatMessage.from_user_id", back_populates="sender"
    )
    received_messages = relationship(
        "ChatMessage", foreign_keys="ChatMessage.to_user_id", back_populates="recipient"
    )

    # Job System Relationships
    jobs = relationship("Job", back_populates="employer", cascade="all, delete-orphan")
    job_matches = relationship(
        "JobMatch", back_populates="user", cascade="all, delete-orphan"
    )
    applications = relationship(
        "Application", back_populates="applicant", cascade="all, delete-orphan"
    )

    if is_postgres:
        __table_args__ = (
            Index("idx_user_skills", "skills", postgresql_using="gin"),
            Index("idx_user_languages", "top_languages", postgresql_using="gin"),
            Index("idx_active_created", "is_active", "created_at"),
        )
    else:
        __table_args__ = (Index("idx_active_created", "is_active", "created_at"),)


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False, index=True)
    summary = Column(Text)
    repo_url = Column(String)
    languages = json_column()
    frameworks = json_column()
    project_type = Column(String, index=True)
    domains = json_column()
    skills = json_column()
    complexity = Column(String, index=True)
    roles = json_column()
    embedding_summary = Column(Text)
    owner_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    is_active = Column(Boolean, default=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    project_vector = vector_column(768)

    # Denormalized fields for performance
    match_count = Column(Integer, default=0)

    # Relationships
    owner = relationship("User", back_populates="projects")
    swipes = relationship(
        "Swipe", back_populates="project", cascade="all, delete-orphan"
    )
    messages = relationship(
        "ChatMessage", back_populates="project", cascade="all, delete-orphan"
    )

    if is_postgres:
        __table_args__ = (
            Index("idx_project_skills", "skills", postgresql_using="gin"),
            Index("idx_project_languages", "languages", postgresql_using="gin"),
            Index("idx_active_owner", "is_active", "owner_id"),
            Index("idx_created_active", "created_at", "is_active"),
        )
    else:
        __table_args__ = (
            Index("idx_active_owner", "is_active", "owner_id"),
            Index("idx_created_active", "created_at", "is_active"),
        )


class Swipe(Base):
    __tablename__ = "swipes"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    project_id = Column(
        Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
    )
    is_like = Column(Boolean, nullable=False)
    approved_by_owner = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    user = relationship("User", back_populates="swipes")
    project = relationship("Project", back_populates="swipes")

    __table_args__ = (
        UniqueConstraint("user_id", "project_id", name="uq_user_project_swipe"),
        Index("idx_user_project_swipe", "user_id", "project_id"),
        Index("idx_project_like", "project_id", "is_like"),
        Index("idx_user_like_created", "user_id", "is_like", "created_at"),
    )


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(
        Integer, ForeignKey("projects.id", ondelete="CASCADE"), nullable=False
    )
    from_user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    to_user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    content = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    is_read = Column(Boolean, default=False)

    # Relationships
    project = relationship("Project", back_populates="messages")
    sender = relationship(
        "User", foreign_keys=[from_user_id], back_populates="sent_messages"
    )
    recipient = relationship(
        "User", foreign_keys=[to_user_id], back_populates="received_messages"
    )

    __table_args__ = (
        Index("idx_conversation", "project_id", "from_user_id", "to_user_id"),
        Index("idx_user_messages", "to_user_id", "created_at"),
        Index("idx_unread_messages", "to_user_id", "is_read"),
    )


class Candidate(Base):
    __tablename__ = "candidates"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    phone = Column(String)
    title = Column(String, index=True)
    location = Column(String)
    experience_years = Column(Integer, index=True)
    current_company = Column(String)
    current_role = Column(String)
    work_history = json_column()
    skills = json_column()
    certifications = json_column()
    education = json_column()
    summary = Column(Text)
    candidate_vector = vector_column(768)
    is_active = Column(Boolean, default=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    skill_gap_analyses = relationship(
        "SkillGapAnalysis", back_populates="candidate", cascade="all, delete-orphan"
    )

    if is_postgres:
        __table_args__ = (
            Index("idx_candidate_skills", "skills", postgresql_using="gin"),
            Index("idx_experience_active", "experience_years", "is_active"),
        )
    else:
        __table_args__ = (
            Index("idx_experience_active", "experience_years", "is_active"),
        )


class SkillGapAnalysis(Base):
    __tablename__ = "skill_gap_analyses"

    id = Column(Integer, primary_key=True, index=True)
    candidate_id = Column(
        Integer, ForeignKey("candidates.id", ondelete="CASCADE"), nullable=False
    )
    interview_transcript = Column(Text)
    target_role = Column(String, index=True)
    required_skills = json_column()
    current_skills = json_column()
    skill_gaps = json_column()
    strengths = json_column()
    learning_roadmap = json_column()
    recommended_courses = json_column()
    readiness_score = Column(Integer, index=True)
    deployment_timeline = Column(String)
    analysis_summary = Column(Text)
    analyzed_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    candidate = relationship("Candidate", back_populates="skill_gap_analyses")
    analyzed_by = relationship("User")

    __table_args__ = (
        Index("idx_candidate_score", "candidate_id", "readiness_score"),
        Index("idx_role_score", "target_role", "readiness_score"),
    )


class Job(Base):
    __tablename__ = "jobs"

    id = Column(Integer, primary_key=True, index=True)
    employer_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    title = Column(String, nullable=False, index=True)
    description = Column(Text)
    requirements = Column(Text)  # Detailed requirements
    skills = json_column()  # List of required skills
    job_vector = vector_column(768)
    location = Column(String)
    salary_range = Column(String)
    status = Column(String, default="active", index=True)  # active, closed, draft

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    employer = relationship("User", back_populates="jobs")
    matches = relationship(
        "JobMatch", back_populates="job", cascade="all, delete-orphan"
    )
    applications = relationship(
        "Application", back_populates="job", cascade="all, delete-orphan"
    )

    if is_postgres:
        __table_args__ = (
            Index("idx_job_skills", "skills", postgresql_using="gin"),
            Index("idx_job_status_created", "status", "created_at"),
        )
    else:
        __table_args__ = (Index("idx_job_status_created", "status", "created_at"),)


class JobMatch(Base):
    __tablename__ = "job_matches"

    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(Integer, ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )

    # Scoring components
    semantic_score = Column(Integer)  # scaled 0-100 or float
    skill_overlap_score = Column(Integer)
    real_work_score = Column(Integer)
    readiness_score = Column(Integer)
    final_match_score = Column(Integer, index=True)  # 0-100

    # Fairness / Visibility tracking
    times_shown = Column(Integer, default=0)
    last_shown_at = Column(DateTime(timezone=True))

    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    job = relationship("Job", back_populates="matches")
    user = relationship("User", back_populates="job_matches")

    __table_args__ = (
        UniqueConstraint("job_id", "user_id", name="uq_job_user_match"),
        Index("idx_match_scores", "job_id", "final_match_score"),
        Index("idx_user_feed", "user_id", "final_match_score"),
    )


class Application(Base):
    __tablename__ = "applications"

    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(Integer, ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    status = Column(
        String, default="applied", index=True
    )  # applied, reviewing, shortlisted, rejected, hired
    cover_letter = Column(Text)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    job = relationship("Job", back_populates="applications")
    applicant = relationship("User", back_populates="applications")

    __table_args__ = (
        UniqueConstraint("job_id", "user_id", name="uq_job_application"),
        Index("idx_app_status", "job_id", "status"),
    )
