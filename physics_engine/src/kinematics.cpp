#include "kinematics.hpp"

void update_state(State& state, double dt) {


    // STEP 1: Update velocities based on current acceleration
    state.vx += (state.ax * dt);

    // STEP 2: Update positions based on the velocity
    state.x += (state.vx * dt);

    // STEP 3: Update velocities based on current acceleration
    state.vy += (state.ay * dt);

    // STEP 4: Update positions based on the velocity
    state.y += (state.vy * dt);
}
