#!/bin/sh
# Scenario 28: gitleaks over every commit in the repository history.
set -e
GL="./.tools/gitleaks"
[ -x "$GL" ] || GL="$(command -v gitleaks)"
"$GL" git --redact --no-banner -c .gitleaks.toml .
echo "secret scan: clean"
