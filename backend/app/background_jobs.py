"""
Background Job System for Asynchronous Repository Analysis

Simple in-memory job queue for processing GitHub repository analysis.
Can be upgraded to Celery/Redis for production use.
"""

import asyncio
import uuid
from datetime import datetime
from typing import Dict, List, Optional
from enum import Enum
import threading
from sqlalchemy.orm import Session
from .database import SessionLocal
from .models import User, Job, JobMatch
from .scoring import compute_final_match_score
from .match_utlis import cosine_similarity
from .utils import embed_text


class JobStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class AnalysisJob:
    def __init__(self, user_id: int, repo_urls: List[str]):
        self.job_id = str(uuid.uuid4())
        self.user_id = user_id
        self.repo_urls = repo_urls
        self.status = JobStatus.PENDING
        self.created_at = datetime.now()
        self.completed_at: Optional[datetime] = None
        self.results: List[dict] = []
        self.errors: List[str] = []


class JobQueue:
    """Simple in-memory job queue for background tasks"""

    def __init__(self):
        self.jobs: Dict[str, AnalysisJob] = {}
        self.user_jobs: Dict[int, str] = {}  # user_id -> job_id mapping
        self._lock = threading.Lock()
        self._processing = False

    def create_job(self, user_id: int, repo_urls: List[str]) -> str:
        """Create a new analysis job"""
        with self._lock:
            # Cancel any existing job for this user
            if user_id in self.user_jobs:
                old_job_id = self.user_jobs[user_id]
                if old_job_id in self.jobs:
                    del self.jobs[old_job_id]

            job = AnalysisJob(user_id, repo_urls)
            self.jobs[job.job_id] = job
            self.user_jobs[user_id] = job.job_id
            return job.job_id

    def get_job(self, job_id: str) -> Optional[AnalysisJob]:
        """Get job by ID"""
        return self.jobs.get(job_id)

    def get_user_job(self, user_id: int) -> Optional[AnalysisJob]:
        """Get the current job for a user"""
        job_id = self.user_jobs.get(user_id)
        if job_id:
            return self.jobs.get(job_id)
        return None

    def update_job_status(
        self, job_id: str, status: JobStatus, results: Optional[List[dict]] = None
    ):
        """Update job status and results"""
        with self._lock:
            if job_id in self.jobs:
                job = self.jobs[job_id]
                job.status = status
                if results:
                    job.results = results
                if status in [JobStatus.COMPLETED, JobStatus.FAILED]:
                    job.completed_at = datetime.now()

    def add_job_error(self, job_id: str, error: str):
        """Add an error message to a job"""
        with self._lock:
            if job_id in self.jobs:
                self.jobs[job_id].errors.append(error)

    def cleanup_old_jobs(self, max_age_hours: int = 24):
        """Remove jobs older than max_age_hours"""
        with self._lock:
            now = datetime.now()
            to_remove = []
            for job_id, job in self.jobs.items():
                if job.completed_at:
                    age = (now - job.completed_at).total_seconds() / 3600
                    if age > max_age_hours:
                        to_remove.append(job_id)

            for job_id in to_remove:
                job = self.jobs[job_id]
                del self.jobs[job_id]
                if job.user_id in self.user_jobs:
                    del self.user_jobs[job.user_id]


# Global job queue instance
job_queue = JobQueue()


