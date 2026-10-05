#!/bin/sh
set -e
node_modules/.bin/tsx scripts/check-env.ts
exec node_modules/.bin/tsx src/server/worker/main.ts
