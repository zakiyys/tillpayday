# Waiting for the owner

Temporary values are in place so work continues. Nothing here blocks the build.

| # | Question (spec 18) | Temporary value |
| --- | --- | --- |
| 1 | App name | Decided: `APP_NAME=TillPayDay`. |
| 2 | License | No LICENSE file. Repo stays private. |
| 3 | Model provider you use yourself | Tests use a mock OpenAI-compatible model. The owner now points the live install at their own self-hosted OpenAI-compatible router. Two conditions must hold for that to work, and neither is a test anymore: the router must be reachable from inside the `app` container (a container cannot reach a host-only port unless the host firewall allows the container's private subnet), and it must honour `stream: false` (see decision 24; the request now always states it). |
| 4 | Deploy details (domain, proxy, backup location) | Installed on the owner's server as containers (`docker compose`: db + app + worker), published only on loopback and fronted by the owner's existing Cloudflare Tunnel under an HTTPS hostname. The hostname, paths and the local compose override live outside the repo (in `deploy.local/` and a gitignored `compose.override.yaml`), because the repo must stay free of server details. Database and attachments are plain host folders, not named volumes. |
| 5 | When to make the repo public | Not public. The owner pushed it as a private repository (`origin`), history rewritten to the owner's GitHub identity first. Before making it public, rerun `npm run scan:secrets` and `npm run scan:private` on the full history. |
| 6 | Section 11 features to drop | None dropped; all are built. |
| 7 | AI provider for the live install | Set by the owner to their own self-hosted router. Plain-text entry worked before it was set and still does; photo or PDF input turns on once the connection test passes in Settings. |
| 8 | First owner account | Created by the owner through the setup page, which then closed registration. The setup token can be rotated in `.env` any time. |
| 9 | Update notification | Not built, and off by design: the app makes no outbound call of its own. Checking for a new version is a server-side job (a read-only token plus a scheduled check), not something the app should do by default. |
