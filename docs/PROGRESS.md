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
| 7 Manual onboarding and demo mode | done |
| 8 AI input | done |
| 9 AI onboarding | done |
| 10 Statement import | done |
| 11 PWA | done |
| 12 Dashboard and extras | done |
| 13 Two-person mode | done |
| 14 Hardening and docs | done |

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

### Stage 6: Debts, investments, currency (done)

- Debts (`src/server/ledger/debts.ts`): borrow/lend/repay/repaid as transfers to per-counterparty RECEIVABLE or
  PERSONAL_DEBT accounts created on first use; split bill (own share EXPENSE, rest receivable); loan payments split
  into principal and interest when terms exist; installment purchases (stage 5 service) from the Debts page.
- Investments (`assets.ts`): asset types as data (create/edit/delete), holdings, buy/sell with weighted average cost
  and realised P&L, unit size (lots), manual prices with staleness flag, valuation for units x price, principal plus
  interest and appraised; P&L split into price and FX parts for foreign holdings. Deleting a trade replays the
  holding. `PriceProvider` and `FxProvider` interfaces exist with no providers registered (no verified source).
- Currency: reference rates and currencies in Settings, net worth valued at the latest rate, base amounts kept.
- Trips: active trip tags expenses, keeps them out of the allowance and reduces the linked goal; refill transfer offer.
- Pages: Debts, Investments, Trips, Settings index, Settings > Currencies and rates.
- Tests: integration for scenarios 3, 4, 5, 7, 8, 11 through the services, loan split, trips; e2e with axe/overflow.
  Fixed: a horizontally scrolling table leaked width to the page (sr-only header text); scroll regions are now
  `relative`.

### Stage 7: Manual onboarding and demo mode (done)

- `/onboarding` offers the manual wizard, the AI path (stage 9) and demo data. The wizard walks the SPEC 9.2 topics
  (basics, payday, bank accounts, wallets and cash, cards and debts, investments, recurring bills, goals) with a
  per-topic progress list; every step saves the draft (`OnboardingDraft`), nothing else is written until the
  summary is confirmed. Commit creates accounts (opening balances, default per institution), a salary Recurring
  that opens periods, bill Recurrings, goals and holdings, then runs the first sync.
- Drafts that contain something like a PIN, password or full card number (Luhn check) are refused.
- Demo mode: `POST /api/v1/onboarding/demo` or `npm run db:seed-demo -- <owner e-mail>`; generic names, fixed seed,
  three months of history, card installment, split, loan to a friend, holdings, a yen account.
- Tests: integration (commit, topic order, secret refusal, demo data), e2e (skip all steps, confirm, land on home).

### Stage 8: AI input (done)

- Local parser (`src/domain/parse.ts`): amounts with k/rb/jt/juta, Indonesian separators, plain-number thousands,
  relative dates, currency words, account by alias/name/last4/institution default, multi-entry sentences,
  category hints; complex sentences are handed to the model.
- `LlmProvider` with the OpenAI chat-completions adapter (verified against the official API reference via
  context7: `response_format` `json_schema` strict, `image_url` data URL parts), timeout, fallback provider,
  connection test recording structured-output and vision capabilities. Keys AES-GCM encrypted, shown masked,
  never logged; saving needs owner + reauth; test is rate limited.
- Action schema (SPEC 7.3) validated with Zod; invalid actions dropped. Resolution to real accounts, categories,
  holdings, bills and counterparties; questions with option buttons when something is missing (never guessed);
  non-own recipients always ask what the transfer was. Query functions (spend by category, account balance, goal
  progress, balance projection, purchase and goal simulations) answer with numbers from code only.
- Confirm re-validates every proposal and saves through the same services as manual entry (`via` AI/API in the
  audit log). Corrections can be remembered as Rules.
- AI down: simple patterns still work, complex text opens the prefilled manual form, photos become PENDING_AI
  drafts processed by the worker (`process-drafts`) with a DRAFT_READY notification.
