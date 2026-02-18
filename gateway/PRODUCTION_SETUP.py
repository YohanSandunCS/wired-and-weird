"""
Production Face Recognition Setup Instructions

This guide helps you install dependencies and switch to production face recognition.
"""

# PRODUCTION FACE RECOGNITION SETUP
# ===================================

## STEP 1: Install Prerequisites (Windows)

# Install Visual Studio Build Tools (required for dlib compilation)
# Download from: https://visualstudio.microsoft.com/downloads/
# Select "Desktop development with C++" workload

# OR use pre-built wheels (easier):
# pip install https://github.com/z-mahmud22/Dlib_Windows_Python3.x/raw/main/dlib-19.24.0-cp311-cp311-win_amd64.whl

## STEP 2: Install CMake
# pip install cmake

## STEP 3: Install Production Dependencies
# pip install -r requirements_production.txt

# This will install:
# - face_recognition (with dlib)
# - opencv-python
# - numpy

## STEP 4: Update main.py to use production auth

# In gateway/app/main.py, change:
#   from .auth_simple import create_auth_router
# To:
#   from .auth_production import create_auth_router

## STEP 5: Restart Gateway
# python main.py

# ===================================
# VERIFICATION
# ===================================

# Test if installation worked:
# python -c "import face_recognition; print(face_recognition.__version__)"

# Expected output: 1.3.0 (or higher)

# ===================================
# TROUBLESHOOTING
# ===================================

# If dlib fails to install:
# 1. Use pre-built wheel (see STEP 1)
# 2. OR install via conda: conda install -c conda-forge dlib

# If CMake not found:
# pip install cmake
# OR download from: https://cmake.org/download/

# If face_recognition fails:
# pip install --upgrade pip
# pip install face_recognition --no-cache-dir

# ===================================
# FEATURES OF PRODUCTION MODE
# ===================================

# ✓ Real face detection (finds faces in images)
# ✓ 128-dimensional face encodings (deep learning)
# ✓ High accuracy matching (99%+ with good images)
# ✓ Robust to lighting/pose changes
# ✓ Works with different angles
# ✓ Detects multiple faces (rejects if >1 face)
# ✓ Stores only encodings (not images) - privacy-friendly
# ✓ Fast comparison (0.6 threshold for matching)

# ===================================
# COMPARISON: SIMPLE vs PRODUCTION
# ===================================

# SIMPLE MODE (auth_simple.py):
#   - No dependencies needed (Pillow only)
#   - Compares full images
#   - Low accuracy (~60-70%)
#   - Sensitive to lighting/background
#   - Good for: Demo/testing
#
# PRODUCTION MODE (auth_production.py):
#   - Requires face_recognition + dlib
#   - Uses 128-d face encodings
#   - High accuracy (99%+)
#   - Robust to variations
#   - Good for: Real deployment

print(__doc__)
