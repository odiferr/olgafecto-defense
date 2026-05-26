#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENGINE_DIR="$ROOT_DIR/physics_engine"
BUILD_DIR="$ENGINE_DIR/build"

cd "$ROOT_DIR"

if [[ -f "$ROOT_DIR/.venv/bin/activate" ]]; then
  # shellcheck disable=SC1091
  source "$ROOT_DIR/.venv/bin/activate"
fi

if ! python -c "import pybind11" >/dev/null 2>&1; then
  echo "[build_engine] pybind11 is not installed in the active Python environment."
  echo "[build_engine] Install it with: python -m pip install pybind11"
  exit 1
fi

mkdir -p "$BUILD_DIR"
cd "$BUILD_DIR"

PYBIND11_CMAKE_DIR="$(python -m pybind11 --cmakedir)"

cmake "$ENGINE_DIR" -Dpybind11_DIR="$PYBIND11_CMAKE_DIR"
cmake --build . --config Release

python - <<'PY'
import physics_engine as pe

state = pe.State()
state.x = 0.0
state.y = 100.0
state.vx = 10.0
state.vy = -2.0
state.ax = 0.0
state.ay = -9.81
pe.update_state(state, 0.1)

print(f"[build_engine] Import smoke test passed: {pe.__file__}")
print(f"[build_engine] Sample state: x={state.x:.2f}, y={state.y:.2f}")
PY

echo "[build_engine] Built physics engine in $BUILD_DIR"
