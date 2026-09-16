# OlgaFecto Defense

OlgaFecto Defense is a local simulation project I built to experiment with how a layered interceptor system could be modeled in software.

The basic idea is pretty simple: the simulation runs in C++, FastAPI sits in the middle to expose the simulation to other parts of the project, and a browser UI shows what is happening in real time.

## How it works

The project is split into a few main pieces:

```text
olgafecto-defense/
├── physics_engine/     C++ simulation and pybind11 bindings
├── sensor_api/         FastAPI service and simulation adapter
├── web_gui/            Browser simulator
├── data_layer/         Future database / telemetry work
├── scripts/            Build and run scripts
└── README.md
```

The general flow is:

```text
Browser
   │
   │ HTTP
   ▼
FastAPI
   │
   │ pybind11
   ▼
C++ EngagementEngine
   │
   └── simulation state
```

The important part is that **C++ is the source of truth for the simulation**.

The browser doesn't decide whether something gets intercepted, Python doesn't calculate the guidance, and the frontend isn't running a second version of the physics. The C++ engine handles the actual simulation and the other layers mostly pass data around and display it.

## What's working right now

The C++ engine currently handles things like:

* target movement
* interceptor movement
* radar detection/gating
* interceptor launches
* proportional navigation guidance
* speed limits
* proximity fuze checks
* intercepts
* leakers
* engagement counters
* generated raid scenarios
* stress testing

The Python side exposes that through FastAPI.

Current endpoints:

| Endpoint                | What it does                            |
| ----------------------- | --------------------------------------- |
| `POST /scenario`        | Create a scenario from specific targets |
| `POST /scenario/random` | Generate a randomized raid              |
| `GET /targets`          | Get the current target tracks           |
| `GET /tracks`           | Get all tracks, including interceptors  |
| `GET /status`           | Get current engagement information      |
| `GET /events`           | Get simulation events                   |
| `POST /stress-test`     | Run a larger batch of simulations       |

The browser simulator is served directly by the API.

## Frontend

The web UI is basically a visualization layer for the simulation.

JavaScript handles things like:

* drawing targets and interceptors
* converting world coordinates to screen coordinates
* rotating sprites
* displaying the HUD
* showing launches and impacts
* animating explosions
* displaying events and simulation results

It does **not** handle the actual engagement logic.

For example, the browser doesn't decide when an interceptor hits a target. It receives that information from the backend and displays it.

### A note on development

I wrote the backend and simulation side of the project myself.

I did use **Claude to help with parts of the frontend and JavaScript**, mainly for UI implementation, browser-side code, and working through some of the visualization pieces.

The simulation architecture and C++ backend are my own work.

## Building the C++ Engine

From the project directory:

```bash
cd ~/olgafecto-defense
./scripts/build_engine.sh
```

The compiled Python module ends up in:

```text
physics_engine/build/
```

The API expects the module to be there when it starts.

If it isn't built yet, the API will tell you to run the build script.

## Running the Simulator

Start the virtual environment:

```bash
cd ~/olgafecto-defense
source .venv/bin/activate
```

Then start FastAPI:

```bash
uvicorn sensor_api.main:app --host 0.0.0.0 --port 8080
```

Open:

```text
http://localhost:8080/
```

or:

```text
http://localhost:8080/simulator
```

The API will also open the browser automatically when it starts.

You can use another port if needed:

```bash
uvicorn sensor_api.main:app --host 0.0.0.0 --port 8081
```

## Running Without Opening a Browser

If you're running this over SSH, in a container, or somewhere without a desktop:

```bash
OLGAFECTO_AUTO_OPEN=0 \
uvicorn sensor_api.main:app --host 0.0.0.0 --port 8080
```

If you need to explicitly set the port used by the browser launcher:

```bash
OLGAFECTO_WEB_PORT=8081 \
uvicorn sensor_api.main:app --host 0.0.0.0 --port 8081
```

## API Examples

### Create a scenario

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

### Get target tracks

```bash
curl http://localhost:8080/targets
```

### Get all tracks

This includes both targets and interceptors:

```bash
curl http://localhost:8080/tracks
```

### Get engagement status

```bash
curl http://localhost:8080/status
```

### Generate a random raid

```bash
curl -X POST http://localhost:8080/scenario/random \
  -H "Content-Type: application/json" \
  -d '{
    "scenario_kind": "saturation",
    "count": 5,
    "seed": 42
  }'
```

### Get events

```bash
curl "http://localhost:8080/events?after=0"
```

### Run a stress test

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

This runs a series of raids through the C++ engine and returns the results for each raid size.

## Data Layer

`data_layer/` isn't doing much yet.

The eventual goal is to use it for things like:

* storing telemetry
* saving scenarios
* keeping engagement history
* replaying previous simulations
* database migrations
* cleaning up old simulation data

For now, the simulation is in-memory and disappears when the application stops.

## Some Design Decisions

### Keep the simulation in C++

I wanted the actual simulation to have one source of truth.

`EngagementEngine` owns the state changes and engagement decisions. Python calls into it, and the frontend displays the results.

That means I don't have to worry about the JavaScript implementation slowly becoming different from the actual simulation.

### Keep Python fairly thin

`sensor_api/radar_sim.py` is mostly an adapter between FastAPI and the C++ engine.

Ideally, a request comes in, Python passes it to C++, and the resulting state gets turned back into an API response.

The physics and engagement logic shouldn't end up scattered throughout the Python code.

### Keep the frontend focused on visualization

The frontend can make the simulation look good, but it shouldn't change what the simulation actually does.

So things like coordinate projection, sprite rotation, animations, and HUD elements belong in JavaScript.

Guidance, radar decisions, fuze checks, intercept decisions, and leakers belong in C++.

## What's Next

The biggest thing I want to work on next is the data layer.

The rough plan is:

1. Design the telemetry/database schema.
2. Add migrations.
3. Store simulation frames and engagement events.
4. Save scenarios.
5. Add replay/history support.
6. Expose that history through the API.

After that, there are other things I'd eventually want to add, such as authentication and better deployment configuration.

For now, though, the project is primarily a **local simulation and experimentation environment**.
