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
