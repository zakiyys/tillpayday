# Changelog

All notable changes are listed here. Versions follow [Semantic Versioning](https://semver.org/).

## [1.0.0] - 2026-10-06

### Added

- Accounts of every type with balances computed from transactions; transfers as one row with two sides; soft delete
  with restore; audit log for every financial change.
- Periods that follow payday, daily or weekly allowance, budgets with suggestions, recurring entries and bills,
  card statements, installment plans, goals with allocations, emergency fund in months.
- Debts and receivables per person, split bills, loans with principal and interest, balance checks.
- Investments with weighted average cost, realised and unrealised gain, price/FX split; asset types as data.
- Multiple currencies with a base currency and reference rates; trip mode.
- Input bar with a local parser, an OpenAI-compatible model adapter, confirmation cards, clarifying questions,
  rules from corrections, query functions and simulations; full manual fallback without AI.
- Receipt photos with a note ("I only bought the fried rice, add the tax"): the model reads the lines, the app works out
  your share of tax, service and discount, and the card shows the breakdown.
- Chat shortcut and a real photo picker in the input bar on every page.
- Statement import (CSV mapping, PDF through the model) with duplicate matching and transfer pairing.
- Manual and AI-assisted onboarding; demo mode.
- PWA: install, offline queue, Android share target, ingest endpoint for iPhone Shortcuts, Web Push.
- Dashboard, projection, weekly recap, notifications, subscription detection, year-end list, export and import.
- Two-person mode with invitations and private or shared accounts.
- Passkeys with password + TOTP backup, recovery codes, device sessions, rate limits, re-authentication for
  sensitive actions, API tokens with scopes.
- Docker Compose install, encrypted daily backups with a tested restore, CI with secret and private-detail scans.

### Fixed

- Loans and receivables written in plain sentences ("lent 1.1jt to Didit") are recorded instead of answering
  "nothing to record": model output is normalised before validation and a sentence with a clear amount falls back
  to the prefilled manual form.
- Date filters on the Transactions page no longer overflow their column on phones.
