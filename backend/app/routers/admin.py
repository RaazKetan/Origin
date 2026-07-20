"""Admin-locked schema migration. Third schema-drift outage fix.

create_all only creates MISSING TABLES; new columns on existing tables need
ALTERs. Every model change that adds a user column must append one idempotent
statement to _MIGRATIONS. Locked by X-Admin-Secret.
"""

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core import secrets
from app.database import Base, engine, get_db
from app.limiter import limiter

router = APIRouter(prefix="/admin", tags=["Admin"])

# Idempotent column adds (tables are covered by create_all below).
_MIGRATIONS = [
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS verified_skills JSONB",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS contribution_grid JSONB",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS contributions_total INTEGER",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS contribution_fetched_at TIMESTAMPTZ",
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS github_access_token TEXT",
]


@router.post("/migrate")
@limiter.limit("2/minute")
def migrate(
    request: Request,
    x_admin_secret: str = Header(None),
    db: Session = Depends(get_db),
):
    # No get_current_user dep on purpose: auth itself breaks when the users
    # table is mid-drift — the admin secret is the sole lock.
    if not secrets.ADMIN_SECRET or x_admin_secret != secrets.ADMIN_SECRET:
        raise HTTPException(status_code=403, detail="Admin access required")

    results = {"create_all": None, "alters": []}
    try:
        Base.metadata.create_all(bind=engine)
        results["create_all"] = "ok"
    except Exception as e:
        results["create_all"] = f"{type(e).__name__}: {e}"

    for stmt in _MIGRATIONS:
        try:
            db.execute(text(stmt))
            db.commit()
            results["alters"].append({"stmt": stmt[:60], "ok": True})
        except Exception as e:
            db.rollback()
            results["alters"].append({"stmt": stmt[:60], "ok": False, "error": str(e)[:120]})

    return results
