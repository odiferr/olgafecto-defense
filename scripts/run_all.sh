#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${1:-8080}"

cd "$ROOT_DIR"

"$ROOT_DIR/scripts/build_engine.sh"

if [[ -f "$ROOT_DIR/.venv/bin/activate" ]]; then
  # shellcheck disable=SC1091
  source "$ROOT_DIR/.venv/bin/activate"
fi

echo "[run_all] Starting OlgaFecto sensor API on http://localhost:$PORT/"
echo "[run_all] Pass OLGAFECTO_AUTO_OPEN=0 to stop the browser from opening."

exec uvicorn sensor_api.main:app --host 0.0.0.0 --port "$PORT"
