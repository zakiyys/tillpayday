#!/bin/sh
# Scenario 29: search the repo for IPs, hostnames, private paths and personal names.
#   sh scripts/scan-private.sh            full git history (all commits, messages, authors)
#   sh scripts/scan-private.sh --staged   only lines added in the staged diff
exec node scripts/scan-private.mjs "$@"
