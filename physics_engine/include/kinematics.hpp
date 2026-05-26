#ifndef KINEMATICS_HPP
#define KINEMATICS_HPP

// The physical state of any moving entity in our 2D world
struct State {
    double x;
    double y;
    double vx;
    double vy;
    double ax;
    double ay;
};

// Contract: Takes a State object and a time delta, mutates the state forward in time.
// Note the '&'  we are passing by reference to modify the actual object, not a copy.
void update_state(State& state, double dt);

#endif
