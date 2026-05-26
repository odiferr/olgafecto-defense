cmake_minimum_required(VERSION 3.15)
project(PhysicsEngine)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Find pybind11 inside the active virtual environment
set(PYBIND11_FINDPYTHON ON)
find_package(pybind11 REQUIRED)

# Include directories so headers can be found seamlessly
include_directories(include/)

# Physics engine implementation files.
set(ENGINE_SOURCES
    src/engagement.cpp
    src/kinematics.cpp
    src/pn_guidance.cpp
    src/proximity_fuze.cpp
)

# Build the shared library module for Python ingestion
pybind11_add_module(physics_engine ${ENGINE_SOURCES} bindings/bindings.cpp)

target_include_directories(physics_engine PRIVATE include/)
