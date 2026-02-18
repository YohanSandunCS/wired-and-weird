# Start MediRunner Gateway Server
Write-Host "Starting MediRunner Gateway Server..." -ForegroundColor Green
Write-Host ""

# Check if Python is available
if (!(Get-Command python -ErrorAction SilentlyContinue)) {
    Write-Host "Error: Python not found in PATH" -ForegroundColor Red
    exit 1
}

# Check if we're in the gateway directory
if (!(Test-Path "main.py")) {
    Write-Host "Error: main.py not found. Make sure you're in the gateway directory" -ForegroundColor Red
    exit 1
}

# Install dependencies if needed
if (!(Test-Path "venv")) {
    Write-Host "Creating virtual environment..." -ForegroundColor Yellow
    python -m venv venv
    
    Write-Host "Activating virtual environment..." -ForegroundColor Yellow
    & "venv\Scripts\Activate.ps1"
    
    Write-Host "Installing dependencies..." -ForegroundColor Yellow
    pip install -r requirements.txt
} else {
    Write-Host "Activating virtual environment..." -ForegroundColor Yellow
    & "venv\Scripts\Activate.ps1"
}

# Display connection info
Write-Host ""
Write-Host "================================" -ForegroundColor Cyan
Write-Host "MediRunner Gateway Starting" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host "Server will be available at:" -ForegroundColor White
Write-Host "  - WebSocket (Robot):   ws://localhost:8000/ws/robot?robotId=YOUR_ID" -ForegroundColor Green
Write-Host "  - WebSocket (Console): ws://localhost:8000/ws/console?robotId=YOUR_ID" -ForegroundColor Green
Write-Host "  - HTTP API:            http://localhost:8000/docs" -ForegroundColor Green
Write-Host ""
Write-Host "Press Ctrl+C to stop" -ForegroundColor Yellow
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Start the server
python main.py
