# Security policy

## Reporting a vulnerability

Please report security problems privately. Use the repository's private vulnerability reporting
("Security" tab, "Report a vulnerability") instead of opening a public issue. Include the version or commit, steps to
reproduce, and the impact you expect. You will get an answer within seven days; please wait for a fix before
disclosing details publicly.

Do not test against installs you do not own. Every install holds someone's personal financial data.

## What the app is built to guarantee

- It never stores bank credentials and cannot move money or place orders.
- The AI model only returns proposals from a fixed schema, validated with Zod; it cannot read balances, write to the
  database or run queries. Documents are treated as data.
- Owner creation needs `SETUP_TOKEN`; afterwards sign-up is closed and members join only by single-use invitation.
- Passkeys first; password (argon2id) plus TOTP and one-time recovery codes as backup. Sessions are stored in the
  database, listed per device and revocable. Sensitive actions (export, AI settings, tokens, invitations, member
  removal, bulk import) require re-authentication.
- Optional quick PIN: six digits, argon2id-hashed, set only after re-authentication. It works only on a browser
  trusted at that moment (a random token in an `HttpOnly` cookie, stored as a SHA-256 hash), is rate limited per IP,
  and five wrong PINs revoke that device. A PIN sign-in never satisfies re-authentication. Removing the PIN forgets
  every trusted device. Optional auto-lock ends idle sessions so the next visit asks for the PIN.
- Signing in again in the same browser revokes the session it replaces.
- Rate limits with growing lockouts on login, re-authentication, ingest, uploads, invitations and AI tests.
- CSRF checks on every state-changing request, a strict Content Security Policy with no third-party origins,
  `HttpOnly`/`SameSite` cookies (`Secure` behind HTTPS), standard security headers.
- Every query is scoped by household and account visibility; this is covered by tests.
- Uploads are limited in size and type, checked by content, image metadata is removed, files live outside the web
  root and are served only to members allowed to see them.
- AI keys and TOTP secrets are encrypted with `DATA_ENCRYPTION_KEY`; API tokens and recovery codes are stored as
  hashes. Logs never contain secrets, tokens, keys or attachment contents.
- Every change to financial data is written to an audit log with its source (UI, AI, import, job, API).
- Daily encrypted backups; restore is tested.

## If a secret was committed

Rotate it. Removing the commit is not enough: anyone who cloned the repository may have it. Generate new values
with `node scripts/gen-secrets.mjs`, update `.env`, and restart. Rotating `DATA_ENCRYPTION_KEY` makes stored AI keys
and TOTP secrets unreadable (enter them again); rotating `BACKUP_ENCRYPTION_KEY` affects only new backups, so keep
the old key until old backups are no longer needed.

## Repository hygiene

`gitleaks` runs as a pre-commit hook and in CI over the full history, together with a scan for IP addresses,
host names, server paths and e-mail addresses (`npm run scan:secrets`, `npm run scan:private`).
