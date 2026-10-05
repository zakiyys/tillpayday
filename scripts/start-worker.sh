#!/bin/sh
set -e
node_modules/.bin/tsx scripts/check-env.ts
exec node --import tsx src/server/worker/main.ts
