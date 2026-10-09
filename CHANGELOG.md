# Changelog

All notable changes are listed here. Versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- New look built around the pay period as a row of day cups: an evergreen glaze for the shell and the daily number,
  terracotta for money already spent, ochre for today, in light and dark.
- Day-cup strip on Home and Budget: tap or arrow through the days to see each day's share and spending.
- "Why this number?" under the daily number, and first steps on Home that tick themselves off.
- Bank, e-wallet, paylater and broker logos on accounts, transaction rows, debts and account choices; the account
  form picks the type from tiles and the provider from a logo list.
- Currency symbols (Rp, $, S$, RM, ¥) instead of ISO codes, from the Currency table with built-in fallbacks.
- Text size setting per device (small, normal, large, extra large).
- Quick PIN on trusted devices, with optional auto-lock.
- Grouped navigation: a side rail on desktop, a bottom bar with a raised Record button and a grouped menu on
  phones; grouped settings with icons.
- Clearer pages: a one-line purpose under every title, folded transaction filters, budgets as one list with an edit
  mode, bills with due-date tiles and status labels, goals that explain deposit versus allocate, a record screen
  that walks through type, check and save and marks cards that are not saved yet.

### Fixed

- The Backup and export page (`/settings/data`) was missing from the repository because `.gitignore` also matched it.
- The input bar split "1,5jt" on its decimal comma and "jumat lalu" on "lalu", missed the ",-" suffix, kept "pagi"
  from "tadi pagi" in the description and booked a top-up as spending.
- Investment prices showed the ISO code instead of the currency symbol.
- Bills listed paid ones before unpaid ones.
- Goal reach dates in another year now show the year; emergency-fund months use the local decimal separator.
- Money inputs showed ungrouped amounts ("3805000").
- Signing in again left the replaced session valid.
- Chart labels shrank to about 7 px on phones.

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
