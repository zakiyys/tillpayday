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
