#ifndef PN_GUIDANCE_HPP
#define PN_GUIDANCE_HPP

#include "kinematics.hpp"

struct GuidanceCommand {
    double ax;    // Commanded acceleration, x-component (m/s^2)
    double ay;    // Commanded acceleration, y-component (m/s^2)
    bool   valid; // False when range is below safety threshold (near intercept)
};
// Declare our  function contract
GuidanceCommand compute_pn_guidance(const State& interceptor, const State& target, double N);
#endif
