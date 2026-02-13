#!/bin/bash
# MediRunner Robot Launcher Script
# Ensures proper environment and starts the robot

echo "========================================"
echo "MediRunner Robot Launcher"
echo "========================================"

# Check if running on Raspberry Pi
if [ ! -f /proc/device-tree/model ] || ! grep -q "Raspberry Pi" /proc/device-tree/model 2>/dev/null; then
    echo "⚠️  Warning: This does not appear to be a Raspberry Pi"
    echo "Robot hardware will not function correctly"
    read -p "Continue anyway? (y/n): " confirm
    if [ "$confirm" != "y" ]; then
        echo "Exiting..."
        exit 1
    fi
fi

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️  .env file not found"
    echo "Creating from .env.example..."
    cp .env.example .env
    echo "✓ Created .env file"
    echo ""
    echo "Please edit .env to configure:"
    echo "  - GATEWAY_HOST (gateway server IP)"
    echo "  - ROBOT_ID (unique identifier)"
    echo ""
    read -p "Press Enter to continue..."
fi

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "⚠️  Virtual environment not found"
    read -p "Create virtual environment? (y/n): " create_venv
    if [ "$create_venv" = "y" ]; then
        echo "Creating virtual environment..."
        python3 -m venv venv
        echo "✓ Virtual environment created"
        
        echo "Installing dependencies..."
        source venv/bin/activate
        pip install --upgrade pip
        pip install -r requirements.txt
        echo "✓ Dependencies installed"
    else
        echo "Continuing without virtual environment..."
    fi
fi

# Activate virtual environment if it exists
if [ -d "venv" ]; then
    echo "Activating virtual environment..."
    source venv/bin/activate
fi

# Check Python dependencies
echo "Checking dependencies..."
python3 -c "import RPi.GPIO, websockets, dotenv, picamera2" 2>/dev/null
if [ $? -ne 0 ]; then
    echo "⚠️  Missing dependencies"
    read -p "Install now? (y/n): " install_deps
    if [ "$install_deps" = "y" ]; then
        pip install -r requirements.txt
    else
        echo "⚠️  Robot may not function correctly"
    fi
fi

echo ""
echo "========================================"
echo "Starting MediRunner Robot..."
echo "========================================"
echo ""

# Check if we need sudo for GPIO access
if ! python3 -c "import RPi.GPIO; RPi.GPIO.setmode(RPi.GPIO.BCM)" 2>/dev/null; then
    echo "⚠️  GPIO access requires elevated permissions"
    echo "Running with sudo..."
    sudo $(which python3) main.py
else
    python3 main.py
fi
