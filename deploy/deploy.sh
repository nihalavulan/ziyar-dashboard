#!/usr/bin/env bash
# Build + (re)start the Ziyar Majlis dashboard with PM2.
# Run from the repo root on the server:  bash deploy/deploy.sh
set -euo pipefail

echo "==> Pulling latest code"
git pull origin main

echo "==> Installing dependencies"
npm ci

echo "==> Building"
npm run build

echo "==> Starting / reloading with PM2"
if pm2 describe ziyarmajlis > /dev/null 2>&1; then
  pm2 reload deploy/ecosystem.config.js
else
  pm2 start deploy/ecosystem.config.js
fi

pm2 save
echo "==> Done. App is running on 127.0.0.1:3001"
