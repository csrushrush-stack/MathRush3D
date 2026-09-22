# Verification Evidence — 21 September 2026

This file records the verification evidence produced on 21 September 2026 and the
items that remain open (tracked in issue #1).

## Automated test suites

`npm test` reports 46 passing tests:

- 31 front-end rule tests (Vitest): gate and reward rules, formation, speed,
  level progression, boss-meter behaviour and game balance.
- 3 retained TypeScript tests: password-reset token handling.
- 12 Python tests (pytest): 7 shared-rule tests plus 5 database-backed API
  integration tests executed against an isolated disposable PostgreSQL 17
  database with migrations 001-008 applied. The integration suite covers
  registration and login writes, idempotent run submission with duplicate
  detection (HTTP 200 on the duplicate), feedback CRUD with search, skin CRUD,
  audit records, role denial for non-administrator accounts (HTTP 403),
  security headers and the single-use password-reset flow that revokes
  existing sessions.

`npm run lint` and `npm run build` completed successfully, including type
checks.

## Scripted agent-assisted acceptance session

A twelve-scenario functional session executed against the running local
application (Vite client, FastAPI service, disposable PostgreSQL 17 test
database). All twelve scenarios passed, including registration validation,
session creation, difficulty and level selection, leaderboard and statistics
panels, feedback submission, administrator role denial (HTTP 403), logout,
wrong-password error handling, re-login persistence, gameplay canvas render
and a 390x844 no-horizontal-overflow check. Screenshots and the session log
are retained with the assignment evidence.

## Scripted optimal-route playthrough campaign

A scripted driver played the published levels of every difficulty using the
keyboard controls of the running game. The route plan was computed from the
same deterministic level-generation and balance modules the game ships with
(`generateGatePairs`, `generateObstacles`, `balanceObstaclesForRoute`,
`calculateLevelBalance`, `computeBestRoute`), so the expected optimal crowd
and boss health values are the shipped values, not estimates.

For each level the driver:

1. computed the optimal gate side for all ten gate pairs and the safe side
   for every avoidable obstacle from the shipped modules;
2. steered with the game's keyboard controls (ArrowLeft/ArrowRight) through
   the real game loop, taking mandatory enemy damage where the balance model
   requires it;
3. stopped the boss timing meter through its button;
4. fought the boss with the surviving crowd and finished the level.

The campaign result, captured per level with screenshots, records WIN for
every published difficulty and level, with the observed boss health matching
the computed `bossHealth` value (for example, Easy Level 1: boss slain 79
against a computed boss health of 79). Frame-rate samples were collected
during each run from a desktop browser; they do not represent physical-device
performance, which remains open in issue #1.

## Outstanding items

See issue #1 for the open verification items: hosted deployment, production
password-reset email, human peer-acceptance sessions, physical-device
performance measurement, offline/second-client manual checks and formal
accessibility and security reviews.

## Additional checks (21 September 2026, evening)

- Accessibility: an axe-core scan of the authentication, home and gameplay
  screens using the WCAG 2.0 and 2.1 A and AA rule sets reported one violation
  (a viewport meta tag that disabled zooming, WCAG 1.4.4). The tag was fixed in
  pull request #4 and a repeat scan reports zero violations. Gameplay gestures
  remain protected by the existing touch-action rule.
- Second-client restoration: an account registered in one browser context and
  logged in from an independent context returned the identical player id,
  display name and coin balance in both sessions.
- Playthrough campaign: all twenty published levels (four difficulties, five
  levels each) were won by the scripted driver using the shipped optimal
  routes; the observed boss health matched the computed value in every level,
  and the frame-rate sampler averaged 138-142 FPS in a desktop browser with
  the reduced-effects configuration (not a physical-device measurement).
- Repository workflow: issue #1 tracks open items; pull requests #2 (this
  document), #3 (development-only telemetry hook) and #4 (accessibility fix)
  were reviewed and merged.

A ready-to-run human peer-session task sheet accompanies the assignment
evidence; human peer sessions, physical-device performance, hosted deployment,
production email delivery, offline manual checks and formal security review
remain open in issue #1.
