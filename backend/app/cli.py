import argparse
from pathlib import Path
import os

from dotenv import load_dotenv
import psycopg


def promote_admin(email: str) -> None:
    load_dotenv(Path(__file__).resolve().parents[2] / ".env")
    database_url = os.environ.get("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL is required")
    with psycopg.connect(database_url) as conn:
        with conn.transaction():
            row = conn.execute(
                "SELECT player_id FROM player_accounts WHERE lower(email)=lower(%s) AND is_active=true",
                (email,),
            ).fetchone()
            if not row:
                raise RuntimeError("No active registered account exists for that email")
            conn.execute(
                "INSERT INTO player_roles (player_id, role_key) VALUES (%s, 'admin') ON CONFLICT DO NOTHING",
                (row[0],),
            )
            conn.execute(
                "INSERT INTO audit_log (actor_player_id, action, entity_type, entity_id, details) VALUES (NULL, 'role.bootstrap', 'player', %s, jsonb_build_object('role','admin'))",
                (str(row[0]),),
            )
    print("Administrator role is ready for the active account.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Math Rush 3D local administration tools")
    subparsers = parser.add_subparsers(dest="command", required=True)
    promote = subparsers.add_parser("promote-admin", help="Grant the administrator role to an existing account")
    promote.add_argument("email")
    args = parser.parse_args()
    if args.command == "promote-admin":
        promote_admin(args.email)


if __name__ == "__main__":
    main()
