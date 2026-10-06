#!/bin/sh
# Container entrypoint for the app: validate env, back up, migrate, serve.
set -e
node_modules/.bin/tsx scripts/check-env.ts
if [ "${RUN_MIGRATIONS:-0}" = "1" ]; then
  node --import tsx scripts/backup.ts --pre-migrate
  node_modules/.bin/prisma migrate deploy
fi
exec node_modules/.bin/next start -H "${HOSTNAME:-127.0.0.1}" -p 3070
