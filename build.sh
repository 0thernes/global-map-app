#!/bin/sh
# Rebuild js/app.js from src/. Needs `npm ci` once. Same as `npm run build`.
cd "$(dirname "$0")" && node scripts/build.mjs "$@"
