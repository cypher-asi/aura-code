#!/usr/bin/env bash

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
FRONTEND_PORT="${AURA_FRONTEND_PORT:-5173}"
BACKEND_PORT="${AURA_SERVER_PORT:-3100}"

cd "$ROOT"

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

MODE="local-only"
if [ -n "${AURA_NETWORK_URL:-}" ] || [ -n "${AURA_STORAGE_URL:-}" ] || [ -n "${ORBIT_BASE_URL:-}" ]; then
  MODE="remote-backed"
fi

echo "Starting Aura mobile web dev stack (${MODE})"
echo "  Frontend: http://127.0.0.1:${FRONTEND_PORT}"
echo "  Host API: http://127.0.0.1:${BACKEND_PORT}"
echo
echo "Open on device or simulator:"
echo "  http://127.0.0.1:${FRONTEND_PORT}/projects"
echo
echo "Stop with Ctrl-C."
echo

cleanup() {
  if [ -n "${FRONTEND_PID:-}" ] && kill -0 "${FRONTEND_PID}" 2>/dev/null; then
    kill "${FRONTEND_PID}" 2>/dev/null || true
  fi
  if [ -n "${SERVER_PID:-}" ] && kill -0 "${SERVER_PID}" 2>/dev/null; then
    kill "${SERVER_PID}" 2>/dev/null || true
  fi
}

trap cleanup EXIT INT TERM

(
  cd "$ROOT"
  cargo run -p aura-server
) &
SERVER_PID=$!

(
  cd "$ROOT/frontend"
  npm run dev:mobile -- --port "${FRONTEND_PORT}" --strictPort
) &
FRONTEND_PID=$!

while true; do
  if ! kill -0 "${SERVER_PID}" 2>/dev/null; then
    wait "${SERVER_PID}"
    exit $?
  fi

  if ! kill -0 "${FRONTEND_PID}" 2>/dev/null; then
    wait "${FRONTEND_PID}"
    exit $?
  fi

  sleep 1
done
