#include "engagement.hpp"
#include "pn_guidance.hpp"
#include <cmath>
#include <algorithm>
#include <random>

namespace {
constexpr double BATTERY_X = 1000.0;
constexpr double BATTERY_Y = 0.0;
constexpr double RADAR_RANGE_M = 20000.0;
constexpr double RADAR_MIN_ALT_M = 35.0;
constexpr double INTERCEPTOR_VX0 = 400.0;
constexpr double INTERCEPTOR_VY0 = 750.0;
constexpr double INTERCEPTOR_MAX_SPEED = 1100.0;
constexpr double INTERCEPTOR_LAUNCH_SPEED = 850.0;
constexpr double NAV_CONSTANT = 5.0;
constexpr double FUZE_RADIUS_M = 100.0;
constexpr double ISKANDER_TERMINAL_ALT = 3500.0;
constexpr double ISKANDER_MANEUVER_AX = 75.0;
constexpr double ISKANDER_MANEUVER_FREQ = 4.5;

State make_state(double x, double y, double vx, double vy, double ax = 0.0, double ay = 0.0) {
    State state;
    state.x = x;
    state.y = y;
    state.vx = vx;
    state.vy = vy;
    state.ax = ax;
    state.ay = ay;
    return state;
}

bool is_ballistic(const std::string& threat_type) {
    return threat_type == "V2"
        || threat_type == "SCUD_B"
        || threat_type == "ISKANDER"
        || threat_type == "FATEH_110";
}

double uniform(std::mt19937& rng, double lo, double hi) {
    std::uniform_real_distribution<double> dist(lo, hi);
    return dist(rng);
}

int uniform_int(std::mt19937& rng, int lo, int hi) {
    std::uniform_int_distribution<int> dist(lo, hi);
    return dist(rng);
}

std::string random_type(std::mt19937& rng, const std::string& scenario_kind) {
    if (scenario_kind == "cruise") {
        return "V1";
    }
    if (scenario_kind == "ballistic") {
        const std::string types[] = {"V2", "SCUD_B", "FATEH_110"};
        return types[uniform_int(rng, 0, 2)];
    }
    if (scenario_kind == "advanced") {
        return "ISKANDER";
    }
    const std::string types[] = {"V1", "V2", "SCUD_B", "FATEH_110", "ISKANDER"};
    return types[uniform_int(rng, 0, 4)];
}

ThreatSeed make_seed_for_type(std::mt19937& rng, const std::string& type, double delay_s) {
    ThreatSeed seed;
    seed.threat_type = type;
    seed.delay_s = delay_s;

    const int side = uniform_int(rng, 0, 3);
    const double aim_x = uniform(rng, 200.0, 2400.0);
    const double aim_y = uniform(rng, 0.0, 500.0);

    if (type == "V1") {
        seed.initial_y = uniform(rng, 250.0, 1400.0);
        if (side == 0 || side == 2) {
            seed.initial_x = uniform(rng, 14500.0, 21500.0);
        } else {
            seed.initial_x = uniform(rng, -5500.0, -1200.0);
        }
        const double speed = uniform(rng, 190.0, 280.0);
        const double dx = aim_x - seed.initial_x;
        const double dy = aim_y - seed.initial_y;
        const double mag = std::sqrt(dx * dx + dy * dy);
        seed.initial_vx = (dx / mag) * speed;
        seed.initial_vy = (dy / mag) * speed * 0.25;
        return seed;
    }

    if (type == "ISKANDER") {
        seed.initial_x = side == 1 ? uniform(rng, -3500.0, 2500.0) : uniform(rng, 13000.0, 21000.0);
        seed.initial_y = uniform(rng, 7000.0, 15000.0);
        const double speed = uniform(rng, 650.0, 950.0);
        const double dx = aim_x - seed.initial_x;
        const double dy = aim_y - seed.initial_y;
        const double mag = std::sqrt(dx * dx + dy * dy);
        seed.initial_vx = (dx / mag) * speed;
        seed.initial_vy = (dy / mag) * speed;
        return seed;
    }

    seed.initial_x = side == 1 ? uniform(rng, -3000.0, 5000.0) : uniform(rng, 11500.0, 21500.0);
    seed.initial_y = type == "FATEH_110" ? uniform(rng, 8000.0, 15000.0) : uniform(rng, 12000.0, 24000.0);
    const double speed = type == "SCUD_B" ? uniform(rng, 520.0, 760.0) : uniform(rng, 430.0, 980.0);
    const double dx = aim_x - seed.initial_x;
    const double dy = aim_y - seed.initial_y;
    const double mag = std::sqrt(dx * dx + dy * dy);
    seed.initial_vx = (dx / mag) * speed;
    seed.initial_vy = (dy / mag) * speed;
    return seed;
}
}

