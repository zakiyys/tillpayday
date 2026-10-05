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

## Open problems

- none yet
