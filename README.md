# Math Rush 3D

Math Rush 3D is a mobile-first 3D crowd runner built with React, TypeScript,
Three.js, React Three Fiber and Zustand. Its active API uses Python, FastAPI
and PostgreSQL.

## Gameplay

- Start with one runner and steer with drag, A/D, or the arrow keys.
- Choose the better option in exactly ten math gate pairs.
- Survive side blockers, breakable walls, enemy crowds, and moving hammers.
- Fight a level-balanced boss. An optimal route is always able to win.
- Carry the crowd into a visible x1-x10 multiplier lane.
- Earn stars, score, coins, skins, leaderboard rank, and lifetime statistics.

## Local setup

Requirements: Node.js 20+, Python 3.11+, and Docker with PostgreSQL support (or
a separately installed PostgreSQL server).

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements-dev.txt
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
npm install
docker compose up -d postgres
npm run db:migrate
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). The API runs at
`http://localhost:3001`, and the Docker PostgreSQL instance uses host port
`5433` to avoid conflicts with a standard local PostgreSQL installation.

To open the simple administrator panel, visit
[http://localhost:5173/admin](http://localhost:5173/admin) and sign in using
an account with the database-backed administrator role. To grant that role to
an account after registration, run `python -m backend.app.cli promote-admin
your-account@example.com` from the project root.

The client remains playable when the API is unavailable. Completed runs are
queued in local storage and retried after a player session reconnects.

Password recovery uses single-use reset links that expire after 15 minutes.
For deployed email delivery, configure `PUBLIC_APP_URL`, `RESEND_API_KEY`, and
`PASSWORD_RESET_FROM_EMAIL` on the API service. The sender must use a domain
verified with the email provider. Local development returns a test reset link
in the response when `NODE_ENV` is not `production`.

To run only the game client without PostgreSQL:

```powershell
npm run dev:client
```

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start FastAPI and the Vite client together |
| `npm run db:migrate` | Apply pending PostgreSQL migrations |
| `npm run build` | Type-check the TypeScript client and build web assets |
| `npm test` | Run client, retained TypeScript reset, and Python API tests |
| `npm run lint` | Run Oxlint |
| `npm run start:server` | Start the Python API without watch mode |

## Project folders

- `frontend` contains the React game, browser assets, and Vite HTML entry point.
- `backend/app` contains the active FastAPI service and PostgreSQL access code.
- `backend/tests` contains Python API and game-rule tests.
- `backend/server` contains a retained, non-running TypeScript/Express reference implementation.
- `database/migrations` contains the ordered SQL schema migrations.
- `shared` contains the browser's game reward rules; the Python API has parity tests for its corresponding calculation.
- Root configuration and `package.json` coordinate development and deployment.

## Architecture

- `frontend/src/components/game` contains the frame-critical React Three Fiber systems.
- `frontend/src/store/useGameStore.ts` owns run state and persistent player preferences.
- `frontend/src/utils` contains pure gate, obstacle, balance, and collision rules.
- `frontend/src/services/api.ts` handles player bootstrap, offline run queuing, and API calls.
- `backend/app/main.py` contains the active API endpoints; `security.py` covers password/session/reset tokens and database-backed admin roles.
- `database/migrations` contains schema changes applied by `npm run db:migrate`.

The level definition is generated once in `GameScene` and passed to gates,
obstacles, and the boss. Crowd position stays in refs to avoid React renders at
frame rate. Crowd bodies and heads are rendered with instancing.

See [DATABASE.md](./DATABASE.md) for persistence details.
