import physics_engine
import random
# Initialize tracking entities
interceptor = physics_engine.State()
target = physics_engine.State()

# Test Constant
N_CONSTANT = random.uniform(3.0, 5.0)

print("--- RUNNING PROPORTIONAL NAVIGATION TRACKING TESTS ---")

# =====================================================================
# SCENARIO A: Standard Intercept Geometry
# Interceptor at origin flying North-East, Target ahead flying East
# =====================================================================
interceptor.x = 0.0
interceptor.y = 0.0
interceptor.vx = 100.0
interceptor.vy = 100.0

target.x = 200.0
target.y = 150.0
target.vx = 120.0
target.vy = 0.0

cmd_a = physics_engine.compute_pn_guidance(interceptor, target, N_CONSTANT)
print(f"Scenario A (Standard Pursuit) -> Valid: {cmd_a.valid} | Commanded ax: {cmd_a.ax:.2f} m/s², ay: {cmd_a.ay:.2f} m/s²")

# =====================================================================
# SCENARIO B: Near-Collision Singularity Guardrail
# Testing if the system disables guidance safely when overlapping
# =====================================================================
interceptor.x = 0.0
interceptor.y = 0.0
target.x = 0.05  # Within our 0.1 meter threshold zone!
target.y = 0.0

cmd_b = physics_engine.compute_pn_guidance(interceptor, target, N_CONSTANT)
print(f"Scenario B (Guardrail Intercept) -> Valid: {cmd_b.valid} | Commanded ax: {cmd_b.ax:.2f}, ay: {cmd_b.ay:.2f}")
