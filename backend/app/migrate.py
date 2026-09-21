from pathlib import Path
import os

from dotenv import load_dotenv
import psycopg


def migrate() -> None:
    project_root = Path(__file__).resolve().parents[2]
    load_dotenv(project_root / ".env")
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL is required before applying database migrations")
    migrations = project_root / "database" / "migrations"
    with psycopg.connect(database_url) as conn:
        conn.execute(
            "CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())"
        )
        for file in sorted(migrations.glob("*.sql")):
            exists = conn.execute("SELECT 1 FROM schema_migrations WHERE name=%s", (file.name,)).fetchone()
            if exists:
                continue
            sql = file.read_text(encoding="utf-8")
            with conn.transaction():
                conn.execute(sql, prepare=False)
                conn.execute("INSERT INTO schema_migrations (name) VALUES (%s)", (file.name,))
            print(f"[database] applied {file.name}")


if __name__ == "__main__":
    migrate()