double range_between(const State& a, const State& b) {
    const double dx = a.x - b.x;
    const double dy = a.y - b.y;
    return std::sqrt(dx * dx + dy * dy);
}

bool in_radar_envelope(const State& target, double radar_x, double radar_y, double max_range, double min_altitude) {
    if (target.y <= min_altitude) {
        return false;
    }

    State radar;
    radar.x = radar_x;
    radar.y = radar_y;
    radar.vx = 0.0;
    radar.vy = 0.0;
    radar.ax = 0.0;
    radar.ay = 0.0;

    return range_between(target, radar) <= max_range;
}

void limit_speed(State& state, double max_speed) {
    const double speed = std::sqrt(state.vx * state.vx + state.vy * state.vy);
    if (speed <= max_speed || speed <= 0.0) {
        return;
    }

    state.vx = (state.vx / speed) * max_speed;
    state.vy = (state.vy / speed) * max_speed;
}

double iskander_lateral_accel(double elapsed_terminal_time, double peak_accel, double frequency) {
    return peak_accel * std::sin(elapsed_terminal_time * frequency);
}

std::vector<ThreatSeed> generate_threat_seeds(const std::string& scenario_kind, int count, unsigned int seed_value) {
    std::mt19937 rng(seed_value == 0 ? std::random_device{}() : seed_value);
    const int n = std::max(1, std::min(count, 512));
    std::vector<ThreatSeed> seeds;
    seeds.reserve(n);

    for (int i = 0; i < n; ++i) {
        const std::string type = random_type(rng, scenario_kind);
        double delay = 0.0;
        if (scenario_kind == "saturation" || scenario_kind == "mixed" || scenario_kind == "salvo") {
            delay = uniform(rng, 0.0, 3.5) + i * uniform(rng, 0.05, 0.45);
        } else {
            delay = uniform(rng, 0.0, 0.8);
        }
        seeds.push_back(make_seed_for_type(rng, type, delay));
    }
    return seeds;
}

std::string classify_bucket(double neutralized_pct, double avg_leakers) {
    if (neutralized_pct >= 90.0 && avg_leakers <= 0.25) {
        return "success";
    }
    if (neutralized_pct >= 70.0 && avg_leakers <= 2.5) {
        return "struggle";
    }
    return "fail";
}

StressResult run_stress_test(
    const std::string& scenario_kind,
    int min_count,
    int max_count,
    int step,
    int trials_per_count,
    unsigned int seed,
    int interceptor_inventory,
    double launcher_cooldown_s,
    double max_time_s
) {
    StressResult result;
    result.breakpoint_count = 0;
    result.breakpoint_assessment = "not_found";
    result.primary_failure = "none";

    min_count = std::max(1, min_count);
    max_count = std::max(min_count, std::min(max_count, 300));
    step = std::max(1, step);
    trials_per_count = std::max(1, std::min(trials_per_count, 200));
    interceptor_inventory = std::max(1, interceptor_inventory);
    launcher_cooldown_s = std::max(0.05, launcher_cooldown_s);
    max_time_s = std::max(20.0, max_time_s);

    for (int count = min_count; count <= max_count; count += step) {
        double total_intercepted = 0.0;
        double total_leakers = 0.0;
        int zero_leaker_trials = 0;

        for (int trial = 0; trial < trials_per_count; ++trial) {
            EngagementEngine engine;
            engine.configure_fire_control(interceptor_inventory, launcher_cooldown_s, 1);
            const auto seeds = generate_threat_seeds(
                scenario_kind,
                count,
                seed + static_cast<unsigned int>(count * 1009 + trial * 9176)
            );

            for (const auto& threat : seeds) {
                engine.add_threat_delayed(
                    threat.threat_type,
                    threat.initial_x,
                    threat.initial_y,
                    threat.initial_vx,
                    threat.initial_vy,
                    threat.delay_s
                );
            }

            double elapsed = 0.0;
            while (elapsed < max_time_s) {
                engine.step(0.05);
                elapsed += 0.05;
                const auto status = engine.status(elapsed);
                if (status.active_threats == 0 && status.active_interceptors == 0) {
                    break;
                }
            }

            const auto status = engine.status(max_time_s);
            total_intercepted += status.intercepted;
            total_leakers += status.leakers + status.active_threats;
            if (status.leakers == 0 && status.active_threats == 0) {
                zero_leaker_trials += 1;
            }
        }

        StressBucket bucket;
        bucket.missile_count = count;
        bucket.trials = trials_per_count;
        bucket.avg_intercepted = total_intercepted / trials_per_count;
        bucket.avg_leakers = total_leakers / trials_per_count;
        bucket.neutralized_pct = (bucket.avg_intercepted / count) * 100.0;
        bucket.zero_leaker_pct = (static_cast<double>(zero_leaker_trials) / trials_per_count) * 100.0;
        bucket.assessment = classify_bucket(bucket.neutralized_pct, bucket.avg_leakers);
        result.buckets.push_back(bucket);

        if (result.breakpoint_count == 0 && bucket.assessment != "success") {
            result.breakpoint_count = count;
            result.breakpoint_assessment = bucket.assessment;
            result.primary_failure = bucket.avg_leakers > 2.0 ? "leakers" : "neutralization_rate";
        }
    }

    if (result.breakpoint_count == 0 && !result.buckets.empty()) {
        result.breakpoint_count = result.buckets.back().missile_count;
        result.breakpoint_assessment = "survived_test_window";
        result.primary_failure = "none";
    }

    return result;
}

