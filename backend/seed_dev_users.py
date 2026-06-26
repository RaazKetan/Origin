"""Seed dev users with KNOWN credentials so you can log in and test the
flow against your local SQLite without going through OAuth.

Run from /backend:
    source .venv/bin/activate && python seed_dev_users.py

Idempotent: re-running ALSO resets the password + refreshes the user fields
so the documented creds always work even if you've been editing things.
"""

import os
import sys
from datetime import datetime, timedelta
from dotenv import load_dotenv

load_dotenv()
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.database import SessionLocal, Base, engine  # noqa: E402
from app import models, auth  # noqa: E402

Base.metadata.create_all(bind=engine)

# Each user is a dict so we can vary which fields we set. Anything left out
# defaults to None / empty. profile_completed users get richer fields so the
# ProfileView design has real data to render.

USERS = [
    {
        # The original 5 — quick login users
        "username": "ketan", "name": "Ketan Raj", "email": "ketan@example.com",
        "password": "DevPass1234",
        "bio": "Backend & infra. Loves boring distributed systems.",
        "skills": ["Python", "FastAPI", "Postgres", "Docker", "Redis"],
        "top_languages": ["Python", "Go", "TypeScript"],
        "top_frameworks": ["FastAPI", "Next.js"],
        "github_profile_url": "https://github.com/raazketan",
        "github_selected_repos": [
            {"url": "https://github.com/raazketan/Origin", "name": "Origin", "description": "Talent platform that verifies skills from commits.", "language": "Python", "stars": 12, "forks": 2},
            {"url": "https://github.com/raazketan/ketan-v5", "name": "ketan-v5", "description": "Personal site + small experiments.", "language": "TypeScript", "stars": 4, "forks": 0},
        ],
        "org_name": "Building Origin", "org_type": "company",
        "portfolio_score": 72, "portfolio_rank": "Intermediate", "activity_score": 65,
        "profile_completed": True,
    },
    {
        "username": "alice", "name": "Alice Park", "email": "alice@example.com",
        "password": "DevPass1234",
        "bio": "Frontend engineer playing with React + design.",
        "skills": ["TypeScript", "React", "Tailwind", "Vite", "Storybook"],
        "top_languages": ["TypeScript", "JavaScript", "CSS"],
        "github_profile_url": "https://github.com/alice",
        "github_selected_repos": [
            {"url": "https://github.com/alice/ui-kit", "name": "ui-kit", "description": "Headless React components with tasteful defaults.", "language": "TypeScript", "stars": 248, "forks": 21},
            {"url": "https://github.com/alice/motion-lab", "name": "motion-lab", "description": "Spring physics + gesture demos.", "language": "TypeScript", "stars": 96, "forks": 8},
        ],
        "org_name": "Stripe", "org_type": "company",
        "portfolio_score": 81, "portfolio_rank": "Advanced", "activity_score": 78,
        "profile_completed": True,
    },
    {
        "username": "bob", "name": "Bob Mehta", "email": "bob@example.com",
        "password": "DevPass1234",
        "bio": "ML / data person — embeddings, retrieval, agents.",
        "skills": ["Python", "PyTorch", "Vector DBs"],
        "profile_completed": False,   # fresh — will land on profile setup
    },
    {
        "username": "carol", "name": "Carol Iyer", "email": "carol@example.com",
        "password": "DevPass1234",
        "bio": "DevOps & platform. Kubernetes by day.",
        "skills": ["Go", "Kubernetes", "Terraform", "AWS", "Prometheus"],
        "top_languages": ["Go", "Python", "Shell"],
        "github_profile_url": "https://github.com/caroli",
        "github_selected_repos": [
            {"url": "https://github.com/caroli/k8s-recipes", "name": "k8s-recipes", "description": "Production-grade Kubernetes manifests for small teams.", "language": "Go", "stars": 510, "forks": 64},
        ],
        "org_name": "Cloudflare", "org_type": "company",
        "portfolio_score": 74, "portfolio_rank": "Advanced", "activity_score": 70,
        "profile_completed": True,
    },
    {
        "username": "dave", "name": "Dave Singh", "email": "dave@example.com",
        "password": "DevPass1234",
        "bio": "Mobile + web. Shipping side projects.",
        "skills": ["Swift", "React Native", "Node.js"],
        "profile_completed": False,
    },

    # ---------- NEW: showcase user with a fully-populated profile ----------
    {
        "username": "rivera", "name": "Alex Rivera", "email": "alex@example.com",
        "password": "DevPass1234",
        "bio": "Backend & distributed-systems engineer. I build reliable infrastructure "
               "and developer tooling — currently focused on stream processing in Rust "
               "and TypeScript.",
        "skills": [
            "TypeScript", "Rust", "Distributed Systems",
            "API Design", "PostgreSQL", "Kafka", "gRPC",
        ],
        "top_languages": ["Rust", "TypeScript", "Go", "Python"],
        "top_frameworks": ["Tokio", "Actix", "Next.js"],
        "github_profile_url": "https://github.com/alexrivera",
        "github_selected_repos": [
            {
                "url": "https://github.com/alexrivera/stream-core",
                "name": "stream-core",
                "description": "Low-latency stream processing engine in Rust. Powers ingestion for 3 production systems.",
                "language": "Rust",
                "stars": 2143, "forks": 184,
            },
            {
                "url": "https://github.com/alexrivera/ts-router",
                "name": "ts-router",
                "description": "Type-safe API router for TypeScript with zero-runtime overhead and full inference.",
                "language": "TypeScript",
                "stars": 5712, "forks": 412,
            },
            {
                "url": "https://github.com/alexrivera/consensus-kit",
                "name": "consensus-kit",
                "description": "Raft consensus implementation with a test harness for partition and failure injection.",
                "language": "Rust",
                "stars": 980, "forks": 67,
            },
            {
                "url": "https://github.com/alexrivera/lru-disk",
                "name": "lru-disk",
                "description": "On-disk LRU cache with crash-safe checkpoints. Drop-in replacement for in-memory caches.",
                "language": "Go",
                "stars": 314, "forks": 23,
            },
            {
                "url": "https://github.com/alexrivera/wirebench",
                "name": "wirebench",
                "description": "Reproducible benchmarks for serialization libraries: protobuf, capnp, flatbuffers, msgpack.",
                "language": "Rust",
                "stars": 188, "forks": 12,
            },
        ],
        "org_name": "Ramp", "org_type": "company",
        "portfolio_score": 94, "portfolio_rank": "Expert", "activity_score": 88,
        "profile_completed": True,
    },
]


