# OlgaFecto Defense

OlgaFecto Defense is a local simulation sandbox for learning how a layered interceptor system fits together:

- a C++ physics and engagement core compiled into a Python module with pybind11
- a FastAPI sensor service that exposes C++ simulation snapshots
- a browser-based live interceptor simulator
- a placeholder data layer for future telemetry storage

The current project is intentionally local-first. It is not connected to a production database, external sensor feed, or operational weapons system.

## Repository Layout

```text
olgafecto-defense/
├── physics_engine/     C++ kinematics, guidance, proximity fuze, and pybind11 binding
├── sensor_api/         FastAPI service and radar simulation wrapper
├── web_gui/            Browser simulator UI served by the API
├── data_layer/         Future telemetry persistence layer
├── scripts/            Build/run helper scripts
└── README.md           Current architecture and runbook
```

## Current Status

Implemented today:

- C++ state integration through `physics_engine`.
- C++-owned engagement state machine through `EngagementEngine`: threat motion, radar gating, interceptor launch, PN guidance, speed limiting, fuze checks, leakers, and intercept counters.
- Python import bridge for the compiled engine. Python is the API adapter only; it should not contain simulation physics or engagement decisions.
- FastAPI endpoints:
  - `POST /scenario`
  - `POST /scenario/random`
  - `GET /targets`
  - `GET /tracks`
  - `GET /status`
- `GET /events`
- `POST /stress-test`
- Browser simulator served by the API at `/` and `/simulator`.
- Automatic browser launch when the API starts.
- Experimental PyQt dashboard consumer.

Planned for later:

- A real database-backed telemetry store.
- Migrations and database lifecycle tooling.
- Persistent engagement history.
- Auth, user accounts, deployment hardening, and production configuration.
- More complete API contracts for saved scenarios and replay.

## Build the Physics Engine

From the project root:

```bash
cd ~/olgafecto-defense
./scripts/build_engine.sh
```

The API imports the compiled module from:

```text
physics_engine/build/
```

If the build output is missing, `sensor_api/radar_sim.py` will raise an error telling you to run the build script.

## Run the API and Web Simulator

Start the service:

```bash
cd ~/olgafecto-defense
source .venv/bin/activate
uvicorn sensor_api.main:app --host 0.0.0.0 --port 8080
```

You can use any local port:

```bash
uvicorn sensor_api.main:app --host 0.0.0.0 --port 8081
```

When the API starts, it automatically opens:

```text
http://localhost:<port>/
```

That means you no longer need to run:

```bash
xdg-open "http://localhost:8080/Live%20Interceptor%20Simulator%20(API).html"
```

The old direct page path still works, but the preferred entry points are:

```text
http://localhost:8080/
http://localhost:8080/simulator
```

## Disable Auto-Open

If you are running on a server, in SSH, inside a container, or anywhere a browser should not launch:

```bash
OLGAFECTO_AUTO_OPEN=0 uvicorn sensor_api.main:app --host 0.0.0.0 --port 8080
```

If your process manager hides the `--port` argument from the app, you can explicitly tell the opener which port to use:

```bash
OLGAFECTO_WEB_PORT=8081 uvicorn sensor_api.main:app --host 0.0.0.0 --port 8081
```

## API Shape

Create a scenario:

```bash
curl -X POST http://localhost:8080/scenario \
  -H "Content-Type: application/json" \
  -d '{
    "missiles": [
      {
        "threat_type": "V2",
        "initial_x": 8000,
        "initial_y": 15000,
        "initial_vx": -400,
        "initial_vy": -200
      }
    ]
  }'
```

Fetch current target tracks:

```bash
curl http://localhost:8080/targets
```

Fetch all C++-driven simulation tracks, including interceptors:

```bash
curl http://localhost:8080/tracks
```

Fetch engagement counters:

```bash
curl http://localhost:8080/status
```

Generate a varied C++-owned raid:

```bash
curl -X POST http://localhost:8080/scenario/random \
  -H "Content-Type: application/json" \
  -d '{"scenario_kind":"saturation","count":5,"seed":42}'
```

Fetch C++ engagement events after a given event id:

```bash
curl http://localhost:8080/events?after=0
```

Run a C++ raid stress test:

```bash
curl -X POST http://localhost:8080/stress-test \
  -H "Content-Type: application/json" \
  -d '{
    "scenario_kind": "saturation",
    "min_count": 1,
    "max_count": 40,
    "step": 3,
    "trials_per_count": 25,
    "interceptor_inventory": 12,
    "launcher_cooldown_s": 0.65,
    "max_time_s": 90
  }'
```

The response estimates the first raid size where the defense starts to struggle or fail under those assumptions.

## Data Layer Note

`data_layer/` is currently a placeholder for the next architecture phase. Database-backed telemetry, scenario persistence, replay tables, and migrations are not production-ready yet.

Expected future direction:

- define telemetry and engagement tables
- add a migration tool
- write simulation frames to a database
- expose replay/history endpoints from the API
- add retention and cleanup policies

Until that work is complete, treat the simulator state as in-memory and temporary.

## Development Notes

- The browser UI is served from `web_gui/`.
- JavaScript is display-only for physics. It may project world coordinates, rotate sprites, animate explosions, and draw HUD elements, but it must not compute guidance, interceptor motion, radar detection, speed limits, fuze checks, hit decisions, or leaker decisions.
- `sensor_api/radar_sim.py` is intentionally thin. It converts API requests/responses to and from `physics_engine.EngagementEngine`; all simulation state transitions belong in C++.
- Generated salvos, threat variation, delayed arrivals, launch bearings, and launch/intercept/impact events are C++ owned. The browser only renders snapshots and event effects returned by the API.
- Raid stress testing is C++ owned. Python exposes the request/response; the frontend only displays the summary.
- The API static mount is intentionally registered last so API routes keep working.
- `OLGAFECTO_AUTO_OPEN=0` is the clean switch for CI, headless SSH, or server use.