void EngagementEngine::reset() {
    pending_.clear();
    missiles_.clear();
    interceptors_.clear();
    events_.clear();
    sim_time_ = 0.0;
    total_count_ = 0;
    intercepted_count_ = 0;
    leaker_count_ = 0;
    next_threat_id_ = 1;
    next_event_id_ = 1;
    launched_count_ = 0;
    last_launch_time_ = -999.0;
}

void EngagementEngine::configure_fire_control(int interceptor_inventory, double launcher_cooldown_s, int max_interceptors_per_target) {
    interceptor_inventory_ = std::max(1, interceptor_inventory);
    launcher_cooldown_s_ = std::max(0.05, launcher_cooldown_s);
    max_interceptors_per_target_ = std::max(1, max_interceptors_per_target);
}

void EngagementEngine::add_threat(
    const std::string& threat_type,
    double initial_x,
    double initial_y,
    double initial_vx,
    double initial_vy
) {
    add_threat_delayed(threat_type, initial_x, initial_y, initial_vx, initial_vy, 0.0);
}

void EngagementEngine::add_threat_delayed(
    const std::string& threat_type,
    double initial_x,
    double initial_y,
    double initial_vx,
    double initial_vy,
    double delay_s
) {
    if (delay_s > 0.0) {
        PendingThreat pending;
        pending.threat_type = threat_type;
        pending.initial_x = initial_x;
        pending.initial_y = initial_y;
        pending.initial_vx = initial_vx;
        pending.initial_vy = initial_vy;
        pending.delay_s = delay_s;
        pending_.push_back(pending);
        total_count_ += 1;
        return;
    }

    Missile missile;
    missile.state = make_state(
        initial_x,
        initial_y,
        initial_vx,
        initial_vy,
        0.0,
        is_ballistic(threat_type) ? -9.81 : 0.0
    );
    missile.threat_type = threat_type;
    missile.target_id = "THREAT_" + std::to_string(next_threat_id_++);
    missile.terminal_elapsed = 0.0;
    missile.terminal_started = false;
    missile.status = "TRACKING";

    missiles_.push_back(missile);
    total_count_ += 1;
    add_event("TRACK_ACQUIRED", missile.target_id, missile.state, missile.threat_type);
}

EngagementEngine::Missile* EngagementEngine::find_missile(const std::string& target_id) {
    for (auto& missile : missiles_) {
        if (missile.target_id == target_id) {
            return &missile;
        }
    }
    return nullptr;
}

const EngagementEngine::Missile* EngagementEngine::find_missile(const std::string& target_id) const {
    for (const auto& missile : missiles_) {
        if (missile.target_id == target_id) {
            return &missile;
        }
    }
    return nullptr;
}

bool EngagementEngine::has_interceptor_for(const std::string& target_id) const {
    return interceptor_count_for(target_id) > 0;
}

int EngagementEngine::interceptor_count_for(const std::string& target_id) const {
    int count = 0;
    for (const auto& interceptor : interceptors_) {
        if (interceptor.target_id == target_id) {
            count += 1;
        }
    }
    return count;
}

bool EngagementEngine::can_launch_for(const std::string& target_id) const {
    if (launched_count_ >= interceptor_inventory_) {
        return false;
    }
    if (interceptor_count_for(target_id) >= max_interceptors_per_target_) {
        return false;
    }
    return (sim_time_ - last_launch_time_) >= launcher_cooldown_s_;
}

