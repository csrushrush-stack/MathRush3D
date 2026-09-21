# Math Rush 3D

## Project Overview
Math Rush 3D is a mobile-first 3D crowd runner inspired by Count Masters, but built around mathematics.

### Tech Stack
- React
- Vite
- TypeScript
- Tailwind CSS
- Three.js
- React Three Fiber
- Drei
- Zustand
- Python and FastAPI for the active API
- PostgreSQL through psycopg for persistent data
- Capacitor for the Android web container

## Runtime architecture
- `frontend/` owns the browser interface, 3D scene, controls and API client.
- `backend/app/` owns authentication, validation, game-reward checks, administration and PostgreSQL access.
- `database/migrations/` contains the ordered schema changes.
- The browser and Android client use HTTP requests to reach the API; neither connects directly to PostgreSQL.
- `backend/server/` is retained TypeScript and Express reference code, not the active service.

## Core Gameplay
- Start with 1 character.
- Auto-run forward.
- Move left/right.
- Exactly 10 math gate pairs.
- Choose one gate from each pair.
- Gate answer is added to the crowd.

## Level Flow
Start → 10 Gate Pairs → Obstacles → Boss → Finish Line

## Boss
Track:
- startingCrowd
- actualMathGain
- maxPossibleMathGain
- currentCrowd

Boss must always be beatable if the player consistently chooses the best gates.

## Stars
3★: >=10% remaining crowd
2★: >=5%
1★: Win below 5%

## Audio
Separate sounds for gates, obstacles, boss, win, lose and UI.

## Accounts and administration
- Accounts support registration, login, session logout and password recovery.
- PostgreSQL stores progress, runs, settings, skins, achievements, feedback and administrator audit records.
- Administrator access is granted through database-backed roles. The dashboard can search and manage players, runs, skins and player feedback, and inspect audit history.
- Account removal is handled by deactivation; skins are archived rather than physically removed from game history.

## Development and verification
- Start the Python API and Vite client together with `npm run dev` after local PostgreSQL is available and migrations are applied.
- Run `npm test` for client rules, retained TypeScript checks and Python API/database tests. The Python integration tests require `MATHRUSH_TEST_DATABASE_URL` to point to a disposable test database.
- `README.md` covers setup and commands. `DATABASE.md` covers persistence and migrations. `TASKS.md` is the current roadmap.

## Rules
- Mobile-first.
- Keep architecture modular.
- Don't rewrite working systems.
- Prioritize performance.
