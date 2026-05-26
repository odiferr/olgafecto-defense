#ifndef PROXIMITY_FUZE_HPP
#define PROXIMITY_FUZE_HPP

#include "kinematics.hpp"

// Returns true if the magnetic field strength between the two states exceeds the threshold
bool check_proximity_fuze(const State& s1, const State& s2, double b0, double b_threshold);

#endif
