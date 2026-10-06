<p align="center">
  <img src="public/icons/icon-192.png" alt="TillPayDay logo" width="96" height="96">
</p>

<h1 align="center">TillPayDay</h1>

<p align="center">
  <b>One number a day: how much you can still spend until payday.</b><br>
  A self-hosted personal finance app for one person or a couple. Your server, your data, no bank logins.
</p>

<p align="center">
  <a href="https://github.com/zakiyys/tillpayday/actions/workflows/ci.yml"><img src="https://github.com/zakiyys/tillpayday/actions/workflows/ci.yml/badge.svg?branch=main" alt="CI"></a>
  <a href="https://github.com/zakiyys/tillpayday/releases"><img src="https://img.shields.io/github/v/release/zakiyys/tillpayday?style=flat-square&color=0B5D4B" alt="Latest release"></a>
  <img src="https://img.shields.io/badge/license-MIT-0B5D4B?style=flat-square" alt="MIT license">
  <img src="https://img.shields.io/badge/self--hosted-your_server-0B5D4B?style=flat-square&logo=docker&logoColor=white" alt="Self-hosted">
  <img src="https://img.shields.io/badge/Next.js-16-0B5D4B?style=flat-square&logo=nextdotjs&logoColor=white" alt="Next.js 16">
  <img src="https://img.shields.io/badge/PostgreSQL-18-0B5D4B?style=flat-square&logo=postgresql&logoColor=white" alt="PostgreSQL 18">
  <img src="https://img.shields.io/badge/Node-%E2%89%A522.12-0B5D4B?style=flat-square&logo=nodedotjs&logoColor=white" alt="Node 22.12 or newer">
  <img src="https://img.shields.io/badge/PWA-installable-0B5D4B?style=flat-square&logo=pwa&logoColor=white" alt="PWA installable">
  <img src="https://img.shields.io/badge/AI-optional-0B5D4B?style=flat-square" alt="AI is optional">
  <img src="https://img.shields.io/badge/bank_logins-none-0B5D4B?style=flat-square" alt="No bank logins">
  <img src="https://img.shields.io/badge/languages-EN_%C2%B7_ID-0B5D4B?style=flat-square" alt="English and Bahasa Indonesia">
  <img src="https://img.shields.io/badge/builder-Miaw-0B5D4B?style=flat-square&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI%2BPHBhdGggZmlsbD0iI2ZmZiIgZmlsbC1ydWxlPSJldmVub2RkIiBkPSJNNCAzbDUgNHEzLS44IDYgMGw1LTQgLjYgOS41cTAgOC04LjYgOFQzLjQgMTIuNXpNNy43IDExLjVhMS4zIDEuMyAwIDEgMCAyLjYgMGExLjMgMS4zIDAgMSAwLTIuNiAwek0xMy43IDExLjVhMS4zIDEuMyAwIDEgMCAyLjYgMGExLjMgMS4zIDAgMSAwLTIuNiAwek0xMiAxNGwxLjQgMS41aC0yLjh6Ii8%2BPC9zdmc%2B" alt="Built by Miaw">
</p>

<p align="center">
  <a href="#install">Install</a> ·
  <a href="#how-it-works">How it works</a> ·
  <a href="#features">Features</a> ·
  <a href="#setting-up-ai-optional">AI setup</a> ·
  <a href="#troubleshooting">Troubleshooting</a> ·
  <a href="README.id.md">Bahasa Indonesia</a>
</p>

<p align="center">
  <img src="docs/illustrations/readme-hero.png" alt="TillPayDay on a phone and on a desktop" width="880">
</p>

## A day with TillPayDay, told by the bloat cat 🐈

<p align="center">
  <img src="docs/illustrations/blotcat-story.gif" alt="Five-frame animation: payday arrives, the money is split into equal daily cups, Blotcat types 'coffee 25k', stamps the confirmation card, and sips coffee next to today's glowing cup" width="760">
</p>

