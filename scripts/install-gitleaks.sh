#!/bin/sh
# Installs the pinned gitleaks binary into ./.tools (gitignored).
set -e
VERSION="8.30.1"
OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
ARCH="$(uname -m)"
case "$ARCH" in x86_64|amd64) ARCH=x64 ;; aarch64|arm64) ARCH=arm64 ;; esac
mkdir -p .tools
URL="https://github.com/gitleaks/gitleaks/releases/download/v${VERSION}/gitleaks_${VERSION}_${OS}_${ARCH}.tar.gz"
TMP="$(mktemp -d)"
curl -sSfL "$URL" -o "$TMP/gl.tgz"
tar -xzf "$TMP/gl.tgz" -C .tools gitleaks
rm -rf "$TMP"
./.tools/gitleaks version
