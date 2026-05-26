import os
import sys
import threading
import time
import webbrowser
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from sensor_api.models import (
    EngagementEvent,
    EngagementStatus,
    RandomScenarioConfig,
    ScenarioConfig,
    StressResult,
    StressTestConfig,
    TargetState,
    TrackState,
)
from sensor_api.radar_sim import RadarSimulator

app = FastAPI(title="OlgaFecto Radar Sensor API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

radar_sim = RadarSimulator()
_web_gui_dir = Path(__file__).parent.parent / "web_gui"
_simulator_page = _web_gui_dir / "Live Interceptor Simulator (API).html"


def _uvicorn_port(default: int = 8080) -> int:
    """Best-effort port detection for `uvicorn ... --port 80XX`."""
    env_port = os.getenv("OLGAFECTO_WEB_PORT") or os.getenv("PORT")
    if env_port:
        try:
            return int(env_port)
        except ValueError:
            return default

    for i, arg in enumerate(sys.argv):
        if arg == "--port" and i + 1 < len(sys.argv):
            try:
                return int(sys.argv[i + 1])
            except ValueError:
                return default
        if arg.startswith("--port="):
            try:
                return int(arg.split("=", 1)[1])
            except ValueError:
                return default
    return default


def _should_auto_open() -> bool:
    return os.getenv("OLGAFECTO_AUTO_OPEN", "1").lower() not in {"0", "false", "no", "off"}


@app.on_event("startup")
def open_simulator_on_startup():
    """Open the web simulator when the API starts in local/dev mode."""
    if not _should_auto_open():
        return

    url = f"http://localhost:{_uvicorn_port()}/"

    def _open():
        time.sleep(0.8)
        try:
            webbrowser.open(url, new=2)
            print(f"[sensor_api] Simulator opened at {url}")
        except Exception as exc:
            print(f"[sensor_api] Could not open browser automatically: {exc}")
            print(f"[sensor_api] Open manually: {url}")

    threading.Thread(target=_open, daemon=True).start()


@app.get("/", include_in_schema=False)
def simulator_home():
    return FileResponse(_simulator_page)


@app.get("/simulator", include_in_schema=False)
def simulator_alias():
    return FileResponse(_simulator_page)


@app.post("/scenario", status_code=200)
def set_scenario(config: ScenarioConfig):
    radar_sim.initialize_scenario(config)
    return {"status": "success", "missiles": len(config.missiles)}


@app.post("/scenario/random", status_code=200)
def set_random_scenario(config: RandomScenarioConfig):
    count = radar_sim.initialize_random_scenario(config)
    return {
        "status": "success",
        "scenario_kind": config.scenario_kind,
        "missiles": count,
        "seed": config.seed,
    }


@app.get("/targets", response_model=list[TargetState])
def get_targets():
    return radar_sim.get_current_state()


@app.get("/tracks", response_model=list[TrackState])
def get_tracks():
    return radar_sim.get_tracks()


@app.get("/status", response_model=EngagementStatus)
def get_status():
    return radar_sim.get_status()


@app.get("/events", response_model=list[EngagementEvent])
def get_events(after: int = 0):
    return radar_sim.get_events(after)


@app.post("/stress-test", response_model=StressResult)
def run_stress_test(config: StressTestConfig):
    return radar_sim.run_stress_test(config)


# Must be last: Starlette matches routes in registration order, so the static
# catch-all at "/" would shadow all API routes if mounted earlier.
app.mount("/", StaticFiles(directory=_web_gui_dir, html=True), name="web_gui")
