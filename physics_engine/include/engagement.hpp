#ifndef ENGAGEMENT_HPP
#define ENGAGEMENT_HPP

#include "kinematics.hpp"
#include <string>
#include <vector>

double range_between(const State& a, const State& b);
bool in_radar_envelope(const State& target, double radar_x, double radar_y, double max_range, double min_altitude);
void limit_speed(State& state, double max_speed);
double iskander_lateral_accel(double elapsed_terminal_time, double peak_accel, double frequency);

struct TrackSnapshot {
    std::string track_id;
    std::string object_type;
    double x;
    double y;
    double vx;
    double vy;
    double speed_mps;
    double range_m;
    std::string track_type;
    double timestamp;
    std::string status;
    std::string target_id;
};

struct EngagementSnapshot {
    double timestamp;
    int active_threats;
    int active_interceptors;
    int intercepted;
    int leakers;
    int total;
};

struct EventSnapshot {
    int event_id;
    double timestamp;
    std::string event_type;
    std::string track_id;
    double x;
    double y;
    std::string detail;
};

struct ThreatSeed {
    std::string threat_type;
    double initial_x;
    double initial_y;
    double initial_vx;
    double initial_vy;
    double delay_s;
};

struct StressBucket {
    int missile_count;
    int trials;
    double avg_intercepted;
    double avg_leakers;
    double neutralized_pct;
    double zero_leaker_pct;
    std::string assessment;
};

struct StressResult {
    std::vector<StressBucket> buckets;
    int breakpoint_count;
    std::string breakpoint_assessment;
    std::string primary_failure;
};

std::vector<ThreatSeed> generate_threat_seeds(const std::string& scenario_kind, int count, unsigned int seed);
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
);

class EngagementEngine {
public:
    void reset();
    void add_threat(
        const std::string& threat_type,
        double initial_x,
        double initial_y,
        double initial_vx,
        double initial_vy
    );
    void add_threat_delayed(
        const std::string& threat_type,
        double initial_x,
        double initial_y,
        double initial_vx,
        double initial_vy,
        double delay_s
    );
    void step(double dt);
    std::vector<TrackSnapshot> tracks(double timestamp) const;
    EngagementSnapshot status(double timestamp) const;
    std::vector<EventSnapshot> events_since(int after_event_id) const;
    void configure_fire_control(int interceptor_inventory, double launcher_cooldown_s, int max_interceptors_per_target);

private:
    struct PendingThreat {
        std::string threat_type;
        double initial_x;
        double initial_y;
        double initial_vx;
        double initial_vy;
        double delay_s;
    };

    struct Missile {
        State state;
        std::string threat_type;
        std::string target_id;
        double terminal_elapsed;
        bool terminal_started;
        std::string status;
    };

    struct Interceptor {
        State state;
        std::string interceptor_id;
        std::string target_id;
    };

    std::vector<PendingThreat> pending_;
    std::vector<Missile> missiles_;
    std::vector<Interceptor> interceptors_;
    std::vector<EventSnapshot> events_;
    double sim_time_ = 0.0;
    int total_count_ = 0;
    int intercepted_count_ = 0;
    int leaker_count_ = 0;
    int next_threat_id_ = 1;
    int next_event_id_ = 1;
    int interceptor_inventory_ = 12;
    int launched_count_ = 0;
    int max_interceptors_per_target_ = 1;
    double launcher_cooldown_s_ = 0.65;
    double last_launch_time_ = -999.0;

    Missile* find_missile(const std::string& target_id);
    const Missile* find_missile(const std::string& target_id) const;
    bool has_interceptor_for(const std::string& target_id) const;
    int interceptor_count_for(const std::string& target_id) const;
    bool can_launch_for(const std::string& target_id) const;
    void remove_missile(const std::string& target_id);
    void activate_pending();
    void add_event(const std::string& event_type, const std::string& track_id, const State& state, const std::string& detail);
    State launch_state_for(const Missile& missile) const;
};

#endif
