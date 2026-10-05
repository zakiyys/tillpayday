# Decisions

Readings of the spec where it was ambiguous, and deviations with reasons. Newest at the bottom.

1. **Working name.** The app name is open (spec 18.1). `APP_NAME` defaults to "Home Ledger" in `.env.example`
   and is shown everywhere the name appears.
2. **Versions.** Next.js 16.3, React 19.3, Prisma 7.10 (8.0 is still a release candidate), TypeScript 5.9
   (TypeScript 7 is the native Go port and `eslint-config-next`/`typescript-eslint` do not support it yet),
   ESLint 9 (pulled by `eslint-config-next`), Zod 4, Tailwind 4, Vitest 5, Playwright 1.63, pg-boss 12.
3. **Money columns** are `BigInt` minor units; units, prices and rates are `Decimal(30,10..12)`.
   In TypeScript domain code money is `bigint`, rates and units are `decimal.js` values.
4. **`npm audit`** reports advisories in `mysql2`, pulled transitively by the Prisma CLI for MySQL support.
   This project only talks to PostgreSQL and the CLI is a dev/build tool, so the path is not reachable.
   Downgrading Prisma to 6 (the suggested "fix") would break the required driver-adapter setup.
5. **Icon family.** The design skills discourage lucide; the owner's brief explicitly names lucide-react as an
   acceptable family. Owner instruction wins. One stroke width (1.75) across the app.
6. **Theme.** Light and dark follow the system by default, with a manual override in Settings (stored in a cookie
   so the server renders the right theme without a flash).
7. **CSP.** `script-src 'self' 'unsafe-inline'` because the Next.js App Router emits inline bootstrap scripts.
   No third-party origin is allowed anywhere. Nonce-based CSP can replace this later; it forces every page to be
   dynamic.
8. **Private-details scan.** Owner-specific deny patterns (names, domains, host names) are kept in
   `deploy.local/private-patterns.txt`, which is gitignored, so the patterns themselves are never committed.
   The committed script also flags any IP, server path, unknown host name or e-mail address.
9. **Signed OPENING/ADJUSTMENT.** These two types store a signed `amount` (the delta). Every other type keeps a
   positive amount as the spec says. This keeps "transfer is one row with two sides" and avoids a direction flag.
10. **Fixed bills vs savings.** Bills of kind GOAL (goal contributions created as bills) count toward
    `tabunganPeriode`, all other bills (regular, installment portions, card statements) toward `tagihanTetap`.
    Card statement bills are excluded from the pool by default, because the card spending already reduced the
    allowance when it happened; counting the statement again would double-count. Recorded as a setting.
11. **Weekly allowance.** Weeks are counted from the period start (week 1 = days 1-7), the last week may be short.
12. **Period end.** An open period's expected end is the day before the next scheduled payday. When the next
    salary is recorded early (inside the window), the period closes the day before that salary.
13. **Estimated FX matching on import.** An estimated card transaction matches a statement row with the same
    direction, inside the date window, and an amount within 10 percent; the statement amount then replaces it.
14. **Full reloads after sign-in, sign-out and setup.** `window.location.assign` (lint warning) is used on purpose
    after the session cookie changes, so every server component and the service worker see the new session.
15. **Onboarding draft.** Both setup paths edit one `OnboardingDraft` row (Zod schema in
    `src/server/onboarding/draft.ts`); only the summary's confirm writes accounts, recurring, goals and holdings.
    Existing holdings entered during setup are recorded as a buy plus an opening entry of the same amount, so the
    account balance stays what the user reported and the cost basis is known.
16. **Demo data** uses generic names ("Bank A", "Kedai Kopi Contoh") and a fixed pseudo-random seed.
17. **AI action schema is flat for strict mode.** The `response_format` JSON Schema is one object with every field
    (nullable) and an `intent` enum, because strict structured output needs all properties required and small
    local models handle flat objects better. Nulls are stripped, then the discriminated Zod schema decides.
    Endpoints without structured output fall back to `json_object` (recorded by the connection test).
18. **Plain numbers as thousands** apply when the base currency has no decimals in everyday use (exponent 0,
    e.g. IDR); the card always shows how the number was read.
19. **Input bar on other pages** sends the text to `/record?q=...`, where the card is shown; photos open Record.
