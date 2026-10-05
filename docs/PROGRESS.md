# Progress

Resume rule: read this file first, then `docs/DECISIONS.md`. Stages follow SPEC section 17.

## Status

| Stage | Status |
| --- | --- |
| 1 Foundation | done |
| 2 Ledger core | done |
| 3 Auth and first install | done |
| 4 Manual recording | done |
| 5 Periods and home | done |
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

### Stage 2: Ledger core (done)

- Pure functions in `src/domain/`: `dates` (UTC day arithmetic, no DST drift), `money` (bigint minor units,
  decimal.js for rates/units, floor division, locale formatting), `ledger` (effects per type, balances, net worth,
  cashflow, savings rate), `period` (payday rule, +/- 5 day salary window, period bounds), `allowance` (pool,
  daily and weekly allowance, sanity check), `budget` (category spend with installment portions, 85/100 status,
  suggestions), `goals` (allocations, withdrawals that force a goal choice, reach date, emergency months),
  `assets` (weighted average cost, realized and unrealized P&L, price vs FX split, valuation modes),
  `fx` (weighted inflow rate, base amount selection), `reconcile` (balance check proposals, repeating fees),
  `matching` (statement rows, transfer pairing, bill matching), `split` (split bill, loan split, annuity,
  installment schedule).
- Tests written first: `tests/unit/domain-scenarios.test.ts` covers scenarios 1 to 14 (one describe each),
  `tests/unit/domain-helpers.test.ts` covers edge cases. 53 unit tests pass.

### Stage 3: Auth and first install (done)

- Owner creation only with `SETUP_TOKEN` (advisory lock prevents two concurrent claims), registration closed after.
- Passkeys (SimpleWebAuthn 14), password (argon2id) + TOTP (encrypted secret), 10 one-time recovery codes,
  DB sessions with device list and per-session revoke, new-device notification, rate limits with escalating lockout,
  reauth window (10 min) for sensitive actions with a client `ReauthProvider` that retries after confirmation.
- Pages: `/setup`, `/login`, `/settings/security`; app shell with sidebar (desktop) and bottom tabs + menu sheet (phone).
- i18n messages split per namespace in `messages/<locale>/<ns>.json`.
- Tests: integration scenario 23; Playwright e2e with a Chromium virtual authenticator (setup, passkey register,
  passkey login, password login, CSRF block). Screenshots of login and security reviewed at 390/1360, light/dark.

### Stage 4: Manual recording (done)

- Services in `src/server/ledger/`: accounts (opening balance as an OPENING transaction, debts typed positive are
  stored negative, one default per institution), transactions (create/edit/soft delete/restore, baseAmount via FX
  rules, hooks for later stages), categories (create/edit/merge/delete), reconcile (cek saldo, SPEC 5.6).
- Every query goes through `accountScope`/`txScope` (household + visibility). Every change writes AuditLog with `via`.
- API: `/api/v1/accounts`, `/api/v1/accounts/:id`, `/api/v1/accounts/:id/reconcile`, `/api/v1/transactions`,
  `/api/v1/transactions/:id`, `/api/v1/transactions/:id/restore`, `/api/v1/categories`, `.../merge`.
- Pages: Accounts (grouped by type, base-currency total, archive), account detail (balance, limit left,
  transactions, cek saldo dialog), Transactions (filters for account, category, date range, type, source, member;
  search; deleted view with restore; undo after delete). Rows open the edit sheet on phones.
- Tests: integration (balances, soft delete/restore, audit trail, input validation, household isolation,
  scenario 24 service level, scenario 9 service level, category merge); e2e with axe and 390 px overflow check.
  Screenshots reviewed: long transfer titles wrapped instead of truncating, row actions moved into the sheet on phones.

### Stage 5: Periods and home (done)

- `syncHousehold` (src/server/ledger/periods.ts) brings a household up to date: Period rows from the payday rule
  and recorded salaries, Recurring bills and AUTO_POST transactions, installment portion bills, card statement
  bills (owed balance on the statement day), goal contribution bills and AUTO goal transfers. Every generated row
  has a unique key (`Bill.key`, `Transaction.genKey`), so reruns never duplicate. Runs from the worker hourly and
  on page load when the household changed (throttled per process).
- Hooks on recording: payments matching an unpaid bill mark it paid (no double count against the allowance),
  goal deposits raise allocations, trip expenses are tagged (used in stage 6).
- Worker: `src/server/worker/main.ts` (pg-boss 12, own `pgboss` schema), job registry in `jobs.ts`.
- Pages: Home (hero card per SPEC 12.3, two small cards, recent list, notices for missing salary, sanity check,
  extra income, leftover near period end, drafts), Budgets (per category with 85/100 status, suggestions from the
  last two periods, history), Bills and recurring (pay, skip, recurring CRUD with four schedule kinds, detected
  subscriptions), Goals (progress, reach date, emergency months, allocations, deposit, set aside, withdraw that
  asks which goal gives up money).
- Tests: unit (schedules, subscriptions), integration (SPEC 6.2 figures through the real services, idempotent sync,
  scenarios 6, 10, 13, 14 at service level, auto-post once, card statements), e2e with axe and screenshots.

## Open problems

- none yet
