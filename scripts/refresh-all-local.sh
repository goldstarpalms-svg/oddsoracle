#!/usr/bin/env bash
# One-command local daily refresh (use when GitHub Actions is down or unavailable).
# Fetches the FULL Forebet boards for every sport, rebuilds everything, and pushes
# (Vercel auto-deploys on push). Safe to re-run: fetchers merge idempotently.
set -uo pipefail
cd "$(dirname "$0")/.."

step() { echo; echo "=== $1 ==="; }

step "1/7 Football full board (jina)"
python3 backend/app/fetch_full_board_local.py || echo "  ! football fetch failed (will use existing file)"

step "2/7 All other sports full boards (jina)"
python3 backend/app/fetch_full_all_sports.py || echo "  ! some sports failed (existing files kept)"
python3 backend/app/fetch_setka.py || echo "  ! table tennis fetch skipped"

step "3/7 Deep model picks + HT + corners (direct)"
python3 backend/app/refresh_forebet.py || echo "  ! deep picks fetch failed (yesterday's model file kept)"

step "4/7 Halves / oracle engine / ESPN settle / track record"
python3 backend/app/halves.py || echo "  ! halves skipped"
python3 backend/app/oracle_engine.py || echo "  ! oracle engine skipped"
python3 backend/app/score_espn.py || echo "  ! ESPN settle skipped"
python3 backend/app/backfill_history.py || echo "  ! track record rebuild skipped"

[ -d node_modules ] || { echo "  node_modules missing - npm ci"; npm ci --no-audit --no-fund; }

step "5/7 Bundle snapshot (+ finals stamp)"
node scripts/bundle-data.mjs || { echo "FATAL: bundle failed"; exit 1; }
node scripts/fetch-final.mjs || echo "  ! finals stamp skipped"

step "6/7 QA checks (blocking)"
node scripts/qa-checks.mjs || { echo "FATAL: QA failed - NOT pushing"; exit 1; }

step "7/7 Commit + push"
git add -A
if git diff --cached --quiet; then
  echo "  nothing to push"
else
  git commit -q -m "daily: full Forebet boards all sports (local refresh)"
  git push origin main && echo "  pushed - Vercel deploying"
fi
echo
echo "DONE"