- Uploads: magic-byte sniffing, 10 MB limit, EXIF/XMP/text chunks stripped, stored outside the web root, served
  only through a session-checked route. Offline queue in IndexedDB (`src/lib/offline-queue.ts`).
- Pages: Record (conversation per SPEC 12.3, cards, chips, questions, saved state, date separators), input bar on
  every page, Settings > AI (with what is sent to the provider).
- Tests: unit (parser), integration with a mock model (scenarios 15 to 20, rules), e2e against a mock
  OpenAI-compatible HTTP server on 127.0.0.1:3071 (real adapter path), axe checks and screenshots.

### Stage 9: AI onboarding (done)

- `src/server/ai/interview.ts`: connect (endpoint, key, model; saved with reauth), connection test, consent screen
  showing what is sent, then one question per turn. Code keeps the topic list, order and status; the model only
  returns a patch for the current topic, which is validated with the manual form's Zod schema (patches for other
  topics are ignored). Skips are handled by code without calling the model.
- Secrets (card numbers via Luhn, PIN/password words) are refused before the model call and never stored.
- Model down: the draft stays; the user continues in the manual wizard from the same draft at any time
  (button in the side panel, error notice, or the done screen). Desktop shows the draft beside the chat;
  phones open it as a sheet. Per-topic progress list.
- Tests: integration (order owned by code, cross-topic patch ignored, skip without model, secret refusal,
  model down keeps draft, consent required); e2e through the mock HTTP model server.

### Stage 10: Statement import (done)

- `src/domain/statement.ts`: RFC 4180 CSV with delimiter detection, column mapping (signed amount, debit/credit,
  or amount + DB/CR marker, balance), date formats incl. Indonesian month names, statement money cells, mapping
  guess from headers, account detection by account number vs `last4`.
- `src/server/import/statements.ts`: batch per upload (CSV by code with the mapping saved per account; PDF/image
  read by the model with a Zod-checked row schema), duplicate matching (account, amount, direction, +/- 2 days,
  not paired before; one candidate auto, several = user chooses), estimated FX rows updated to the statement amount,
  unpaid bills suggested for new rows, rows already imported earlier skipped, own transfers paired across batches
  into one TRANSFER, commit through the ledger services (`via` IMPORT), then a balance check against the closing
  balance.
- Page: Import (account or auto-detect, file, mapping editor, review list with matched/new/transfer, choose,
  category, skip, commit, history with resume).
- Tests: integration for scenarios 12, 21 (incl. re-import of the same file), 22 and account detection; e2e.

### Stage 11: PWA (done)

- `src/app/manifest.ts`: standalone, icons (192, 512, maskable; generated by `scripts/make-icons.mjs`),
  Web Share Target (text, URL, images, PDF) posting to `/share-target`, which stores an IngestDraft and opens Record.
- `public/sw.js`: caches only static files (Next static chunks, fonts, icons); pages and `/api/*` are never stored,
  so nothing financial persists after logout. Logout also clears caches, the offline queue and session storage.
  Background Sync tag `ingest-queue` asks open pages to flush; otherwise the queue flushes on open/online.
- API tokens: hashed, scoped (INGEST, SUMMARY_READ), shown once, revocable, creation needs reauth.
  `POST /api/v1/ingest` with an INGEST token stores a draft (iPhone Shortcut guide in Settings > API tokens);
  `GET /api/v1/summary` with SUMMARY_READ returns the four figures only.
- Web Push with VAPID (`src/server/push.ts`) hooked into `notify()`; subscriptions per device, gone ones removed;
  push texts carry no amounts. Settings > Notifications: push on/off, per-kind toggles, recap day/hour, inbox.
- Tests: e2e scenario 25 (scopes both ways, hash-only storage, revoke), token ingest draft, manifest, service
  worker cache contents after visiting data pages, share target POST.

### Stage 12: Dashboard and extras (done)

