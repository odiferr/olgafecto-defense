# sensor_api/radar_sim.py
import sys
import time
from pathlib import Path

_ENGINE_DIR = Path(__file__).parent.parent / "physics_engine" / "build"
if str(_ENGINE_DIR) not in sys.path:
    sys.path.insert(0, str(_ENGINE_DIR))

try:
    import physics_engine as pe
    print(f"[radar_sim] C++ physics engine loaded: {pe.__file__}")
except ImportError as e:
    raise RuntimeError(
        f"C++ physics engine not found in {_ENGINE_DIR}. "
        "Run scripts/build_engine.sh to compile it."
    ) from e

from sensor_api.models import (
    EngagementEvent,
    EngagementStatus,
    RandomScenarioConfig,
    ScenarioConfig,
    StressBucket,
    StressResult,
    StressTestConfig,
    TargetState,
    TrackState,
)


class RadarSimulator:
    """API-facing adapter. Simulation physics and engagement state live in C++."""

    def __init__(self):
        self._engine = pe.EngagementEngine()
        self.start_time: float = 0.0
        self.last_update_time: float = 0.0

    def initialize_scenario(self, config: ScenarioConfig):
        now = time.time()
        self._engine.reset()
        self.start_time = now
        self.last_update_time = now

        for missile in config.missiles:
            self._engine.add_threat(
                missile.threat_type,
                missile.initial_x,
                missile.initial_y,
                missile.initial_vx,
                missile.initial_vy,
            )

    def initialize_random_scenario(self, config: RandomScenarioConfig) -> int:
        now = time.time()
        self._engine.reset()
        self.start_time = now
        self.last_update_time = now

        seed = int(config.seed or 0)
        count = max(1, min(int(config.count), 512))
        seeds = pe.generate_threat_seeds(config.scenario_kind, count, seed)
        for threat in seeds:
            self._engine.add_threat_delayed(
                threat.threat_type,
                threat.initial_x,
                threat.initial_y,
                threat.initial_vx,
                threat.initial_vy,
                threat.delay_s,
            )
        return len(seeds)

    def _step(self) -> float:
        if not self.start_time:
            return 0.0

        now = time.time()
        dt = min(max(now - self.last_update_time, 0.0), 0.1)
        self.last_update_time = now
        self._engine.step(dt)
        return now - self.start_time

    def get_current_state(self) -> list[TargetState]:
        elapsed = self._step()
        return [
            TargetState(
                target_id=track.track_id,
                x=track.x,
                y=track.y,
                vx=track.vx,
                vy=track.vy,
                threat_type=track.track_type,
                timestamp=elapsed,
            )
            for track in self._engine.tracks(elapsed)
            if track.object_type == "threat"
        ]

    def get_tracks(self) -> list[TrackState]:
        elapsed = self._step()
        return [
            TrackState(
                track_id=track.track_id,
                object_type=track.object_type,
                x=track.x,
                y=track.y,
                vx=track.vx,
                vy=track.vy,
                speed_mps=track.speed_mps,
                range_m=track.range_m,
                track_type=track.track_type,
                timestamp=elapsed,
                status=track.status,
                target_id=track.target_id or None,
            )
            for track in self._engine.tracks(elapsed)
        ]

    def get_status(self) -> EngagementStatus:
        elapsed = time.time() - self.start_time if self.start_time else 0.0
        snapshot = self._engine.status(elapsed)
        return EngagementStatus(
            timestamp=snapshot.timestamp,
            active_threats=snapshot.active_threats,
            active_interceptors=snapshot.active_interceptors,
            intercepted=snapshot.intercepted,
            leakers=snapshot.leakers,
            total=snapshot.total,
        )

    def get_events(self, after_event_id: int = 0) -> list[EngagementEvent]:
        elapsed = self._step()
        return [
            EngagementEvent(
                event_id=event.event_id,
                timestamp=event.timestamp or elapsed,
                event_type=event.event_type,
                track_id=event.track_id,
                x=event.x,
                y=event.y,
                detail=event.detail,
            )
            for event in self._engine.events_since(after_event_id)
        ]

    def run_stress_test(self, config: StressTestConfig) -> StressResult:
        result = pe.run_stress_test(
            config.scenario_kind,
            config.min_count,
            config.max_count,
            config.step,
            config.trials_per_count,
            int(config.seed or 0),
            config.interceptor_inventory,
            config.launcher_cooldown_s,
            config.max_time_s,
        )
        return StressResult(
            buckets=[
                StressBucket(
                    missile_count=bucket.missile_count,
                    trials=bucket.trials,
                    avg_intercepted=bucket.avg_intercepted,
                    avg_leakers=bucket.avg_leakers,
                    neutralized_pct=bucket.neutralized_pct,
                    zero_leaker_pct=bucket.zero_leaker_pct,
                    assessment=bucket.assessment,
                )
                for bucket in result.buckets
            ],
            breakpoint_count=result.breakpoint_count,
            breakpoint_assessment=result.breakpoint_assessment,
            primary_failure=result.primary_failure,
        )
