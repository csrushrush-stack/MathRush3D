# PostgreSQL persistence

PostgreSQL stores player and account data, progression, runs, feedback and admin
records. Ordered SQL migrations in `database/migrations` are recorded in
`schema_migrations` and applied transactionally by the active Python service.

## Local PostgreSQL setup

The supplied Docker Compose service runs PostgreSQL 17. It creates the
`math_rush` database and publishes port `5433` on the host. If a local `.env`
does not already exist, copy `.env.example` to `.env`, then run
`docker compose up -d postgres` and `npm run db:migrate`. The Python runner
applies each pending SQL migration once and records it in `schema_migrations`.

For a separately installed PostgreSQL server, create a database and set
`DATABASE_URL` to its connection string. The game API connects directly to
PostgreSQL through Python's `psycopg` driver. pgAdmin is optional for visual
database inspection; it is not part of the application runtime. Prefer the
migration command over running SQL files manually.

## Main tables

- `players`: anonymous device identity, display name, and selected skin.
- `player_accounts`: email, password hash and account active state.
- `roles` / `player_roles`: database-backed player and administrator permissions.
- `player_progress`: coins, stars, best score, selected difficulty, and lifetime aggregates.
- `player_settings`: audio, vibration, notifications, and reduced-effects preferences.
- `skins` / `player_skins`: cosmetic catalog and ownership.
- `game_runs`: one idempotent summary per completed client run, including finish bonus points.
- `gate_choices`: every expression, chosen side, delta, and crowd transition.
- `obstacle_events`: every hit/dodge/defeat and crowd transition.
- `achievements` / `player_achievements`: catalog, progress, and unlock times.
- `leaderboard`: ranked player summary view.
- `player_feedback`: user-submitted suggestions and problems with review status.
- `audit_log`: administrator changes with actor, action and affected record.
- `schema_migrations`: migration names and applied timestamps.

## API

- `GET /api/health`
- `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout`
- `POST /api/auth/forgot-password`, `POST /api/auth/reset-password`
- `POST /api/players/session`
- `GET /api/players/:playerId/stats`
- `PATCH /api/players/:playerId/settings`
- `PATCH /api/players/:playerId/progress`
- `POST /api/players/:playerId/skins/:skinId/purchase`
- `POST /api/runs`
- `GET /api/leaderboard?difficulty=easy|medium|hard|expert`
- `GET /api/skins`, `POST /api/feedback`
- Role-protected `/api/admin/summary`, `/players`, `/runs`, `/skins`, `/feedback`, `/audit`, and role-management routes.

Run uploads use a unique `client_run_id`, so retrying an offline upload does not
duplicate rewards or statistics. The API recomputes score and coins using the
same shared rule module as the browser instead of trusting client reward totals.

## Production notes

The active API validates requests, applies rate limits to authentication and
password-reset attempts, recalculates run rewards and stores administrator
roles in PostgreSQL. Configure HTTPS and set `DATABASE_SSL=true` when required
by the production database provider. The first admin role is granted to an
existing registered account using `python -m backend.app.cli promote-admin
your-account@example.com`; later role changes are audited.
