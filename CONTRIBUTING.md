# Contributing

Thanks for helping. Keep the user-visible behaviour and the visual direction as they are: users depend on both.
Start from the README to run the app, then open an issue for anything that is unclear or looks wrong.

## Setup

```sh
npm ci                                   # also wires the git hooks
node scripts/gen-secrets.mjs --write     # then set DATABASE_URL and TEST_DATABASE_URL in .env
npm run db:migrate
npm run dev
sh scripts/install-gitleaks.sh           # secret scanner used by the pre-commit hook
```

## Rules

- Money logic lives in `src/domain/` as pure functions with tests. Write the test first. Money is a `bigint` of
  minor units; rates and units use `decimal.js`. Never use floating point for money.
- Database access, services and adapters live in `src/server/`; pages and routes in `src/app/`.
- Validate every boundary with Zod (forms, API, model output, environment).
- No text in components: add messages to both `messages/en/*.json` and `messages/id/*.json`.
- UI: native controls, 44 px touch targets, 4.5:1 text contrast, visible focus, no colour-only meaning, every view
  with empty, loading and error states, no horizontal scroll at 390 px. Follow `DESIGN.md`.
- Schema changes only through Prisma migrations; never drop data without an explicit step.
- Never commit secrets, real financial data, domains, host names, IPs, server paths, names or e-mail addresses.
  Use `example.invalid` and made-up names in tests and docs.

## Checks before a pull request

```sh
npm run lint
npm run typecheck
npm run test:unit
npm run test:int
npm run test:e2e
npm run build
npm run scan:secrets && npm run scan:private
```

Keep commits focused and describe the user-visible change in `CHANGELOG.md`.
