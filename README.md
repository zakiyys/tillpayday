# TillPayDay

> **Every day, one number: how much is still safe to spend until payday.**

A personal finance app you run on your own server. One person or a couple tracks income, spending, transfers,
savings, debts and investments, and the home screen answers one question: how much is safe to spend today.

`TillPayDay` is a working name; set your own with `APP_NAME`.

Bahasa Indonesia: [README.id.md](README.id.md)

<p align="center">
  <img src="docs/illustrations/readme-hero.png" alt="TillPayDay on a phone and on a desktop" width="880">
</p>

## Bloat cat says hi 🐈

<p align="center">
  <img src="docs/illustrations/blotcat-lean.png" alt="Blotcat weighing features on a scale and cutting the heavy ones" width="760">
</p>

```
   /\_/\     welcome to the
  ( o.o )    bloat zone
   > ^ <     ~~~~~~~~~~
```

Somewhere in the budget, between the coffee line item and the emergency fund, lives a small cat. It does not
pay rent. It does not do your taxes. It simply sits on the spreadsheet and judges your subscription stack.

We wrote this app to be lean: no Redis, no microservice zoo, no telemetry phoning home, no 40-megabyte
dashboard to render one number. The bloat cat was invited anyway. It has opinions about your third streaming
service, and honestly, it is right.

If you enjoy software that does one thing well, the bloat cat is on your side. If you enjoy software that
needs a Kubernetes cluster to open a ledger, the bloat cat is still on your side, it is just laughing a little.

**Bloat cat's three rules:**
1. If it does not earn, spend, save, or move money, it does not belong in the critical path.
2. Every feature must survive one honest question: *"would the owner actually open this on a Tuesday?"*
3. Nap first. Optimise later.

## Features

<p align="center">
  <img src="docs/illustrations/blotcat-payday.png" alt="Blotcat pouring payday money into equal small cups, with today's cup lit up" width="760">
</p>

- **One input bar.** Type `coffee 25k wallet`, send a receipt photo or share a screenshot. Simple entries are read
  by the server without any AI. Harder ones go to a model you configure. You always see a confirmation
  card first, and code (never the model) saves and calculates.
- **Safe to spend today.** Periods follow your payday, not the 1st. Salary minus goal savings minus fixed bills is
  your spending money, spread over the days left. Spend less today and tomorrow gets more.
- **Accounts with their own balances**: banks, e-wallets, cash, cards, paylater, loans, money owed to and by people,
  investment accounts. Moving money between them is a transfer, never an expense.
- Credit cards and installments, split bills, loans with principal and interest, balance checks that suggest
  admin fees or interest, recurring entries and bills, budgets with suggestions, goals on top of savings accounts,
  emergency fund in months.
- Investments of any kind (asset types are data): weighted average cost, realised and unrealised gain, gain split
  into price and exchange rate for foreign holdings.
- Multiple currencies with one base currency; historical figures keep the rate of their day.
- Statement import (CSV by column mapping, PDF through the model) with duplicate matching and transfer pairing.
- Dashboard, balance projection, simulations, weekly recap, notifications, subscription detection, year-end list,
  full export and re-import.
- Installable PWA: offline queue, Android share target, iPhone Shortcut endpoint, Web Push.
- Two-person mode: invite a partner; private and shared accounts.
- Works fully without AI. Indonesian and English.

## Stack

Next.js (App Router, TypeScript strict), PostgreSQL with Prisma migrations, Zod at every boundary, pg-boss worker
(no Redis), passkeys (WebAuthn) with password + TOTP as backup, next-intl, Tailwind CSS, Vitest and Playwright.
Money is stored as integer minor units; units and rates use decimal arithmetic.

## Brand

The logo is five bars of equal height with the middle one highlighted: money split evenly per day, the bright bar
is today. The SVG in `public/logo.svg` (and `public/logo-small.svg`, three bars, for 24 px and below) is the single
source. Every raster asset is rendered from it, so the brand can be reproduced when the accent changes:

```sh
npm run gen:icons     # logo.svg + logo-small.svg -> favicon, PWA icons, apple-touch-icon
npm run check:logo    # contrast of the dim bars against the bright bar on every real background
```

The app icon follows the accent the user picks inside the app; the installed PWA icons keep the default accent.
See [DESIGN.md](DESIGN.md) for the palette and type scale.

## Quick install with Docker Compose

