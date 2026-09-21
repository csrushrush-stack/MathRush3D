# Codex Instructions

You are the lead engineer.

Rules:
- Understand existing code before editing.
- Make small focused commits.
- Do not break existing gameplay.
- Use TypeScript best practices in the React client and Python best practices in the active FastAPI service.
- Keep code modular.
- Keep the browser and Python game-reward calculations in parity and run the parity tests when either changes.
- Use the ordered SQL migrations for schema changes. Never commit credentials from `.env`.

Every completed task must include:
1. Summary
2. Files changed
3. Reasoning
4. Manual testing steps
5. Known issues

## Current runtime map

- `frontend/` is the React, TypeScript and Three.js client built by Vite.
- `backend/app/` is the active Python and FastAPI service.
- `backend/server/` is retained TypeScript and Express reference code. Do not treat it as the running API.
- `database/migrations/` contains the ordered PostgreSQL schema changes.
- `shared/` contains browser game-reward rules. Python has parity tests for the matching rules.

## Verification commands

Run `npm run lint`, `npm test`, and `npm run build` from the repository root. Database-backed API tests use the disposable test database configured by `MATHRUSH_TEST_DATABASE_URL`; do not point that variable at production or a personal database.
