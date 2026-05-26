#include "pn_guidance.hpp"
#include <cmath> // Needed for std::sqrt

GuidanceCommand compute_pn_guidance(const State& interceptor, const State& target, double N) {
    GuidanceCommand cmd;
    cmd.ax = 0.0;
    cmd.ay = 0.0;
    cmd.valid = true;

    // 1. Compute relative positions: delta_x and delta_y

    double delta_x = target.x - interceptor.x ;
    double delta_y = target.y - interceptor.y ;


    // 2. Compute true scalar range R using std::sqrt

    double R = sqrt(delta_x*delta_x + delta_y*delta_y);

    // 3.apply gaurdrail
    // If R is less than a safe distance threshold

    if(R < 0.1){
        cmd.valid =false;
        return cmd; //the hypotenuse, the actual distance between them. If R gets  near zero, you're essentially already at the target
    }
    // set cmd.valid = false and return cmd  to prevent NaN crashes

    // 4. Compute relative velocities: delta_vx and delta_vy
    double delta_vx = target.vx - interceptor.vx;
    double delta_vy = target.vy - interceptor.vy;


    // 5. Compute Closing Velocity

    double closing_velo = -((delta_x * delta_vx + delta_y * delta_vy)/R);

    // compute Line-of-Sight Rate ,lambda_dot
    double line_sight = (delta_x * delta_vy - delta_y * delta_vx) / (R * R);

    // 6. Compute total acceleration magnitude: a = N * Vc * lambda_dot
    double a_total_mag = N * closing_velo * line_sight;

    // 7. Map magnitude to directional components: ax and ay using the perpendicular formulas
    cmd.ax = a_total_mag * (-delta_y/R);
    cmd.ay = a_total_mag * (delta_x/R);




    return cmd;
}