Needs Docker with the Compose plugin and a reverse proxy that terminates HTTPS (examples in `docs/deploy/`).

```sh
git clone <this repository> tillpayday
cd tillpayday
docker run --rm -v "$PWD":/w -w /w -u "$(id -u):$(id -g)" node:22-alpine node scripts/gen-secrets.mjs --write
# edit .env: set PUBLIC_URL to the HTTPS address you will open, e.g. https://finance.example.invalid
docker compose up -d --build
```

The app listens on `127.0.0.1:3070` (change `APP_BIND` and `APP_PORT` in `.env`). Point your reverse proxy at it,
open `PUBLIC_URL`, and continue with [First setup](#first-setup).

The stack has three services: `db` (PostgreSQL 18, not exposed outside the Compose network), `app` and `worker`.
Data lives in the volumes `db-data` (database) and `app-data` (attachments and backups).

## Manual install

Needs Node.js 22.12 or newer, PostgreSQL 18 (with `pg_dump`/`pg_restore` of the same major version) and a reverse
proxy for HTTPS.

1. Create a database user and database for the app, reachable only from localhost:
   ```sh
   sudo -u postgres createuser --pwprompt finance
   sudo -u postgres createdb -O finance finance
   ```
2. Install and configure:
   ```sh
   git clone <this repository> tillpayday && cd tillpayday
   npm ci
   node scripts/gen-secrets.mjs --write
   # edit .env: DATABASE_URL, PUBLIC_URL
   npm run db:generate
   npm run db:migrate
   npm run build
   ```
3. Run the app and the worker as services. Examples for systemd and PM2 are in `docs/deploy/`
   (`tillpayday.service.example`, `tillpayday-worker.service.example`, `ecosystem.config.cjs.example`).
4. Configure the reverse proxy (`docs/deploy/Caddyfile.example` or `nginx.conf.example`).

## Environment variables

| Name | Required | Meaning |
| --- | --- | --- |
| `DATABASE_URL` | yes (manual) | PostgreSQL connection. Compose builds it from `POSTGRES_PASSWORD`. |
| `POSTGRES_PASSWORD` | yes (Compose) | Password of the bundled database. |
| `SETUP_TOKEN` | yes | Needed once to create the owner. Keep it private. |
| `SESSION_SECRET` | yes | Signs session data. |
| `DATA_ENCRYPTION_KEY` | yes | Encrypts AI keys and TOTP secrets in the database. |
| `BACKUP_ENCRYPTION_KEY` | yes | Encrypts backups. Keep a copy elsewhere: without it backups cannot be restored. |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | yes | Web Push key pair. |
| `PUBLIC_URL` | yes | The HTTPS address users open (passkeys and push depend on it). |
| `DATA_DIR` | yes | Folder for attachments and backups, outside the web root. |
| `APP_NAME` | yes | Name shown in the app. |
| `BACKUP_COPY_DIR` | no | A second folder that receives a copy of every backup. |
| `BACKUP_KEEP` | no | Number of daily backups to keep (default 14). |
| `APP_BIND`, `APP_PORT` | no | Compose only: host address and port (default `127.0.0.1:3070`). |

`node scripts/gen-secrets.mjs --write` creates `.env` from `.env.example` with fresh random values. The app refuses
to start when a secret is missing, short or a placeholder. Never commit `.env`.

## First setup

1. Open `PUBLIC_URL`. With no owner yet, the app shows only the setup screen.
2. Enter the `SETUP_TOKEN` from `.env`, your name, e-mail and a backup password. Save the recovery codes.
3. Add a passkey (fingerprint, face or device PIN). After this, sign-up is closed; others join by invitation.
4. Choose how to set up: fill in a short form per step, let an AI model interview you, or load sample data to
   look around. Nothing is saved until you confirm the summary.
5. Record a first transaction in the input bar, for example `coffee 25k`.

## Updating

```sh
git pull
docker compose up -d --build     # or for a manual install: npm ci && npm run build, then restart both services
```

On start the app makes a backup, then applies pending database migrations. Migrations never drop data without an
explicit step.

## Backup and restore

- The worker writes an encrypted backup every day to `DATA_DIR/backups` (and to `BACKUP_COPY_DIR` if set), keeping
  the newest 14. A backup is also made before every migration.
- On demand: `npm run backup` (manual) or `docker compose exec app node --import tsx scripts/backup.ts`.
- Restore into an empty database:
  ```sh
  npm run restore -- /path/to/backup-<time>.dump.enc --target postgresql://user:***@127.0.0.1:5432/newdb
  ```
  Restore over an existing database (replaces it) by adding `--yes`. With Compose, stop the app and worker first:
  ```sh
  docker compose stop app worker
  docker compose run --rm --no-deps app sh -c 'ls "$DATA_DIR/backups"'
  docker compose run --rm --no-deps app sh -c 'node --import tsx scripts/restore.ts "$DATA_DIR/backups/<file>" --yes'
  docker compose start app worker
  ```
- Backups are AES-256-GCM encrypted with a key derived from `BACKUP_ENCRYPTION_KEY`. A changed or truncated file
  is refused before anything reaches the database.
- Settings > Backup and export downloads all data as JSON or CSV. These exports never contain passwords, keys,
  tokens or attachments.

## Setting up AI (optional)

<p align="center">
  <img src="docs/illustrations/blotcat-input-bar.png" alt="Blotcat pushing a short typed sentence into one round input bar, and a card coming out to confirm" width="760">
</p>

Settings > AI accepts any endpoint compatible with the OpenAI chat-completions format: a hosted provider or a model
on your own machine (for example Ollama or LM Studio, which expose `http://<host>:<port>/v1`). Enter the base URL
ending in `/v1`, the model name and, if needed, a key. The connection test records whether the model supports
structured output and images. A separate model for photos and a fallback provider are optional.

The model only turns text into proposed actions from a fixed list. It cannot read your balances, write to the
database or run queries; amounts and answers come from code. Text inside receipts and documents is treated as data.
Only what you type or attach, plus the names of your accounts and categories, is sent to the provider.

Without AI, simple entries still work, complex sentences open a prefilled form, and photos wait in a queue.

## Using it on a phone

<p align="center">
  <img src="docs/illustrations/readme-dark.png" alt="TillPayDay in dark mode on a phone and on a desktop" width="720">
</p>

- **Android:** open the app in Chrome, menu > Install app. It then appears in the Share menu for text, images and PDF.
- **iPhone:** Safari > Share > Add to Home Screen. iOS does not offer a share target for web apps; Settings > API
  tokens has a step-by-step Shortcut that sends text or photos to `POST /api/v1/ingest` with an INGEST token.
- Push notifications on iPhone work only after the app is added to the Home Screen and opened from there.
- Entries made offline are kept on the device and sent when you are back online.

## Extra access layer (optional)

The app is built to be safe on the open internet on its own (passkeys, rate limits, strict headers, CSRF checks).
If you want another layer, put an identity-aware proxy or a VPN in front of the reverse proxy, for example an
access gateway with single sign-on, client certificates, or a private network such as WireGuard. Keep
`PUBLIC_URL` equal to the address users open, or passkeys stop working. The Android share target and the iPhone
Shortcut need to reach the app through that layer too.

## FAQ

**Does it connect to my bank?** No. It never stores bank credentials and cannot move money. You record entries,
import statements, or share screenshots.

**Can several households share one install?** No. One install is one household of one or two people.

**What leaves my server?** Only what you configure: requests to your AI provider, and backup copies to
`BACKUP_COPY_DIR`. There is no telemetry. Automatic price and exchange-rate sources are not included; prices and
rates are entered by hand unless you add a provider.

**I lost my passkey.** Sign in with your password and authenticator code, or with a recovery code, then add a new
passkey in Settings > Sign-in and devices.

**How do I see it with sample data?** Choose "Try with sample data" during setup, or run
`npm run db:seed-demo -- <owner e-mail>` on a household without transactions.

**Why is there a cat in the README?** See [Bloat cat says hi 🐈](#bloat-cat-says-hi-). It is not a dependency.

## Development

```sh
npm ci
node scripts/gen-secrets.mjs --write   # then set DATABASE_URL and add TEST_DATABASE_URL (a separate database)
npm run db:migrate
npm run dev          # http://127.0.0.1:3070
npm run test:unit
npm run test:int     # needs TEST_DATABASE_URL
npm run test:e2e     # Playwright, uses TEST_DATABASE_URL and a mock AI server
```

See [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md).
Release notes: [CHANGELOG.md](CHANGELOG.md).

## License

MIT. See [LICENSE](LICENSE).
