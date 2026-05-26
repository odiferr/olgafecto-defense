#include "proximity_fuze.hpp"
#include <cmath> // Needed for sqrt

bool check_proximity_fuze(const State& s1, const State& s2, double b0, double b_threshold) {



    double delta_x = s2.x - s1.x ; //  Compute delta x
    double delta_y = s2.y - s1.y ; // Compute delta y



    double distance_r = std:: sqrt(delta_x*delta_x + delta_y*delta_y);     // 2 Compute scalar distance r using std::sqrt


    if (distance_r < 0.001) {
        return true;
     } // 3 guardrail check: if r is less than 0.001, return true

    // 4 Compute B = b0 / (r * r * r)
    double field_strength = b0 /(distance_r * distance_r * distance_r) ;

    // 5 Return whether B is greater than or equal to b_threshold

    return field_strength >= b_threshold;
}
