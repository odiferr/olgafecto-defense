// bindings/bindings.cpp
#include <pybind11/pybind11.h>
#include <pybind11/stl.h>
#include "kinematics.hpp"
#include "proximity_fuze.hpp"
#include "pn_guidance.hpp"
#include "engagement.hpp"
namespace py = pybind11;

PYBIND11_MODULE(physics_engine, m, py::mod_gil_not_used()) {

    py::class_<State>(m,"State")
        .def(py::init<>())
        .def_readwrite("x", &State::x)
        .def_readwrite("y", &State::y)
        .def_readwrite("vx", &State::vx)
        .def_readwrite("vy", &State::vy)
        .def_readwrite("ax", &State::ax)
        .def_readwrite("ay", &State::ay) ;

        m.def("update_state", &update_state);
        m.def("check_proximity_fuze", &check_proximity_fuze);
        m.def("range_between", &range_between);
        m.def("in_radar_envelope", &in_radar_envelope);
        m.def("limit_speed", &limit_speed);
        m.def("iskander_lateral_accel", &iskander_lateral_accel);

    py::class_<GuidanceCommand>(m, "GuidanceCommand")
        .def(py::init<>())
        .def_readwrite("ax", &GuidanceCommand::ax)
        .def_readwrite("ay", &GuidanceCommand::ay)
        .def_readwrite("valid", &GuidanceCommand::valid);
    m.def("compute_pn_guidance", &compute_pn_guidance);

    py::class_<TrackSnapshot>(m, "TrackSnapshot")
        .def_readonly("track_id", &TrackSnapshot::track_id)
        .def_readonly("object_type", &TrackSnapshot::object_type)
        .def_readonly("x", &TrackSnapshot::x)
        .def_readonly("y", &TrackSnapshot::y)
        .def_readonly("vx", &TrackSnapshot::vx)
        .def_readonly("vy", &TrackSnapshot::vy)
        .def_readonly("speed_mps", &TrackSnapshot::speed_mps)
        .def_readonly("range_m", &TrackSnapshot::range_m)
        .def_readonly("track_type", &TrackSnapshot::track_type)
        .def_readonly("timestamp", &TrackSnapshot::timestamp)
        .def_readonly("status", &TrackSnapshot::status)
        .def_readonly("target_id", &TrackSnapshot::target_id);

    py::class_<EngagementSnapshot>(m, "EngagementSnapshot")
        .def_readonly("timestamp", &EngagementSnapshot::timestamp)
        .def_readonly("active_threats", &EngagementSnapshot::active_threats)
        .def_readonly("active_interceptors", &EngagementSnapshot::active_interceptors)
        .def_readonly("intercepted", &EngagementSnapshot::intercepted)
        .def_readonly("leakers", &EngagementSnapshot::leakers)
        .def_readonly("total", &EngagementSnapshot::total);

    py::class_<EventSnapshot>(m, "EventSnapshot")
        .def_readonly("event_id", &EventSnapshot::event_id)
        .def_readonly("timestamp", &EventSnapshot::timestamp)
        .def_readonly("event_type", &EventSnapshot::event_type)
        .def_readonly("track_id", &EventSnapshot::track_id)
        .def_readonly("x", &EventSnapshot::x)
        .def_readonly("y", &EventSnapshot::y)
        .def_readonly("detail", &EventSnapshot::detail);

    py::class_<ThreatSeed>(m, "ThreatSeed")
        .def_readonly("threat_type", &ThreatSeed::threat_type)
        .def_readonly("initial_x", &ThreatSeed::initial_x)
        .def_readonly("initial_y", &ThreatSeed::initial_y)
        .def_readonly("initial_vx", &ThreatSeed::initial_vx)
        .def_readonly("initial_vy", &ThreatSeed::initial_vy)
        .def_readonly("delay_s", &ThreatSeed::delay_s);

    py::class_<StressBucket>(m, "StressBucket")
        .def_readonly("missile_count", &StressBucket::missile_count)
        .def_readonly("trials", &StressBucket::trials)
        .def_readonly("avg_intercepted", &StressBucket::avg_intercepted)
        .def_readonly("avg_leakers", &StressBucket::avg_leakers)
        .def_readonly("neutralized_pct", &StressBucket::neutralized_pct)
        .def_readonly("zero_leaker_pct", &StressBucket::zero_leaker_pct)
        .def_readonly("assessment", &StressBucket::assessment);

    py::class_<StressResult>(m, "StressResult")
        .def_readonly("buckets", &StressResult::buckets)
        .def_readonly("breakpoint_count", &StressResult::breakpoint_count)
        .def_readonly("breakpoint_assessment", &StressResult::breakpoint_assessment)
        .def_readonly("primary_failure", &StressResult::primary_failure);

    py::class_<EngagementEngine>(m, "EngagementEngine")
        .def(py::init<>())
        .def("reset", &EngagementEngine::reset)
        .def("add_threat", &EngagementEngine::add_threat)
        .def("add_threat_delayed", &EngagementEngine::add_threat_delayed)
        .def("step", &EngagementEngine::step)
        .def("tracks", &EngagementEngine::tracks)
        .def("status", &EngagementEngine::status)
        .def("events_since", &EngagementEngine::events_since)
        .def("configure_fire_control", &EngagementEngine::configure_fire_control);

    m.def("generate_threat_seeds", &generate_threat_seeds);
    m.def("run_stress_test", &run_stress_test);
}