1. **Payday lands.** Your period starts on the day your salary arrives, not on the 1st of the month.
2. **Bills and savings go first.** What is left is split evenly over the days until the next payday.
3. **You type one short line**, like `coffee 25k`, into the input bar. No forms.
4. **You confirm a card.** Nothing is saved until you say so, and code (never the AI) does the maths.
5. **Today's number updates.** Spend less today and tomorrow's share grows. At night the server makes an encrypted backup.

That is the whole idea. Everything else in the app exists to keep that one number honest.

## Contents

- [Who it is for](#who-it-is-for)
- [How it works](#how-it-works)
- [Features](#features)
- [What it is built with](#what-it-is-built-with)
- [Install](#install) (pick your path)
- [First setup](#first-setup)
- [Updating](#updating)
- [Backup and restore](#backup-and-restore)
- [Setting up AI (optional)](#setting-up-ai-optional)
- [Using it on a phone](#using-it-on-a-phone)
- [Security](#security)
- [Troubleshooting](#troubleshooting)
- [FAQ](#faq)
- [Development](#development)

## Who it is for

**A good fit if you:**

- get paid once or twice a month and want to know, every day, whether you are on track;
- want your finances on a machine you control, with no telemetry and no bank credentials anywhere;
- share money with a partner and want shared and private accounts in one place;
- like typing `lunch 40k gopay` more than filling in forms.

**Not a fit if you:**

- need automatic bank sync (it never connects to banks, by design);
- want to run many unrelated households on one install (one install is one household of one or two people);
- need double-entry accounting for a business.

## How it works

### The daily number

Each period runs from one payday to the next. At the start of the period:

```text
spending pool   = income this period - savings for goals - fixed bills
today's share   = (spending pool - what you already spent before today) / days left, including today
safe today      = today's share - what you spent today
```

**A worked example.** Salary IDR 9,000,000 arrives on the 25th. You put 1,500,000 into goals and have 2,500,000 of
fixed bills. That leaves a pool of 5,000,000 for 30 days, so day one gets about **166,000**. Spend 100,000 on day one
and day two gets (5,000,000 - 100,000) / 29 = about **169,000**. Overspend and the next days shrink a little, quietly,
instead of the month blowing up at the end.

Transfers between your own accounts are never counted as spending. Credit card purchases reduce the number on the day
you make them, so paying the card bill later does not count twice.

### From a sentence to a saved transaction

```mermaid
flowchart LR
    A["You type, share a screenshot<br/>or snap a receipt"] --> B{"Simple entry?<br/>e.g. coffee 25k"}
    B -- yes --> C["Local parser on the server<br/>(no AI involved)"]
    B -- no --> D["Your AI model returns proposals<br/>from a fixed list of actions"]
    D --> E["Zod validates every field"]
    C --> F["Confirmation card"]
    E --> F
    F -- "you confirm" --> G["Code writes the transaction,<br/>recomputes balances and the daily number"]
    G --> H["Audit log entry"]
```

The AI never touches your data directly. It can only answer with one of a fixed set of intents (`record_expense`,
`record_transfer`, `split_bill`, `pay_bill`, `asset_buy`, `query`, `clarify` and a few more). It cannot read balances,
run queries or write to the database. When no model is configured, simple entries still work and complex sentences
open a prefilled form.

### What runs where

```mermaid
flowchart TB
    subgraph you["Your devices"]
      P["Phone (installed PWA)"]
      L["Laptop browser"]
      S["iPhone Shortcut / Android share"]
    end
    subgraph server["Your server"]
      RP["Reverse proxy with HTTPS<br/>(Caddy, nginx, Cloudflare Tunnel...)"]
      APP["app: Next.js web + API<br/>127.0.0.1:3070"]
      W["worker: scheduled jobs<br/>(pg-boss)"]
      DB[("PostgreSQL 18")]
      FS[("data folder<br/>attachments + encrypted backups")]
    end
    AI["AI provider (optional)<br/>hosted, or a model on your own machine"]
    P & L & S --> RP --> APP
    APP <--> DB
    W <--> DB
    APP --> FS
    W --> FS
    APP -. "only what you type or attach" .-> AI
```

Three processes, no Redis, no message broker. The **worker** shares the database with the app and runs:

| Job | When | What it does |
| --- | --- | --- |
| `sync-households` | every hour | opens new periods, posts recurring entries, creates bills, card statements and goal contributions |
| `process-drafts` | every 5 minutes | retries photos and documents that were queued while the AI was unavailable |
| `weekly-recap` | hourly check | builds the weekly recap when it is due |
| `notifications` | daily | bill reminders, low daily number, subscription hints (Web Push) |
| `backup` | daily | encrypted `pg_dump`, keeps the newest 14, optional copy to a second folder |

On every start the app checks its environment, makes a backup, then applies pending database migrations before it
serves a single request.

## Features

<p align="center">
  <img src="docs/illustrations/blotcat-payday.png" alt="Blotcat pouring payday money into equal small cups, with today's cup lit up" width="680">
</p>

**Everyday**

- **One input bar** for everything: text, a receipt photo, a shared screenshot or a PDF statement.
- **Receipts with a note.** Pick a photo, add a line like *"I only bought the fried rice, add the tax"*, and the card lists just your items plus your share of tax and service. The model only reads the receipt; the app does the arithmetic.
- **Safe to spend today**, with periods that follow your payday and a daily or weekly allowance.
- **Confirmation cards** before anything is saved; the app learns rules from your corrections.
- **Ask questions** in the same bar: "how much on food this month?", "can I afford a 6 million phone in 3 installments?"

**Money in all its shapes**

- Accounts of every kind: bank, e-wallet, cash, credit card, paylater, loans, investment accounts.
- Transfers as one row with two sides, never as an expense.
- Credit cards with statements and installment plans; paylater.
- Debts and receivables per person, split bills, loans with principal and interest.
- Recurring entries and bills, budgets with suggestions, goals on top of savings accounts, emergency fund in months.
- Investments of any type (asset types are data): weighted average cost, realised and unrealised gain, gain split into
  price and exchange rate for foreign holdings.
- Multiple currencies with one base currency; old figures keep the rate of their day; trip mode for travel.
- Balance checks: tell it what your bank app shows, and it suggests the missing admin fee or interest.

**Seeing the picture**

- Dashboard, balance projection, purchase and goal simulations.
- Weekly recap, notifications, subscription detection, year-end list.
- Statement import: CSV with column mapping, PDF through the model, with duplicate matching and transfer pairing.
- Full export (JSON or CSV) and re-import.

**Living with it**

- Installable PWA with an offline queue, Android share target, an endpoint for iPhone Shortcuts, Web Push.
- Two-person mode: invite a partner, keep private and shared accounts.
- Sign in with passkeys; password plus authenticator code and recovery codes as backup.
- Light and dark theme, your own accent colour, Indonesian and English.
- Works completely without AI.

<p align="center">
  <img src="docs/illustrations/readme-dark.png" alt="TillPayDay in dark mode on a phone and on a desktop" width="680">
</p>

## What it is built with

| Layer | Choice | Why |
| --- | --- | --- |
| Web and API | [Next.js](https://nextjs.org) 16 (App Router), React 19, TypeScript strict | one process serves pages and the JSON API |
| Database | [PostgreSQL](https://www.postgresql.org) 18 with [Prisma](https://www.prisma.io) 7 migrations | 37 tables, every query scoped to a household |
| Background jobs | [pg-boss](https://github.com/timgit/pg-boss) | job queue inside PostgreSQL, so no Redis |
| Validation | [Zod](https://zod.dev) 4 | at every boundary: forms, API, AI output, imports |
| Money | integer minor units (`bigint`), [decimal.js](https://github.com/MikeMcl/decimal.js) for units and rates | no floating point anywhere near money |
| Sign-in | [SimpleWebAuthn](https://simplewebauthn.dev) (passkeys), argon2id passwords, otplib (TOTP) | passkeys first, solid fallbacks |
| UI | Tailwind CSS 4, lucide icons, Plus Jakarta Sans, [next-intl](https://next-intl.dev) | Indonesian and English |
| Phone | Service worker, IndexedDB offline queue (idb), web-push | installable PWA |
| Tests | [Vitest](https://vitest.dev), [Playwright](https://playwright.dev), axe-core | unit, integration against real PostgreSQL, browser end-to-end, accessibility |
| Repo hygiene | gitleaks plus a private-details scan | runs in a pre-commit hook and in CI |

Runtime dependencies are deliberately few: 18 packages in `dependencies`, no ORM plugins, no UI kit, no analytics.

## Install

### Pick your path

Installing is two decisions: **how to run it** and **who can reach it**.

| How to run it | Use | Time |
| --- | --- | --- |
| Any machine with Docker (server, VPS, home box, laptop) | [A. Docker Compose](#a-docker-compose-recommended) | ~10 min |
| Just looking around on your own computer | [B. Try it locally](#b-try-it-on-your-own-computer) | ~5 min |
| A machine without Docker | [D. Manual install](#d-manual-install-no-docker) with systemd or PM2 | ~20 min |
| Plans to change the code | [Development](#development) | ~5 min |

Then pick who can reach it in [C. Choose how to reach it](#c-choose-how-to-reach-it): only this computer, your home
network, only your own devices, or the whole internet, with or without a domain. It is your call; the app works the
same in every case.

**Requirements:** a machine that stays on (1 CPU and 1 GB RAM are plenty for two people, plus about 2 GB disk for
images and data). Passkeys, push notifications and installing on a phone need **HTTPS** or `localhost`.

### A. Docker Compose (recommended)

You need Docker with the Compose plugin and `git`.

```sh
git clone https://github.com/zakiyys/tillpayday.git
cd tillpayday

# 1. Create .env with fresh random secrets (no Node.js needed on the host)
docker run --rm -v "$PWD":/w -w /w -u "$(id -u):$(id -g)" node:22-alpine node scripts/gen-secrets.mjs --write

# 2. Set the address you will open in the browser (see "C. Choose how to reach it")
#    PUBLIC_URL=https://money.example.com   or   PUBLIC_URL=http://localhost:3070
nano .env

# 3. Build and start
docker compose up -d --build
docker compose ps          # db healthy, app and worker up
curl -s http://127.0.0.1:3070/api/health   # {"ok":true}
```

The stack has three services:

| Service | Image | Exposed |
| --- | --- | --- |
| `db` | `postgres:18` | nowhere; only reachable inside the Compose network |
| `app` | built from this repo | `127.0.0.1:3070` (change with `APP_BIND` / `APP_PORT`) |
| `worker` | same image as `app` | nothing |

Data lives in two Docker volumes: `db-data` (the database) and `app-data` (attachments and backups).

Next, decide who can reach it: [C. Choose how to reach it](#c-choose-how-to-reach-it). Then open `PUBLIC_URL` and
continue with [First setup](#first-setup).

> **Want your data in a visible folder instead of a Docker volume?** Create `compose.override.yaml` next to
> `compose.yaml`:
>
> ```yaml
> services:
>   db:
>     volumes: [ "./data/db:/var/lib/postgresql" ]
>   app:
>     volumes: [ "./data/app:/data" ]
>   worker:
>     volumes: [ "./data/app:/data" ]
> ```
>
> The app runs as an unprivileged user inside the container (uid 999), so give it write access:
> `mkdir -p data/app && setfacl -m u:999:rwx -m d:u:999:rwx data/app` (or `chown 999 data/app`).

### B. Try it on your own computer

Same as path A, with `PUBLIC_URL=http://localhost:3070` in step 2 (option 1 in [C](#c-choose-how-to-reach-it)). Open
`http://localhost:3070`. Browsers treat `localhost` as secure, so passkeys work there too.

Want sample data? Choose **Try with sample data** during setup. When you are done:

```sh
docker compose down        # stops it, keeps the data
docker compose down -v     # stops it and DELETES all data
```

### C. Choose how to reach it

The app always listens on `127.0.0.1:3070` first, so nothing is exposed until you decide. There is one rule for every
option: **`PUBLIC_URL` must be exactly the address you type in the browser**, because passkeys, cookies, push and
invitations are tied to it. Change it later whenever you change your mind, then run `docker compose up -d`.

| Option | Who can open it | Domain needed | HTTPS | `PUBLIC_URL` looks like |
| --- | --- | --- | --- | --- |
| 1. This computer only | you, on that machine | no | not needed (`localhost` counts as secure) | `http://localhost:3070` |
| 2. Home network | devices on the same Wi-Fi or LAN | no | no, so passkeys and phone install are off | `http://<LAN IP>:3070` |
| 3. Your own devices, anywhere | your phone and laptop, through a private network | no | yes | the HTTPS address the private network gives you |
| 4. Public, with your domain | anyone with the link (sign-up is still closed) | yes | yes | `https://money.example.com` |
| 5. Public, without a domain | anyone with the link | no | yes | the HTTPS address the service gives you |

**1. This computer only.** Nothing to do. This is the default.

**2. Home network.** In `.env` set `APP_BIND=0.0.0.0` and `PUBLIC_URL=http://<the machine's LAN IP>:3070`, then
`docker compose up -d`. Sign in with your password and authenticator code; passkeys, push and the phone install need
HTTPS, so use option 3, 4 or 5 if you want those.

**3. Your own devices, anywhere (no domain, nothing public).** Install [Tailscale](https://tailscale.com) on the
server and on your phone and laptop, then run `tailscale serve --bg 3070` on the server. It prints an HTTPS address that
only your devices can open; put it in `PUBLIC_URL`. A WireGuard VPN with your own reverse proxy works the same way.

**4. Public, with your own domain.** Two common ways:

- *The server has a public IP and you can open ports 80 and 443:* point an `A` record at it and put
  [Caddy](https://caddyserver.com) in front, which gets the certificate on its own:

  ```caddy
  money.example.com {
  	encode zstd gzip
  	reverse_proxy 127.0.0.1:3070
  }
  ```

  Prefer nginx? Use `docs/deploy/nginx.conf.example` (forwarded headers and 12 MB uploads are already set) with a
  certificate from Let's Encrypt.
- *No public IP, no open ports (home internet, CGNAT, strict firewall):* use a
  [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/). Add your domain
  to Cloudflare, create a tunnel, run `cloudflared` on the server and add a public hostname pointing to
  `http://127.0.0.1:3070`. Cloudflare serves the HTTPS; your router stays closed.

**5. Public, without your own domain.** `tailscale funnel --bg 3070` publishes the same HTTPS address from option 3 to
the whole internet. A free dynamic DNS name (for example from DuckDNS) plus Caddy and port forwarding works too, if
your connection has a public IP. Avoid throwaway tunnel URLs that change on every restart: when the address changes,
passkeys and installed phone apps stop working until you update `PUBLIC_URL`.

Going public is safe by design (see [Security](#security)): the owner is created with `SETUP_TOKEN`, sign-up closes
right after, and members join only by invitation. Want one more lock? Put an access gateway with single sign-on in
front of options 4 and 5.

Whatever you pick, the Android share target and the iPhone Shortcut use the same address.

### D. Manual install (no Docker)

You need Node.js 22.12 or newer, PostgreSQL 18 (with `pg_dump` and `pg_restore` of the same major version) and a
reverse proxy for HTTPS.

```sh
# 1. Database user and database, local connections only
sudo -u postgres createuser --pwprompt finance
sudo -u postgres createdb -O finance finance

# 2. App
git clone https://github.com/zakiyys/tillpayday.git /opt/tillpayday && cd /opt/tillpayday
npm ci
node scripts/gen-secrets.mjs --write
nano .env                 # set DATABASE_URL and PUBLIC_URL
npm run db:generate
npm run db:migrate
npm run build
```

Then run **two** long-lived processes, the web app and the worker:

- **systemd:** copy `docs/deploy/tillpayday.service.example` and `docs/deploy/tillpayday-worker.service.example` to
  `/etc/systemd/system/` (drop `.example`), adjust `User` and `WorkingDirectory`, then
  `sudo systemctl enable --now tillpayday tillpayday-worker`. The web unit backs up and migrates before it starts.
- **PM2:** `cp docs/deploy/ecosystem.config.cjs.example ecosystem.config.cjs && pm2 start ecosystem.config.cjs`.
  Run `npm run db:migrate` yourself after every update.

Then pick how people reach it in [C](#c-choose-how-to-reach-it).

### Environment variables

`node scripts/gen-secrets.mjs --write` creates `.env` from `.env.example` and fills every secret with a fresh random
value. It refuses to overwrite an existing `.env`. The app refuses to start when a secret is missing, too short or a
placeholder.

| Name | Required | Meaning |
| --- | --- | --- |
| `PUBLIC_URL` | yes | The exact address people open. Passkeys, cookies, push and invitations depend on it. |
| `POSTGRES_PASSWORD` | Compose | Password of the bundled database; Compose builds `DATABASE_URL` from it. |
| `DATABASE_URL` | manual | PostgreSQL connection string. |
| `SETUP_TOKEN` | yes | Needed once to create the owner. Keep it private. |
| `SESSION_SECRET` | yes | Signs session data. |
| `DATA_ENCRYPTION_KEY` | yes | Encrypts AI keys and TOTP secrets in the database. |
| `BACKUP_ENCRYPTION_KEY` | yes | Encrypts backups. **Keep a copy somewhere else**: without it backups cannot be restored. |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | yes | Web Push key pair. |
| `DATA_DIR` | yes | Folder for attachments and backups, outside the web root (Compose sets `/data`). |
| `APP_NAME` | yes | Name shown in the app and on the installed icon. |
| `BACKUP_COPY_DIR` | no | Second folder that receives a copy of every backup (a mounted remote disk, for example). |
| `BACKUP_KEEP` | no | How many daily backups to keep (default 14). |
| `APP_BIND`, `APP_PORT` | no | Compose only: host address and port (default `127.0.0.1:3070`; `0.0.0.0` opens it to your LAN). |

Never commit `.env`. It is in `.gitignore`.

## First setup

1. Open `PUBLIC_URL`. With no owner yet, the app shows only the setup screen.
2. Enter the `SETUP_TOKEN` from `.env`, your name, e-mail and a backup password. **Save the recovery codes.**
3. Add a passkey (fingerprint, face or device PIN). From now on sign-up is closed; others join by invitation.
4. Choose how to set up your money: a short form per step, an AI interview, or sample data to look around.
   Nothing is saved until you confirm the summary.
5. Record your first entry in the input bar, for example `coffee 25k`.

## Updating

Click **Watch > Custom > Releases** on GitHub to get notified when a new version is out. Then:

```sh
cd tillpayday
git pull
docker compose up -d --build
```

Manual install: `git pull && npm ci && npm run build`, then restart both services. Your data is not touched: on
start the app makes a backup, then applies new migrations. Migrations never drop data without an explicit step.
Release notes are in [CHANGELOG.md](CHANGELOG.md).

## Backup and restore

- The worker writes an **encrypted backup every day** to `DATA_DIR/backups` (and to `BACKUP_COPY_DIR` if set),
  keeping the newest 14. A backup is also made before every migration.
- Back up on demand:
  ```sh
  docker compose exec app node --import tsx scripts/backup.ts     # Compose
  npm run backup                                                  # manual install
  ```
- Restore into an empty database:
  ```sh
  npm run restore -- /path/to/backup-<time>.dump.enc --target postgresql://user:pass@127.0.0.1:5432/newdb
  ```
- Restore over the running database with Compose (replaces it):
  ```sh
  docker compose stop app worker
  docker compose run --rm --no-deps app sh -c 'ls "$DATA_DIR/backups"'
  docker compose run --rm --no-deps app sh -c 'node --import tsx scripts/restore.ts "$DATA_DIR/backups/<file>" --yes'
  docker compose start app worker
  ```
- Backups are AES-256-GCM encrypted with a key derived from `BACKUP_ENCRYPTION_KEY`. A changed or truncated file is
  refused before anything reaches the database.
- **Settings > Backup and export** downloads all data as JSON or CSV. Exports never contain passwords, keys, tokens
  or attachments.

A backup that has never been restored is a hope, not a backup. Try a restore into a scratch database once.

## Setting up AI (optional)

<p align="center">
  <img src="docs/illustrations/blotcat-input-bar.png" alt="Blotcat pushing a short typed sentence into one round input bar, and a card coming out to confirm" width="680">
</p>

**Settings > AI** accepts any endpoint that speaks the OpenAI chat-completions format. Enter the base URL ending in
`/v1`, the model name and, if needed, a key, then press the connection test. The test records whether the model
supports structured output and images.

| Provider | Base URL | Notes |
| --- | --- | --- |
| A hosted provider | its `.../v1` URL | needs a key |
| [Ollama](https://ollama.com) on the same server | `http://<server LAN IP>:11434/v1` | no key; pick a model that supports JSON output |
| [LM Studio](https://lmstudio.ai) | `http://<host>:1234/v1` | turn on the local server in LM Studio |
| Any OpenAI-compatible router or gateway | its `.../v1` URL | must honour `"stream": false` |

Good to know:

- **Speed matters.** The app waits up to 90 seconds for one answer, but a fast small model (a few seconds per
  answer) feels much better than a large one, and photos need a model that reads images.
- A separate model for photos and a fallback provider are optional.
- **What gets sent:** only what you type or attach, plus the names of your accounts and categories. Never balances,
  never other transactions. Text inside receipts and documents is treated as data, not instructions.
- **Without AI:** simple entries still work, complex sentences open a prefilled form, and photos wait in a queue
  until a model is available.

## Using it on a phone

- **Android:** open the app in Chrome, menu > **Install app**. It then shows up in the Share menu for text, images
  and PDFs.
- **iPhone:** Safari > Share > **Add to Home Screen**. iOS has no share target for web apps, so **Settings > API
  tokens** has a step-by-step Shortcut that sends text or photos to `POST /api/v1/ingest` with an INGEST token.
- Push notifications on iPhone work only after the app is added to the Home Screen and opened from there.
- Entries made offline stay on the device and are sent when you are back online.

## Security

The app is built to be safe on the open internet on its own. In short:

- It **never stores bank credentials** and cannot move money or place orders.
- Owner creation needs `SETUP_TOKEN`; afterwards sign-up is closed and members join only by single-use invitation.
- Passkeys first; argon2id password plus TOTP and one-time recovery codes as backup. Sessions are listed per device
  and revocable. Export, AI settings, tokens, invitations and member removal ask you to sign in again.
- Rate limits with growing lockouts on sign-in, uploads, invitations and AI tests.
- CSRF checks on every state-changing request, a strict Content Security Policy with no third-party origins,
  HSTS, `X-Frame-Options: DENY` and the other standard headers.
- Uploads are limited to 10 MB, checked by content, stripped of image metadata, stored outside the web root.
- AI keys and TOTP secrets are encrypted at rest; API tokens and recovery codes are stored only as hashes.
- Every change to financial data is written to an audit log with its source (UI, AI, import, job, API).

Want another layer? Put a VPN, an access gateway with single sign-on, or client certificates in front of the
reverse proxy. Keep `PUBLIC_URL` equal to the address you open, or passkeys stop working.

Found a vulnerability? Please report it privately, see [SECURITY.md](SECURITY.md).

## Troubleshooting

**"Model is not answering" in AI settings, but the model works from the server itself.**
The app runs inside a container, so `localhost` there is the container, not your server. Use the server's LAN or
private IP in the base URL. If the model listens on the host only, the host firewall may block traffic from Docker
networks; allow the Docker subnets to reach that port, for example
`sudo ufw allow from 172.16.0.0/12 to any port 11434 proto tcp` and the same for `192.168.0.0/16` (Docker also creates
networks there). Then press the connection test again.

**The connection test passes slowly, or times out.**
Pick a faster model. Router "combo" models that try several upstreams in a row can take 30 to 60 seconds per answer.

**Passkey registration fails, or I get logged out right away.**
`PUBLIC_URL` must match the address in the browser exactly, including `https://` and the port. After changing it,
run `docker compose up -d` so the app and worker pick it up.

**The app container keeps restarting with `EACCES: permission denied`.**
You mounted a host folder that the container user (uid 999) cannot write to. See the note under
[path A](#a-docker-compose-recommended).

**`.env already exists; not overwriting it`.**
`gen-secrets` protects your existing secrets on purpose. Edit `.env` by hand, or print fresh values with
`node scripts/gen-secrets.mjs` (without `--write`).

**Where are the logs?** `docker compose logs -f app worker`. Health check: `GET /api/health` returns `{"ok":true}`.

## FAQ

**Does it connect to my bank?** No. It never stores bank credentials and cannot move money. You type entries, import
statements, or share screenshots.

**What leaves my server?** Only what you configure: requests to your AI provider and backup copies to
`BACKUP_COPY_DIR`. There is no telemetry. Prices and exchange rates are entered by hand.

**Can several households share one install?** No. One install is one household of one or two people.

**I lost my passkey.** Sign in with your password and authenticator code, or with a recovery code, then add a new
passkey in **Settings > Sign-in and devices**.

**How do I see it with sample data?** Choose **Try with sample data** during setup, or run
`npm run db:seed-demo -- <owner e-mail>` on a household without transactions.

**Can I rename it?** Yes, set `APP_NAME`. The logo comes from `public/logo.svg`; `npm run gen:icons` rebuilds every
icon from it. See [DESIGN.md](DESIGN.md) for the palette and type scale.

**Why is there a cat in the README?** The bloat cat guards against bloat. It sits on the spreadsheet and judges your
third streaming subscription. It is not a dependency.

## Development

<p align="center">
  <img src="docs/illustrations/blotcat-lean.png" alt="Blotcat weighing features on a scale and cutting the heavy ones" width="560">
</p>

```sh
npm ci                                   # also wires the git hooks
node scripts/gen-secrets.mjs --write     # then set DATABASE_URL and TEST_DATABASE_URL (a separate database)
npm run db:migrate
npm run dev                              # http://127.0.0.1:3070
```

| Command | What it runs |
| --- | --- |
| `npm run test:unit` | pure logic: money maths, the sentence parser, the AI client |
| `npm run test:int` | against a real PostgreSQL (`TEST_DATABASE_URL`): money flows, import, backup and restore |
| `npm run test:e2e` | Playwright in a real browser with a mock AI server, including accessibility checks |
| `npm run lint`, `npm run typecheck` | ESLint and `tsc --noEmit` |
| `npm run scan:secrets`, `npm run scan:private` | gitleaks and the private-details scan over the full history |

### Project layout

```text
src/
  domain/      money logic as pure functions: allowance, periods, budgets, goals, FX, parser, matching
  server/      database access, auth, AI client, import, ledger, reports, worker jobs
  app/         Next.js pages and the /api routes
  components/  UI
messages/      Indonesian and English text
prisma/        schema and migrations
scripts/       secrets, backup, restore, icons, repo scans
tests/         unit, integration, e2e and a fresh-install test
docs/deploy/   systemd, PM2, Caddy and nginx examples
```

Money rules live in `src/domain` as pure functions with tests first; the server code only loads data and saves
results. If you change behaviour, change or add a test with it. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE). Use it, change it, run it for yourself and your partner.