- Dashboard (SPEC 12.3): quick entry, four cards (safe today on the accent card, net worth with change since last
  period, cashflow, savings rate marked provisional plus last closed period), income/expense chart for six periods
  with a table equivalent, budgets, accounts by group, goals, net worth trend, balance projection 30/60/90 days with
  lowest point and first negative date, category trend, simulation form, investments, recent transactions.
  Charts are SVG with titles/descriptions, axis labels, focusable points with values on hover/focus, outlined
  expense bars (not colour only).
- SPEC 11: weekly recap (worker job at the chosen day/hour, template text or model text that may not invent numbers;
  Recap page with archive), notifications job (bills and cards due, budget near/over, day without entries, stale
  prices, warranties, over-allocation; deduplicated, opt-out per kind), rules page, projection, simulations,
  emergency months, subscription detection, year-end list (CSV and printable page, holdings at cost, no tax),
  warranty date on attachments, summary endpoint, full export (JSON, CSV per table, no secrets, CSV-injection safe)
  and re-import into an empty household with id remapping.
- Settings: Household (all SPEC 2.2 defaults editable: payday, allowance unit, auto-save limit, leftover handling,
  net worth view), Categories and rules (add, rename, merge, delete unused, remove rules), Appearance (language,
  theme, accent per device), Backup and export.
- Implemented SPEC 2.2 behaviours: auto-save of small complete expenses (off by default), leftover carry-over.
- Tests: integration (dashboard figures, recap template, notification dedupe and opt-out, year-end cost, export and
  import round trip with equal balances and no secrets, carry-over, auto-save); e2e with axe and overflow checks.
  Fixed: grid items with wide tables stretched columns (`min-w-0` on cards), axe `aria-prohibited-attr` on chart
  points.

### Stage 13: Two-person mode (done)

- Invitations (`src/server/auth/invite.ts`): owner + reauth creates a single-use link (hash stored, 7 days),
  `/invite/[token]` creates a MEMBER with password, then offers a passkey. Registration stays closed otherwise.
- Members list with remove (revokes sessions, tokens, push, passkeys; records stay). Pending invites revocable.
- Visibility: accounts PRIVATE/SHARED (existing scopes), drafts and notifications per member, attachments limited to
  the uploader or members who can see the linked transaction, owner-only routes refuse members.
  Net worth view setting (own+shared or whole household) changes only the total.
- Tests: integration (single use, expiry, sign-in, privacy of accounts/transactions/attachments, net worth view,
  removal); e2e scenario 24 through pages and API with a second browser context.


### Stage 14: Hardening and docs (done)

- Encrypted backups (`scripts/backup.ts`, AES-256-GCM, scrypt key from `BACKUP_ENCRYPTION_KEY`), daily worker job,
  backup before every migration, `scripts/restore.ts` (refuses non-empty targets without `--yes`, verifies the GCM
  tag before anything reaches the database). Docker image ships the PostgreSQL 18 client.
- `scripts/gen-secrets.mjs --write` creates `.env` with fresh secrets without any npm install (runs in a bare Node
  container). Docker build and runtime fixed for the SWC native addon cache.
- Rate-limit client address taken from the proxy-appended `X-Forwarded-For` entry; document title rendered in the
  shell (axe `document-title` in production); card statements bill only installment portions due.
- README (English) and README.id.md, SECURITY.md, CONTRIBUTING.md, CHANGELOG.md, deploy examples (Caddy, nginx,
  systemd, PM2) in `docs/deploy/`. Screenshots with demo data in `docs/screenshots/` (24 pages x 390/1360 x light/dark).
- CI: pg 18 client, migrations for the test DB, full-history checkout for the repo scan test.

## Open problems

- Lint has 5 warnings, all `window.location.assign` after sign-in/sign-out/setup; deliberate full reloads
  (docs/DECISIONS.md 14). No lint errors.
- CI runs lint, typecheck, unit and integration tests, build and both scans, but not the Playwright e2e suite or the
  Compose install test (they were run locally). CI has never run on GitHub: by instruction there is no remote.