void EngagementEngine::remove_missile(const std::string& target_id) {
    missiles_.erase(
        std::remove_if(
            missiles_.begin(),
            missiles_.end(),
            [&](const Missile& missile) { return missile.target_id == target_id; }
        ),
        missiles_.end()
    );
}

void EngagementEngine::add_event(const std::string& event_type, const std::string& track_id, const State& state, const std::string& detail) {
    EventSnapshot event;
    event.event_id = next_event_id_++;
    event.timestamp = sim_time_;
    event.event_type = event_type;
    event.track_id = track_id;
    event.x = state.x;
    event.y = state.y;
    event.detail = detail;
    events_.push_back(event);
    if (events_.size() > 256) {
        events_.erase(events_.begin(), events_.begin() + static_cast<long>(events_.size() - 256));
    }
}

void EngagementEngine::activate_pending() {
    for (auto it = pending_.begin(); it != pending_.end();) {
        if (it->delay_s <= sim_time_) {
            PendingThreat pending = *it;
            it = pending_.erase(it);

            Missile missile;
            missile.state = make_state(
                pending.initial_x,
                pending.initial_y,
                pending.initial_vx,
                pending.initial_vy,
                0.0,
                is_ballistic(pending.threat_type) ? -9.81 : 0.0
            );
            missile.threat_type = pending.threat_type;
            missile.target_id = "THREAT_" + std::to_string(next_threat_id_++);
            missile.terminal_elapsed = 0.0;
            missile.terminal_started = false;
            missile.status = "TRACKING";
            missiles_.push_back(missile);
            add_event("TRACK_ACQUIRED", missile.target_id, missile.state, missile.threat_type);
        } else {
            ++it;
        }
    }
}

State EngagementEngine::launch_state_for(const Missile& missile) const {
    State launch = make_state(BATTERY_X, BATTERY_Y, INTERCEPTOR_VX0, INTERCEPTOR_VY0);

    const double range = range_between(launch, missile.state);
    const double lead_time = std::max(0.35, std::min(10.0, range / INTERCEPTOR_MAX_SPEED));
    double px = missile.state.x + missile.state.vx * lead_time + 0.5 * missile.state.ax * lead_time * lead_time;
    double py = missile.state.y + missile.state.vy * lead_time + 0.5 * missile.state.ay * lead_time * lead_time;
    py = std::max(py, 850.0);

    double dx = px - BATTERY_X;
    double dy = py - BATTERY_Y;
    double mag = std::sqrt(dx * dx + dy * dy);
    if (mag <= 1.0) {
        dx = missile.state.x - BATTERY_X;
        dy = std::max(missile.state.y, 850.0) - BATTERY_Y;
        mag = std::sqrt(dx * dx + dy * dy);
    }
    if (mag > 1.0) {
        launch.vx = (dx / mag) * INTERCEPTOR_LAUNCH_SPEED;
        launch.vy = (dy / mag) * INTERCEPTOR_LAUNCH_SPEED;
    }
    return launch;
}

