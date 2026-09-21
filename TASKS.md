# Roadmap

## Implemented

- [x] Fix boss balancing from the generated level definition
- [x] Replace frame-window collisions with plane-crossing collision checks
- [x] Optimize crowd rendering with GPU instancing
- [x] Add enemy crowds and moving hammer obstacles
- [x] Add boss battle state and health feedback
- [x] Add crowd-performance x1-x10 finish sequence
- [x] Add pause, functional settings, and persistent statistics
- [x] Add mobile safe areas, drag controls, battery saver, and capped pixel ratio
- [x] Add PostgreSQL profiles, runs, event history, skins, achievements, and leaderboards
- [x] Add registered accounts, login, password recovery, and persistent player sessions
- [x] Move the active API and persistence layer to Python and FastAPI
- [x] Add database-backed administrator roles, player management, skin catalogue management, feedback review, search, and audit history
- [x] Document API routes with the live OpenAPI specification and Swagger UI
- [x] Add client, TypeScript compatibility, and Python API/database tests

## Remaining work

- [ ] Deploy the active FastAPI service and apply migration 008 to the hosted database
- [ ] Configure and verify the production email sender for password recovery
- [ ] Record acceptance testing with independent players on desktop and Android devices
- [ ] Measure page load, frame rate, and frame time on representative hardware; review the large 3D bundle
- [ ] Prototype a question-checkpoint mode for reading-heavy subjects
- [ ] Consider richer effects, audio, levels, and themes after usability and performance checks
