import os
from sqlalchemy import create_engine, event
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

load_dotenv()

# Resolve the DB URL across naming conventions:
#   DATABASE_URL              — what our code historically used
#   POSTGRES_URL              — what Vercel's Supabase/Neon integrations inject
#   POSTGRES_PRISMA_URL       — same as POSTGRES_URL but with pgbouncer params
# We pick the first non-empty one. Falls back to local SQLite for dev.
DATABASE_URL = (
    os.getenv("DATABASE_URL")
    or os.getenv("POSTGRES_URL")
    or os.getenv("POSTGRES_PRISMA_URL")
    or "sqlite:///./origin.db"
)

# Heroku-style "postgres://" is not accepted by SQLAlchemy 2.x — normalize it.
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = "postgresql://" + DATABASE_URL[len("postgres://"):]

# Supabase's POSTGRES_URL ends in `?supa=base-pooler.x` which psycopg2 rejects
# as "invalid connection option". Drop unrecognized query params — the pooler
# host:port is enough to route correctly.
if DATABASE_URL.startswith("postgresql"):
    from urllib.parse import urlsplit, urlunsplit, parse_qsl, urlencode

    _allowed_pg_params = {
        "sslmode", "connect_timeout", "application_name", "options",
        "keepalives", "keepalives_idle", "keepalives_interval", "keepalives_count",
        "channel_binding", "gssencmode",
    }
    _parts = urlsplit(DATABASE_URL)
    _query = [(k, v) for k, v in parse_qsl(_parts.query) if k in _allowed_pg_params]
    DATABASE_URL = urlunsplit(
        (_parts.scheme, _parts.netloc, _parts.path, urlencode(_query), _parts.fragment)
    )

is_postgres = DATABASE_URL.startswith("postgresql")

if is_postgres:
    # PostgreSQL with connection pooling.
    # On serverless (Vercel) the host is already a pgbouncer pooler, so a
    # small client-side pool is fine.
    engine = create_engine(
        DATABASE_URL,
        pool_size=5,
        max_overflow=10,
        pool_pre_ping=True,
        echo=False,
    )

    # Best-effort pgvector enablement. On Supabase's pooled connection this
    # may fail (extension creation requires a direct connection) — that's OK,
    # the extension is enabled at project creation time anyway.
    @event.listens_for(engine, "connect")
    def receive_connect(dbapi_conn, connection_record):
        try:
            with dbapi_conn.cursor() as cursor:
                cursor.execute("CREATE EXTENSION IF NOT EXISTS vector")
        except Exception as e:
            print(f"[db] CREATE EXTENSION vector skipped: {e}")
else:
    # SQLite (for development/testing)
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False}
    )

SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