## Final report

### What was built

A self-hosted personal finance PWA (Next.js 16, PostgreSQL 18 via Prisma 7, pg-boss worker) covering every part of
SPEC.md: account-based ledger with integer money, payday periods and the daily/weekly safe-to-spend figure, budgets,
recurring entries and bills, card statements and installments, goals with allocations, debts/receivables/splits/loans,
investments with average cost and price/FX P&L, multi-currency, trips, balance checks, the AI input bar (local parser
first, OpenAI-compatible adapter, strict action schema, confirmation cards, questions, rules, query functions,
simulations, full no-AI fallback), CSV/PDF statement import with duplicate matching and transfer pairing, manual and
AI-assisted onboarding, demo mode, PWA (offline queue, share target, iPhone Shortcut endpoint, Web Push), dashboard,
projection, weekly recap, notifications, subscription detection, year-end list, export/import, two-person mode,
passkeys + password/TOTP + recovery codes, scoped API tokens, audit log, encrypted backups with restore, Docker
Compose install, bilingual UI (id/en), light/dark themes with four accents.

Test totals at the end: 136 unit + integration tests (19 files) pass; 20 Playwright e2e tests pass against the
production build; the Compose install test passes on a fresh clone; production build exit 0; typecheck clean;
gitleaks and the private-details scan are clean over the full history (18+ commits).

### Scenarios (SPEC 16)

| # | Result | Evidence and notes |
| --- | --- | --- |
| 1 | PASS | unit `domain-scenarios` (230.000 / 167.000 / 4.537.000); also through the real services in `periods.test`. |
| 2 | PASS | unit; transfers never change expense, pool or net worth. |
| 3 | PASS | unit and integration `money-flows` (card spend 500.000, payment is a transfer, card back to 0). |
| 4 | PASS | unit and integration (lend and repaid: no income, no expense). |
| 5 | PASS | unit and integration (expense 100.000, receivable 200.000). |
| 6 | PASS | unit and integration (card -12.000.000, allowance unchanged, 1.000.000 bill in the category budget). |
| 7 | PASS | unit and integration (average 150, realised 750, buy is not an expense). |
| 8 | PASS | unit and integration (price change moves net worth only). |
| 9 | PASS | unit and integration (-700 suggests admin fee; balance equals reported; large diff not recorded). |
| 10 | PASS | unit and integration (back-dated entry changes the old period and the balance, not the current pool). |
| 11 | PASS | unit and integration (base amount fixed at the funding rate; current value follows the reference rate). |
| 12 | PASS | unit and integration `import` (estimated amount replaced by the statement amount, no duplicate). |
| 13 | PASS | unit and integration (allocation above balance refused; withdrawal into allocated money asks for goals). |
| 14 | PASS | unit and integration (period starts on the salary date inside the window, else on schedule, flagged). |
| 15 | PASS | integration `ingest` covers every row of the SPEC 7.4 table with a mock model; e2e against a mock HTTP model. Not tested with a real provider (owner question 3). |
| 16 | PASS | unit `parse` and integration: simple patterns produce proposals with zero model calls. |
| 17 | PASS | integration: simple entry saves with the model down, complex text opens a prefilled form, photo queued then processed by the draft job; e2e "record without AI". |
| 18 | PASS | integration: invalid actions dropped by Zod; confirm rejects anything outside the proposal schema; no rows written. |
| 19 | PASS | integration: an obeying model returning injected instructions produces no actions and no rows. |
| 20 | PASS | unit and integration: institution name picks the default of three accounts and the card shows it; without a default the app asks. |
| 21 | PASS | integration (manual entries matched, re-importing the same file adds nothing) and e2e. |
| 22 | PASS | integration: OUT row in one statement and IN row in another become one TRANSFER. |
| 23 | PASS | integration `setup-owner` (wrong/empty token, concurrent claims, closed afterwards) and e2e. |
| 24 | PASS | integration `ledger`, `members` and e2e `10-members` (second member, pages and API). Streamed pages show the not-found UI with HTTP 200 instead of 404 (Next behaviour, DECISIONS 20); no private data is in the response, API returns 404. |
| 25 | PASS | e2e `08-pwa` (SUMMARY_READ cannot ingest, INGEST cannot read, hashes only, revoke). |
| 26 | PASS | e2e `12-security` (401 without session, files not reachable as static paths) and integration for member access. |
| 27 | PASS | unit `env` and integration `startup` (process exits on empty or missing secrets). |
| 28 | PASS | `npm run scan:secrets` over full history clean; also an integration test. |
| 29 | PASS | `npm run scan:private` over full history (files, messages, authors) clean, with owner patterns from `deploy.local/`. |
| 30 | PASS | fresh `git clone`, `gen-secrets.mjs --write` in a bare Node container, `docker compose up -d --build` (unique project, port 3170), then Playwright: setup token, owner, manual setup, first transaction; torn down afterwards. Tested on this machine only, not on another Linux host, and with HTTP on localhost instead of HTTPS. |
| 31 | PASS | e2e `11-demo-all-pages`: demo data, 24 pages render without the error state; integration checks demo plausibility. |
| 32 | PASS | integration `backup`: encrypted dump, restore into an empty database, identical balances; tampered file refused. |
| 33 | PASS | axe (WCAG 2.0/2.1 A and AA rules) clean and no horizontal scroll at 390 px on all 24 pages, plus dialogs in other specs. Automated checks only; full WCAG conformance needs manual testing with assistive technology. |
| 34 | PASS, with a limit | 96 screenshots (24 pages x 2 widths x 2 themes) in `docs/screenshots/`. I reviewed every page as it was built (390 and 1360, light and dark) and fixed what I found; for the final demo set I reviewed a representative sample (home, dashboard, record, budgets, investments, debts, bills, goals, settings), not each of the 96 images individually. |

