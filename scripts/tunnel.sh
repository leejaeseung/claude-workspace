#!/usr/bin/env bash
# Exposes the analysis server through localtunnel and reconnects whenever the tunnel drops.
# It asks for the same subdomain every time, so the URL in .env keeps working across reconnects.
# Usage: scripts/tunnel.sh [subdomain]   (default: TUNNEL_SUBDOMAIN or stock-briefing-dev)
set -u
SUB="${1:-${TUNNEL_SUBDOMAIN:-stock-briefing-dev}}"
PORT="${PORT:-8787}"
while true; do
  echo "[$(date '+%H:%M:%S')] connecting https://$SUB.loca.lt -> localhost:$PORT"
  npx -y localtunnel --port "$PORT" --subdomain "$SUB"
  echo "[$(date '+%H:%M:%S')] tunnel closed; reconnecting in 3s"
  sleep 3
done
