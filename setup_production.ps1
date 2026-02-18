# Production Face Recognition Setup Script
# Run this script in PowerShell from the project root directory

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "Production Face Recognition Setup" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Backend Dependencies
Write-Host "STEP 1: Installing Backend Dependencies" -ForegroundColor Yellow
Write-Host "---------------------------------------" -ForegroundColor Yellow
Write-Host ""
Write-Host "Installing Python packages for face recognition..." -ForegroundColor White

# Check if virtual environment exists
if (Test-Path "gateway\venv") {
    Write-Host "✓ Virtual environment found" -ForegroundColor Green
    
    # Activate venv and install
    Write-Host "Activating virtual environment and installing packages..." -ForegroundColor White
    & gateway\venv\Scripts\Activate.ps1
    
    # Install dlib pre-built wheel first (Windows only)
    Write-Host ""
    Write-Host "Installing dlib (pre-built wheel for Windows)..." -ForegroundColor Cyan
    pip install https://github.com/z-mahmud22/Dlib_Windows_Python3.x/raw/main/dlib-19.24.1-cp312-cp312-win_amd64.whl
    
    Write-Host ""
    Write-Host "Installing face_recognition and dependencies..." -ForegroundColor Cyan
    pip install -r gateway\requirements_production.txt
    
    Write-Host ""
    Write-Host "✓ Backend dependencies installed!" -ForegroundColor Green
} else {
    Write-Host "✗ Virtual environment not found at gateway\venv" -ForegroundColor Red
    Write-Host "Please create a virtual environment first:" -ForegroundColor Yellow
    Write-Host "  cd gateway" -ForegroundColor White
    Write-Host "  python -m venv venv" -ForegroundColor White
    Write-Host "  venv\Scripts\Activate.ps1" -ForegroundColor White
    Write-Host "  pip install -r requirements_production.txt" -ForegroundColor White
    exit 1
}

Write-Host ""
Write-Host ""

# Step 2: Frontend Dependencies
Write-Host "STEP 2: Installing Frontend Dependencies" -ForegroundColor Yellow
Write-Host "---------------------------------------" -ForegroundColor Yellow
Write-Host ""
Write-Host "Installing MediaPipe packages..." -ForegroundColor White

cd frontend
npm install @mediapipe/face_detection @mediapipe/camera_utils

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "✓ Frontend dependencies installed!" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "✗ Frontend installation failed" -ForegroundColor Red
    Write-Host "Please run manually:" -ForegroundColor Yellow
    Write-Host "  cd frontend" -ForegroundColor White
    Write-Host "  npm install @mediapipe/face_detection @mediapipe/camera_utils" -ForegroundColor White
    cd ..
    exit 1
}

cd ..

Write-Host ""
Write-Host ""

# Step 3: Verification
Write-Host "STEP 3: Verifying Installation" -ForegroundColor Yellow
Write-Host "---------------------------------------" -ForegroundColor Yellow
Write-Host ""

Write-Host "Checking Python packages..." -ForegroundColor White
& gateway\venv\Scripts\Activate.ps1
python -c "import face_recognition; import cv2; import numpy; print('✓ All Python packages imported successfully')" 2>$null

if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Backend verification passed" -ForegroundColor Green
} else {
    Write-Host "✗ Backend verification failed" -ForegroundColor Red
    Write-Host "Some packages may not have installed correctly" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Checking frontend packages..." -ForegroundColor White
if ((Test-Path "frontend\node_modules\@mediapipe\face_detection") -and (Test-Path "frontend\node_modules\@mediapipe\camera_utils")) {
    Write-Host "✓ Frontend verification passed" -ForegroundColor Green
} else {
    Write-Host "✗ Frontend verification failed" -ForegroundColor Red
}

Write-Host ""
Write-Host ""

# Step 4: Configuration
Write-Host "STEP 4: Configuration" -ForegroundColor Yellow
Write-Host "---------------------------------------" -ForegroundColor Yellow
Write-Host ""

Write-Host "Checking gateway configuration..." -ForegroundColor White
$mainPyContent = Get-Content "gateway\app\main.py" -Raw
if ($mainPyContent -match "from \.auth_production import create_auth_router") {
    Write-Host "✓ Gateway configured to use production auth" -ForegroundColor Green
} else {
    Write-Host "✗ Gateway not configured for production" -ForegroundColor Red
    Write-Host "Please edit gateway\app\main.py line 14:" -ForegroundColor Yellow
    Write-Host "  Change: from .auth_simple import create_auth_router" -ForegroundColor White
    Write-Host "  To:     from .auth_production import create_auth_router" -ForegroundColor White
}

Write-Host ""
Write-Host "Checking frontend routes..." -ForegroundColor White
$pageTsxContent = Get-Content "frontend\app\page.tsx" -Raw
if ($pageTsxContent -match "face-login-production" -and $pageTsxContent -match "enroll-production") {
    Write-Host "✓ Frontend configured to use production pages" -ForegroundColor Green
} else {
    Write-Host "✗ Frontend not configured for production" -ForegroundColor Red
    Write-Host "Please edit frontend\app\page.tsx:" -ForegroundColor Yellow
    Write-Host "  Change login route to: /face-login-production" -ForegroundColor White
    Write-Host "  Change enroll route to: /enroll-production" -ForegroundColor White
}

Write-Host ""
Write-Host ""

# Summary
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "Setup Complete!" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Start the gateway server:" -ForegroundColor White
Write-Host "   cd gateway" -ForegroundColor Gray
Write-Host "   venv\Scripts\Activate.ps1" -ForegroundColor Gray
Write-Host "   python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Start the frontend (in new terminal):" -ForegroundColor White
Write-Host "   cd frontend" -ForegroundColor Gray
Write-Host "   npm run dev" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Open browser:" -ForegroundColor White
Write-Host "   http://localhost:3000" -ForegroundColor Gray
Write-Host ""
Write-Host "4. Test the system:" -ForegroundColor White
Write-Host "   - Click 'Enroll New User' to register faces" -ForegroundColor Gray
Write-Host "   - You should see green bounding box around face" -ForegroundColor Gray
Write-Host "   - Click 'Login with Face Recognition' to authenticate" -ForegroundColor Gray
Write-Host ""
Write-Host "For troubleshooting, see:" -ForegroundColor Yellow
Write-Host "  - PRODUCTION_FACE_RECOGNITION_SETUP.md" -ForegroundColor White
Write-Host "  - gateway\PRODUCTION_SETUP.py" -ForegroundColor White
Write-Host "  - frontend\MEDIAPIPE_INSTALL.md" -ForegroundColor White
Write-Host ""