### Contents of docs/PENDING-OWNER.md

# Waiting for the owner

Temporary values are in place so work continues. Nothing here blocks the build.

| # | Question (spec 18) | Temporary value |
| --- | --- | --- |
| 1 | App name | `APP_NAME=Home Ledger` (working name) |
| 2 | License | No LICENSE file. Repo stays private. |
| 3 | Model provider you use yourself | Tests use a mock OpenAI-compatible model. The real provider must be tested before AI input counts as done for your install. |
| 4 | Deploy details (domain, proxy, backup location) | Only generic examples in the repo. Your details go in `deploy.local/` (gitignored). Local runs use 127.0.0.1:3070. |
| 5 | When to make the repo public | Not public. Before publishing, rerun `npm run scan:secrets` and `npm run scan:private` on the full history. |
| 6 | Section 11 features to drop | None dropped; all are being built. |

### Other honest limits

- Passkeys are tested with Chromium's virtual authenticator, not on physical phones. Web Push sending is wired and
  subscriptions are stored, but no real push service delivery was tested. Background Sync and the iPhone Shortcut
  were not tried on devices.
- No automatic price or FX provider ships (no verified source); interfaces exist and prices/rates are manual.
- CSP allows `'unsafe-inline'` scripts because of Next.js bootstrap scripts (DECISIONS 7).

### How to run

Docker Compose (main path):

```sh
git clone <repository> home-ledger && cd home-ledger
docker run --rm -v "$PWD":/w -w /w -u "$(id -u):$(id -g)" node:22-alpine node scripts/gen-secrets.mjs --write
# set PUBLIC_URL in .env to the HTTPS address behind your reverse proxy
docker compose up -d --build
# open PUBLIC_URL, enter SETUP_TOKEN from .env, create the owner, finish setup
```

Development and tests on this machine:

