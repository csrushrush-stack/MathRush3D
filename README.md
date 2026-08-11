# Math Rush 3D

Math Rush 3D is a mobile-first 3D crowd runner built with React, TypeScript,
Three.js, React Three Fiber, Zustand, Express, and PostgreSQL.

## Gameplay

- Start with one runner and steer with drag, A/D, or the arrow keys.
- Choose the better option in exactly ten math gate pairs.
- Survive side blockers, breakable walls, enemy crowds, and moving hammers.
- Fight a level-balanced boss. An optimal route is always able to win.
- Carry the crowd into a visible x1-x10 multiplier lane.
- Earn stars, score, coins, skins, leaderboard rank, and lifetime statistics.

## Local setup

Requirements: Node.js 20+ and a running Docker engine (or PostgreSQL 15+).

```powershell
Copy-Item .env.example .env
docker compose up -d postgres
npm run db:migrate
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). The API runs at
`http://localhost:3001`, and the Docker PostgreSQL instance uses host port
`5433` to avoid conflicts with a standard local PostgreSQL installation.

The client remains playable when the API is unavailable. Completed runs are
queued in local storage and retried after a player session reconnects.

To run only the game client without PostgreSQL:

```powershell
npm run dev:client
```

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the API and Vite client together |
| `npm run db:migrate` | Apply pending PostgreSQL migrations |
| `npm run build` | Type-check browser/server code and build production assets |
| `npm test` | Run gameplay rule tests |
| `npm run lint` | Run Oxlint |
| `npm run start:server` | Start the API without watch mode |

## Architecture

- `src/components/game` contains the frame-critical React Three Fiber systems.
- `src/store/useGameStore.ts` owns run state and persistent player preferences.
- `src/utils` contains pure gate, obstacle, balance, and collision rules.
- `src/services/api.ts` handles player bootstrap, offline run queuing, and API calls.
- `shared/gameRules.ts` is used by both the client and API for reward calculation.
- `server` contains the Express API, validation, PostgreSQL pool, and migrations.

The level definition is generated once in `GameScene` and passed to gates,
obstacles, and the boss. Crowd position stays in refs to avoid React renders at
frame rate. Crowd bodies and heads are rendered with instancing.

See [DATABASE.md](./DATABASE.md) for persistence details.
