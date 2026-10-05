# Progress

Resume rule: read this file first, then `docs/DECISIONS.md`. Stages follow SPEC section 17.

## Status

| Stage | Status |
| --- | --- |
| 1 Foundation | done |
| 2 Ledger core | not started |
| 3 Auth and first install | not started |
| 4 Manual recording | not started |
| 5 Periods and home | not started |
| 6 Debt, investments, currency | not started |
| 7 Manual onboarding and demo mode | not started |
| 8 AI input | not started |
| 9 AI onboarding | not started |
| 10 Statement import | not started |
| 11 PWA | not started |
| 12 Dashboard and extras | not started |
| 13 Two-person mode | not started |
| 14 Hardening and docs | not started |

## Design skills applied

Read in full before any UI: taste-skill, gpt-tasteskill, minimalist-skill, redesign-skill, stitch-skill, antislop
(core), antislop-ui, antislop-human, antislop-layoutmobile, antislop-copywriting, antislop-code, design-md,
claude-design, webapp-acceptance-testing, dogfood. Where a skill conflicts with SPEC 12 (for example gpt-taste's
GSAP motion, minimalist's serif headings, landing-page hero rules) SPEC 12 wins: this is a Monitor/Operate tool,
dial ENERGY 1 / RHYTHM 2 / MOTION 1.

## Stage reports

### Stage 1: Foundation (done)

- `.gitignore` was the first commit. Local git identity set for this repo only. No remote.
- gitleaks 8.30.1 in `.tools/` (gitignored, `scripts/install-gitleaks.sh`), pre-commit hook in `.githooks/`
  (wired by `npm install` via `core.hooksPath`) running gitleaks on staged changes plus the private-details scan.
- `scripts/scan-private.mjs`: scans full history (files, commit messages, author fields) for IPs, server paths,
  unknown host names, e-mail addresses and owner patterns from `deploy.local/private-patterns.txt`.
- CI (`.github/workflows/ci.yml`): secret scan, private scan, lint, typecheck, unit, integration (Postgres
  service), build. No deploy, no server access.
- Env validation with Zod (`src/server/env.ts`), enforced in `instrumentation.ts` and `scripts/check-env.ts`.
  `npm run secrets` prints fresh secrets and a VAPID pair.
- Prisma 7 schema with every entity from SPEC 4 plus auth support tables (Passkey, RecoveryCode, AuthChallenge,
  RateLimit, Invite, WeeklyRecap, OnboardingDraft). First migration applied to dev and test DBs.
- Docker Compose (db, app, worker), Dockerfile, start scripts (backup then migrate on start).
- Design system: `DESIGN.md` in design-md format (lint: 0 errors, 0 warnings), tokens in `src/app/globals.css`
  for light, dark and four accent options. Every text pair contrast-checked with the WCAG formula.
  Plus Jakarta Sans self-hosted from the Fontsource package with its OFL licence file.
- Tests: env validation unit tests, process-level startup refusal test (scenario 27).

## Open problems

- none yet
