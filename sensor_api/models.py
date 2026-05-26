# models.py
from pydantic import BaseModel

class TargetState(BaseModel):
    target_id: str
    x: float
    y: float
    vx: float
    vy: float
    threat_type: str
    timestamp: float

class MissileConfig(BaseModel):
    threat_type: str
    initial_x: float
    initial_y: float
    initial_vx: float
    initial_vy: float

class ScenarioConfig(BaseModel):
    missiles: list[MissileConfig]


class RandomScenarioConfig(BaseModel):
    scenario_kind: str = "mixed"
    count: int = 5
    seed: int | None = None


class StressTestConfig(BaseModel):
    scenario_kind: str = "saturation"
    min_count: int = 1
    max_count: int = 40
    step: int = 3
    trials_per_count: int = 25
    seed: int | None = None
    interceptor_inventory: int = 12
    launcher_cooldown_s: float = 0.65
    max_time_s: float = 90.0


class StressBucket(BaseModel):
    missile_count: int
    trials: int
    avg_intercepted: float
    avg_leakers: float
    neutralized_pct: float
    zero_leaker_pct: float
    assessment: str


class StressResult(BaseModel):
    buckets: list[StressBucket]
    breakpoint_count: int
    breakpoint_assessment: str
    primary_failure: str


class TrackState(BaseModel):
    track_id: str
    object_type: str
    x: float
    y: float
    vx: float
    vy: float
    speed_mps: float | None = None
    range_m: float | None = None
    track_type: str
    timestamp: float
    status: str = "TRACKING"
    target_id: str | None = None


class EngagementStatus(BaseModel):
    timestamp: float
    active_threats: int
    active_interceptors: int
    intercepted: int
    leakers: int
    total: int


class EngagementEvent(BaseModel):
    event_id: int
    timestamp: float
    event_type: str
    track_id: str
    x: float
    y: float
    detail: str