void EngagementEngine::step(double dt) {
    if (dt <= 0.0) {
        return;
    }
    if (dt > 0.1) {
        dt = 0.1;
    }
    sim_time_ += dt;
    activate_pending();

    for (auto& missile : missiles_) {
        if (missile.threat_type == "ISKANDER" && missile.state.y < ISKANDER_TERMINAL_ALT) {
            missile.terminal_started = true;
            missile.terminal_elapsed += dt;
            missile.state.ax = iskander_lateral_accel(
                missile.terminal_elapsed,
                ISKANDER_MANEUVER_AX,
                ISKANDER_MANEUVER_FREQ
            );
        } else {
            missile.state.ax = 0.0;
        }

        update_state(missile.state, dt);

        if (in_radar_envelope(missile.state, BATTERY_X, BATTERY_Y, RADAR_RANGE_M, RADAR_MIN_ALT_M)) {
            missile.status = "ENGAGING";
            if (can_launch_for(missile.target_id)) {
                Interceptor interceptor;
                interceptor.state = launch_state_for(missile);
                interceptor.interceptor_id = "INT_" + missile.target_id.substr(missile.target_id.find('_') + 1);
                interceptor.target_id = missile.target_id;
                interceptors_.push_back(interceptor);
                launched_count_ += 1;
                last_launch_time_ = sim_time_;
                add_event("LAUNCH", interceptor.interceptor_id, interceptor.state, missile.target_id);
            }
        } else {
            missile.status = "TRACKING";
        }
    }

    for (const auto& missile : missiles_) {
        if (missile.state.y <= 0.0) {
            leaker_count_ += 1;
            add_event("GROUND_IMPACT", missile.target_id, missile.state, missile.threat_type);
        }
    }
    missiles_.erase(
        std::remove_if(
            missiles_.begin(),
            missiles_.end(),
            [](const Missile& missile) { return missile.state.y <= 0.0; }
        ),
        missiles_.end()
    );

    for (auto interceptor_it = interceptors_.begin(); interceptor_it != interceptors_.end();) {
        Missile* target = find_missile(interceptor_it->target_id);
        if (target == nullptr) {
            interceptor_it = interceptors_.erase(interceptor_it);
            continue;
        }

        if (range_between(interceptor_it->state, target->state) <= FUZE_RADIUS_M) {
            intercepted_count_ += 1;
            add_event("INTERCEPT", target->target_id, target->state, interceptor_it->interceptor_id);
            remove_missile(interceptor_it->target_id);
            interceptor_it = interceptors_.erase(interceptor_it);
            continue;
        }

        GuidanceCommand command = compute_pn_guidance(interceptor_it->state, target->state, NAV_CONSTANT);
        if (command.valid) {
            interceptor_it->state.ax = command.ax;
            interceptor_it->state.ay = command.ay;
        } else {
            interceptor_it->state.ax = 0.0;
            interceptor_it->state.ay = 0.0;
        }

        update_state(interceptor_it->state, dt);
        limit_speed(interceptor_it->state, INTERCEPTOR_MAX_SPEED);

        target = find_missile(interceptor_it->target_id);
        if (target != nullptr && range_between(interceptor_it->state, target->state) <= FUZE_RADIUS_M) {
            intercepted_count_ += 1;
            add_event("INTERCEPT", target->target_id, target->state, interceptor_it->interceptor_id);
            remove_missile(interceptor_it->target_id);
            interceptor_it = interceptors_.erase(interceptor_it);
        } else {
            ++interceptor_it;
        }
    }
}

std::vector<TrackSnapshot> EngagementEngine::tracks(double timestamp) const {
    std::vector<TrackSnapshot> out;
    out.reserve(missiles_.size() + interceptors_.size());

    for (const auto& missile : missiles_) {
        TrackSnapshot track;
        track.track_id = missile.target_id;
        track.object_type = "threat";
        track.x = missile.state.x;
        track.y = missile.state.y;
        track.vx = missile.state.vx;
        track.vy = missile.state.vy;
        track.speed_mps = std::sqrt(missile.state.vx * missile.state.vx + missile.state.vy * missile.state.vy);
        track.range_m = range_between(missile.state, make_state(BATTERY_X, BATTERY_Y, 0.0, 0.0));
        track.track_type = missile.threat_type;
        track.timestamp = timestamp;
        track.status = missile.status;
        track.target_id = "";
        out.push_back(track);
    }

    for (const auto& interceptor : interceptors_) {
        TrackSnapshot track;
        track.track_id = interceptor.interceptor_id;
        track.object_type = "interceptor";
        track.x = interceptor.state.x;
        track.y = interceptor.state.y;
        track.vx = interceptor.state.vx;
        track.vy = interceptor.state.vy;
        track.speed_mps = std::sqrt(interceptor.state.vx * interceptor.state.vx + interceptor.state.vy * interceptor.state.vy);
        track.range_m = range_between(interceptor.state, make_state(BATTERY_X, BATTERY_Y, 0.0, 0.0));
        track.track_type = "AIM9";
        track.timestamp = timestamp;
        track.status = "ENGAGING";
        track.target_id = interceptor.target_id;
        out.push_back(track);
    }

    return out;
}

EngagementSnapshot EngagementEngine::status(double timestamp) const {
    EngagementSnapshot snapshot;
    snapshot.timestamp = timestamp;
    snapshot.active_threats = static_cast<int>(missiles_.size() + pending_.size());
    snapshot.active_interceptors = static_cast<int>(interceptors_.size());
    snapshot.intercepted = intercepted_count_;
    snapshot.leakers = leaker_count_;
    snapshot.total = total_count_;
    return snapshot;
}

std::vector<EventSnapshot> EngagementEngine::events_since(int after_event_id) const {
    std::vector<EventSnapshot> out;
    for (const auto& event : events_) {
        if (event.event_id > after_event_id) {
            out.push_back(event);
        }
    }
    return out;
}