db = SessionLocal()
added, reset = 0, 0
try:
    for u in USERS:
        existing = db.query(models.User).filter(
            (models.User.email == u["email"]) | (models.User.username == u["username"])
        ).first()

        # Build/update the model. We always overwrite from the seed dict so
        # editing this file and re-running gets you the fresh state.
        target = existing or models.User(username=u["username"], email=u["email"])
        target.username = u["username"]
        target.name = u["name"]
        target.email = u["email"]
        target.password_hash = auth.get_password_hash(u["password"])
        target.bio = u.get("bio") or ""
        target.skills = u.get("skills") or []
        target.top_languages = u.get("top_languages") or None
        target.top_frameworks = u.get("top_frameworks") or None
        target.github_profile_url = u.get("github_profile_url")
        target.github_selected_repos = u.get("github_selected_repos") or None
        target.org_name = u.get("org_name")
        target.org_type = u.get("org_type")
        target.portfolio_score = u.get("portfolio_score") or 0
        target.portfolio_rank = u.get("portfolio_rank")
        target.activity_score = u.get("activity_score")
        target.profile_completed = u.get("profile_completed", False)

        if existing:
            reset += 1
            tag = "reset "
        else:
            db.add(target)
            added += 1
            tag = "added "
        db.flush()
        print(f"  {tag} {u['username']:<8} (id={target.id})  completed={target.profile_completed}  score={target.portfolio_score}")

    db.commit()
finally:
    db.close()

print(f"\nDone — added {added}, refreshed {reset}.")
print()
print("┌──────────────────────────────────────────────────────────────────────────────┐")
print("│ Login with any of these (password: DevPass1234)                              │")
print("├──────────────────────────────────────────────────────────────────────────────┤")
print("│ username  status                                                              │")
print("│ ketan     completed · light profile                                           │")
print("│ alice     completed · UI engineer @ Stripe                                    │")
print("│ bob       fresh — lands on Profile Setup                                      │")
print("│ carol     completed · DevOps @ Cloudflare                                     │")
print("│ dave      fresh — lands on Profile Setup                                      │")
print("│ rivera    SHOWCASE — full profile (94/100 · Expert · 5 repos · 7 skills)      │")
print("└──────────────────────────────────────────────────────────────────────────────┘")