async def process_repository_analysis(job_id: str):
    """
    Process repository analysis in the background.
    This function runs asynchronously and updates the job status.
    """
    from .gemini_agent import analyze_user_repository

    job = job_queue.get_job(job_id)
    if not job:
        return

    job_queue.update_job_status(job_id, JobStatus.PROCESSING)

    results = []
    for repo_url in job.repo_urls:
        try:
            print(f"[Background] Analyzing repository: {repo_url}")
            analysis = await analyze_user_repository(repo_url)
            results.append(analysis)
            print(f"[Background] Completed analysis for: {repo_url}")
        except BaseException as e:
            # NOTE: BaseException, not Exception. Google ADK / MCP raises
            # BaseExceptionGroup from anyio task groups when the GitHub-Copilot
            # MCP server returns 401 (or any sub-task fails) — these escape
            # `except Exception`, killing the FastAPI request with
            # `RuntimeError: No response returned.`
            # We swallow them per-repo so the profile-setup flow still saves.
            error_msg = f"Failed to analyze {repo_url}: {type(e).__name__}: {e}"
            print(f"[Background] {error_msg}")
            job_queue.add_job_error(job_id, error_msg)
            # Re-raise KeyboardInterrupt / SystemExit so dev workflows stay sane
            if isinstance(e, (KeyboardInterrupt, SystemExit)):
                raise

    if results:
        job_queue.update_job_status(job_id, JobStatus.COMPLETED, results)
        print(f"[Background] Job {job_id} completed with {len(results)} results")

        # Calculate new portfolio score and activity score based on analysis
        db: Session = SessionLocal()
        try:
            user = db.query(User).filter(User.id == job.user_id).first()
            if user:
                total_skills = set()
                total_commits = 0

                for res in results:
                    total_commits += int(res.get("commits_count") or 0)
                    skills = res.get("skills_detected") or []
                    for s in skills:
                        total_skills.add(s)

                # Simple scoring algorithm
                skill_bonus = min(len(total_skills) * 2, 40)
                commit_bonus = min(total_commits // 10, 40)

                new_portfolio_score = 20 + skill_bonus + commit_bonus
                user.portfolio_score = min(new_portfolio_score, 100)

                if user.portfolio_score >= 80:
                    user.portfolio_rank = "Advanced"
                elif user.portfolio_score >= 50:
                    user.portfolio_rank = "Intermediate"
                else:
                    user.portfolio_rank = "Beginner"

                # Activity Score
                new_activity_score = 30 + (min(total_commits, 100) / 100 * 70)
                user.activity_score = min(int(new_activity_score), 100)

                # Update embedding
                user.top_languages = list(total_skills)[:10]
                vec_text = f"{user.name} {user.bio} {' '.join(user.skills or [])} {' '.join(user.top_languages or [])}"
                user.user_vector = embed_text(vec_text)

                # Persist the raw analysis on the user row so /repo-reviews
                # and /pending-skills both see it without needing the in-memory
                # job queue (which doesn't survive across processes/cold starts).
                user.pending_repo_analysis = results
                user.analysis_notification = True

                db.commit()
                print(
                    f"[Background] Updated User {user.id} Profile Scores: Portfolio={user.portfolio_score}, Activity={user.activity_score}"
                )
        except Exception as e:
            print(f"[Background] Error updating user scores: {e}")
            db.rollback()
        finally:
            db.close()

    else:
        job_queue.update_job_status(job_id, JobStatus.FAILED)
        print(f"[Background] Job {job_id} failed - no successful analyses")


async def start_background_job(user_id: int, repo_urls: List[str]) -> str:
    """
    Run repository analysis inline and return the job_id once finished.
    On Vercel serverless the request must complete the work itself — there
    is no persistent worker to pick up fire-and-forget tasks.
    """
    job_id = job_queue.create_job(user_id, repo_urls)
    print(f"[Background] Created job {job_id} for user {user_id}")
    await process_repository_analysis(job_id)
    return job_id


# --- Job Matching Logic ---


def calculate_skill_overlap(job_skills: List[str], user_skills: List[str]) -> float:
    if not job_skills:
        return 100.0  # If no skills required, perfect match? Or 0? Let's say 0 to be safe, or 100 if generic.
    if not user_skills:
        return 0.0

    # Normalize
    j_skills = set(s.lower() for s in job_skills)
    u_skills = set(s.lower() for s in user_skills)

    intersection = j_skills.intersection(u_skills)
    if not j_skills:
        return 0.0

    return (len(intersection) / len(j_skills)) * 100.0


async def process_match_job_with_users(job_id: int):
    """
    Match a specific job against all active users.
    """
    print(f"[Matching] Starting match for Job ID {job_id}")
    db: Session = SessionLocal()
    try:
        job = db.query(Job).filter(Job.id == job_id).first()
        if not job:
            print(f"[Matching] Job {job_id} not found.")
            return

        # Ensure job has vector
        if not job.job_vector or not isinstance(job.job_vector, list):
            # Generate embedding if missing (though creating job should handle this)
            text_to_embed = (
                f"{job.title} {job.description} {' '.join(job.skills or [])}"
            )
            job.job_vector = embed_text(text_to_embed)
            db.commit()

        users = db.query(User).filter(User.is_active).all()
        print(f"[Matching] Found {len(users)} active users to match against.")

        for user in users:
            # Semantic Score
            user_vector = user.user_vector

            if not user_vector and user.bio:
                semantic_score = 0.0
            else:
                try:
                    semantic_score = (
                        cosine_similarity(job.job_vector, user_vector) * 100.0
                    )
                except Exception:
                    # print(f"Error computing cosine for user {user.id}")
                    semantic_score = 0.0

            # Skill Overlap
            skill_score = calculate_skill_overlap(job.skills or [], user.skills or [])

            # Real Work Score (Activity Score)
            real_work = float(user.activity_score or 0)

            # Readiness (Portfolio Score)
            readiness = float(user.portfolio_score or 0)

            final_score = compute_final_match_score(
                semantic_score, skill_score, real_work, readiness
            )

            # Upsert JobMatch
            match_record = (
                db.query(JobMatch)
                .filter(JobMatch.job_id == job.id, JobMatch.user_id == user.id)
                .first()
            )

            if not match_record:
                match_record = JobMatch(job_id=job.id, user_id=user.id)
                db.add(match_record)

            match_record.semantic_score = semantic_score
            match_record.skill_overlap_score = skill_score
            match_record.real_work_score = real_work
            match_record.readiness_score = readiness
            match_record.final_match_score = final_score
            match_record.is_active = True

        db.commit()
        print(f"[Matching] Completed matching for Job {job_id}")

    except Exception as e:
        print(f"[Matching] Error matching job {job_id}: {e}")
        db.rollback()
    finally:
        db.close()


async def process_match_user_with_jobs(user_id: int):
    """
    Match a specific user against all active jobs.
    """
    print(f"[Matching] Starting match for User ID {user_id}")
    db: Session = SessionLocal()
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            print(f"[Matching] User {user_id} not found.")
            return

        jobs = db.query(Job).filter(Job.status == "active").all()
        print(f"[Matching] Found {len(jobs)} active jobs to match against.")

        user_vector = user.user_vector
        # If user has no vector, semantic score is 0

        for job in jobs:
            # Semantic Score
            if not user_vector or not job.job_vector:
                semantic_score = 0.0
            else:
                semantic_score = cosine_similarity(job.job_vector, user_vector) * 100.0

            # Skill Overlap
            skill_score = calculate_skill_overlap(job.skills or [], user.skills or [])

            # Real Work Score
            real_work = float(user.activity_score or 0)

            # Readiness
            readiness = float(user.portfolio_score or 0)

            final_score = compute_final_match_score(
                semantic_score, skill_score, real_work, readiness
            )

            # Upsert JobMatch
            match_record = (
                db.query(JobMatch)
                .filter(JobMatch.job_id == job.id, JobMatch.user_id == user.id)
                .first()
            )

            if not match_record:
                match_record = JobMatch(job_id=job.id, user_id=user.id)
                db.add(match_record)

            match_record.semantic_score = semantic_score
            match_record.skill_overlap_score = skill_score
            match_record.real_work_score = real_work
            match_record.readiness_score = readiness
            match_record.final_match_score = final_score
            match_record.is_active = True

        db.commit()
        print(f"[Matching] Completed matching for User {user_id}")

    except Exception as e:
        print(f"[Matching] Error matching user {user_id}: {e}")
        db.rollback()
    finally:
        db.close()


async def trigger_job_matching(job_id: int):
    """Run job matching inline. On Vercel serverless, fire-and-forget tasks
    don't survive past the response, so we await the work."""
    await process_match_job_with_users(job_id)


async def trigger_user_matching(user_id: int):
    """Run user matching inline. See note on trigger_job_matching."""
    await process_match_user_with_jobs(user_id)
