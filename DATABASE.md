# PostgreSQL persistence

The database uses ordered SQL migrations in `server/db/migrations`. Migrations
are recorded in `schema_migrations` and applied transactionally.

## Local PostgreSQL / pgAdmin setup

1. In pgAdmin, create a database named `math_rush` (UTF-8, default owner).
2. Copy `.env.example` to `.env` and put the local connection string in
   `DATABASE_URL`. The real password stays only in `.env`.
3. Run `npm run db:migrate` from the project folder.

For a fully manual pgAdmin setup, connect the Query Tool to `math_rush`, open
and execute these SQL scripts in order:

1. `server/db/migrations/001_initial.sql`
2. `server/db/migrations/002_player_progress.sql`

Both scripts are idempotent enough for setup and the migration runner guarantees
that each version is recorded exactly once. Do not run the second script before
the first.

## Main tables

- `players`: anonymous device identity, display name, and selected skin.
- `player_progress`: coins, stars, best score, selected difficulty, and lifetime aggregates.
- `player_settings`: audio, vibration, notifications, and reduced-effects preferences.
- `skins` / `player_skins`: cosmetic catalog and ownership.
- `game_runs`: one idempotent summary per completed client run, including finish bonus points.
- `gate_choices`: every expression, chosen side, delta, and crowd transition.
- `obstacle_events`: every hit/dodge/defeat and crowd transition.
- `achievements` / `player_achievements`: catalog, progress, and unlock times.
- `leaderboard`: ranked player summary view.

## API

- `GET /api/health`
- `POST /api/players/session`
- `GET /api/players/:playerId/stats`
- `PATCH /api/players/:playerId/settings`
- `PATCH /api/players/:playerId/progress`
- `POST /api/players/:playerId/skins/:skinId/purchase`
- `POST /api/runs`
- `GET /api/leaderboard?difficulty=easy|medium|hard|expert`

Run uploads use a unique `client_run_id`, so retrying an offline upload does not
duplicate rewards or statistics. The API recomputes score and coins using the
same shared rule module as the browser instead of trusting client reward totals.

## Production notes

The anonymous device ID is appropriate for a prototype. Before public launch,
add authenticated accounts, request rate limits, server-generated/signed level
seeds, and stronger run validation to prevent leaderboard cheating. Use TLS and
set `DATABASE_SSL=true` when required by the production database provider.
