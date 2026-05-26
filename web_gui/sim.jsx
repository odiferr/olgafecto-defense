// Deprecated standalone simulator.
//
// This file intentionally contains no physics, guidance, detection, fuze,
// interceptor, or engagement logic. The active UI is web_gui_sim_api.jsx, which
// renders snapshots returned by sensor_api. The simulation is owned by the C++
// physics_engine EngagementEngine and exposed through the Python API.
console.warn(
  "sim.jsx is deprecated. Use simulator.html with web_gui_sim_api.jsx; physics is C++ driven."
);