```sh
npm ci
npm run db:migrate                       # dev database from .env
npm run dev                              # http://127.0.0.1:3070
npm run worker                           # background jobs
npm run test:unit && npm run test:int    # integration uses TEST_DATABASE_URL
node_modules/.bin/next build && E2E_PROD=1 node_modules/.bin/playwright test
npm run scan:secrets && npm run scan:private
npm run backup                           # encrypted dump into DATA_DIR/backups
npm run restore -- <file.dump.enc> --target <empty database url>
npm run db:seed-demo -- <owner e-mail>   # demo data into an empty household
```

## Design fix round 1

Scope: the 7 findings in the design review, nothing else.

- **A. /investments at 390 px.** `src/app/(app)/investments/page.tsx`: below `md` each holding is a stacked card
  (name, type · symbol · account; units; last price with "updated" date and stale chip; value with base-currency
  equivalent; gain or loss with sign, plus "from price" and "from exchange rate" lines with sign; Buy / Sell /
  Update price as buttons, `min-h-11` = 44 px). The table stays from `md` up. Price text and action buttons are
  shared helpers so both layouts render the same figures.
- **B. /reports/year-end at 390 px.** `src/app/(app)/reports/year-end/page.tsx`: the 5-column `min-w-[520px]` table
  is now 2 columns: name with type and units underneath, and amount with the base-currency amount underneath
  (`whitespace-nowrap`). No horizontal scroll container any more. Print uses the same markup; the existing print
  CSS (hide navigation) is unchanged.
- **C. /accounts subtitle.** `src/app/(app)/accounts/page.tsx`: subtitle uses `line-clamp-2` instead of `truncate`,
  so "Bank A · Belum pernah dicocokkan" wraps to a second line.
- **D. /settings/appearance accent.** `src/components/settings/appearance.tsx`: the chosen accent shows a lucide
  `Check` icon and heavier label text. The control is a native `<input type="radio">`, which already exposes the
  checked state to assistive technology; `aria-checked`/`aria-pressed` were not added because ARIA in HTML forbids
  them on a native radio (axe flags it). Selection is no longer colour/border only.
- **E. /settings/security destructive actions.** `src/components/settings/security.tsx`: revoke session and
  regenerate recovery codes use `btn.danger`; remove passkey (icon button) uses the same warning border and text.
  Disable TOTP already used `btn.danger`. `btn.danger` uses the `--warning` token (`#A3410A` light, `#F0A06A`
  dark). All four still go through `reauth`.
- **F. /budgets near/over states.** `src/server/onboarding/demo.ts`: after seeding, the demo sets budgets for the
  current period from actual spend: the biggest spender at about 92% (NEAR), the second at about 115% (OVER),
  the rest at about 67% (OK). Verified on the e2e demo household: one OVER, one NEAR, five OK. Each card already
  shows a text label next to the bar ("Aman" / "Hampir habis" / "Lewat batas"), so no UI change was needed.
  Data stays fictitious.
- **G. Dashboard trend chart x labels.** Measured with Playwright using the app font: the last label centred at
  x = 548 in a 560-wide viewBox spans about 526 to 570, so it clips. The SVG scales uniformly, so this happens at
  1360 and at 390. `src/components/charts.tsx`: the first label is anchored `start`, the last `end`, and the others
  stay `middle`.

Verification (after the changes):
- `npm run lint`: 0 errors, 5 warnings (all existing `window.location.assign` warnings, not from this round).
- `npm run typecheck`: clean.
- `npm test` (unit + integration): 19 files, 136/136 passed.
- `npm run build`: succeeded.
- `E2E_PROD=1 npm run test:e2e`: 20/20 passed (includes axe and the 390 px no-horizontal-scroll check on every
  demo page).
- Screenshots: the 96 files in `docs/screenshots/` were regenerated by `11-demo-all-pages.spec.ts` in that run.
  They have not been reviewed here; the owner's assistant reviews them.
- `npm run scan:secrets`: no leaks. `npm run scan:private`: clean (full history).
- Commits: b74af98, 1504e1c, 93da654, 3739e21, 47b7cff, plus this progress note.
- Nothing is failing.
