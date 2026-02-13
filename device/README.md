# MediRunner Robot - Device Code

This directory contains code to be executed on a **Raspberry Pi 4 Model B** device only.

## Stage 1 Implementation

Stage 1 includes:
- ✅ Hardware initialization (motors, sensors, camera, buzzer)
- ✅ WebSocket connection to gateway server
- ✅ Robot registration with unique ID
- ✅ Real-time telemetry streaming
- ✅ Live camera feed streaming
- ✅ Remote command reception and execution
- ✅ Automatic reconnection logic

## Project Structure

```
device/
├── main.py                  # Entry point - run this on Raspberry Pi
├── config.py                # Configuration management (.env loader)
├── requirements.txt         # Python dependencies
├── .env.example            # Environment variables template
├── hardware/               # Hardware control modules
│   ├── __init__.py
│   ├── motors.py           # L298N motor driver control
│   ├── sensors.py          # IR sensors, proximity, bump sensors
│   ├── camera.py           # Raspberry Pi Camera Module
│   └── buzzer.py           # Audio alerts
└── network/                # Network communication
    ├── __init__.py
    └── websocket_client.py # Gateway WebSocket client
```

## Hardware Connections

### L298N Motor Driver (DC Motors)
- **Enable A (Left)**: GPIO 22 (PWM)
- **Input 1 (Left Forward)**: GPIO 17
- **Input 2 (Left Backward)**: GPIO 18
- **Enable B (Right)**: GPIO 25 (PWM)
- **Input 3 (Right Forward)**: GPIO 23
- **Input 4 (Right Backward)**: GPIO 24

### IR Line Sensor Array
- **Left 2**: GPIO 5
- **Left 1**: GPIO 6
- **Center**: GPIO 13
- **Right 1**: GPIO 19
- **Right 2**: GPIO 26

### Other Sensors
- **Proximity Sensor**: GPIO 16
- **Bump Sensor**: GPIO 20

### Buzzer
- **Buzzer**: GPIO 21

### Camera
- Raspberry Pi Camera Module (CSI port)

## Setup Instructions

### 1. Prerequisites on Raspberry Pi

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Python 3 and pip
sudo apt install python3 python3-pip -y

# Install system dependencies for camera
sudo apt install python3-picamera2 -y

# Enable camera interface
sudo raspi-config
# Navigate to: Interface Options > Camera > Enable
```

### 2. Clone Repository

```bash
cd ~
git clone <repository-url>
cd wired-and-weird/device
```

### 3. Create Virtual Environment (Recommended)

```bash
python3 -m venv venv
source venv/bin/activate
```

### 4. Install Python Dependencies

```bash
pip install -r requirements.txt
```

### 5. Configure Environment Variables

```bash
# Copy example configuration
cp .env.example .env

# Edit configuration
nano .env
```

**Important variables to configure:**
- `GATEWAY_HOST`: IP address of gateway server
- `GATEWAY_PORT`: Gateway WebSocket port (default: 8765)
- `ROBOT_ID`: Unique identifier for this robot
- `ROBOT_NAME`: Display name

### 6. Test Hardware (Optional)

Test individual components before running main program:

```bash
# Test motors
python3 -c "from hardware import MotorController; m = MotorController(); m.forward(50); import time; time.sleep(2); m.stop(); m.cleanup()"

# Test sensors
python3 -c "from hardware import SensorArray; s = SensorArray(); print(s.read_all())"

# Test camera
python3 -c "from hardware import Camera; c = Camera(); c.start(); import time; time.sleep(2); c.stop()"

# Test buzzer
python3 -c "from hardware import Buzzer; b = Buzzer(); b.alert_startup()"
```

## Running the Robot

### Standard Run

```bash
python3 main.py
```

### Run with Elevated Permissions (if needed)

```bash
sudo python3 main.py
```

### Run on Startup (Systemd Service)

Create a systemd service to auto-start robot on boot:

```bash
sudo nano /etc/systemd/system/medirunner.service
```

Add the following:

```ini
[Unit]
Description=MediRunner Robot Service
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/wired-and-weird/device
ExecStart=/home/pi/wired-and-weird/device/venv/bin/python3 main.py
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start service:

```bash
sudo systemctl enable medirunner.service
sudo systemctl start medirunner.service

# Check status
sudo systemctl status medirunner.service

# View logs
sudo journalctl -u medirunner.service -f
```

## Control Commands

The robot accepts the following commands via WebSocket:

### Motor Commands
```json
{"type": "command", "payload": {"command": "forward", "speed": 70}}
{"type": "command", "payload": {"command": "backward", "speed": 70}}
{"type": "command", "payload": {"command": "left", "speed": 60}}
{"type": "command", "payload": {"command": "right", "speed": 60}}
{"type": "command", "payload": {"command": "stop"}}
{"type": "command", "payload": {"command": "set_speed", "speed": 80}}
```

### Mode Commands
```json
{"type": "command", "payload": {"command": "set_mode", "mode": "manual"}}
{"type": "command", "payload": {"command": "set_mode", "mode": "auto"}}
```

### Utility Commands
```json
{"type": "command", "payload": {"command": "beep"}}
```

## Telemetry Data Output

The robot sends telemetry at configured intervals:

```json
{
  "type": "telemetry",
  "robot_id": "medirunner_001",
  "timestamp": "2026-02-13T10:30:45.123456",
  "payload": {
    "sensors": {
      "line_sensors": {
        "left2": 1,
        "left1": 0,
        "center": 0,
        "right1": 1,
        "right2": 1
      },
      "proximity": false,
      "bump": false,
      "line_detected": true
    },
    "mode": "manual"
  }
}
```

## Video Stream Format

Camera frames are sent as base64-encoded JPEG:

```json
{
  "type": "video_frame",
  "robot_id": "medirunner_001",
  "timestamp": "2026-02-13T10:30:45.234567",
  "encoding": "base64",
  "payload": "data:image/jpeg;base64,/9j/4AAQSkZJRg..."
}
```

## Troubleshooting

### GPIO Permission Denied
```bash
# Add user to gpio group
sudo usermod -a -G gpio $USER

# Or run with sudo
sudo python3 main.py
```

### Camera Not Working
```bash
# Enable camera
sudo raspi-config

# Check camera detected
vcgencmd get_camera

# Install picamera2
sudo apt install python3-picamera2
```

### WebSocket Connection Failed
- Verify gateway server is running
- Check `GATEWAY_HOST` and `GATEWAY_PORT` in `.env`
- Verify network connectivity: `ping <gateway_host>`

### Import Errors
```bash
# Ensure virtual environment is activated
source venv/bin/activate

# Reinstall dependencies
pip install -r requirements.txt
```

## Configuration Reference

See `.env.example` for all configurable parameters:
- Gateway connection settings
- GPIO pin mappings
- Camera resolution and quality
- Motor speeds
- Telemetry interval
- Debug mode

## Next Stages

- **Stage 2**: Line following algorithm, stable autonomous navigation
- **Stage 3**: Sign detection with computer vision, zone awareness
- **Stage 4**: Innovation features and medical domain integration

## Safety Notes

- ⚠️ Always test motors at low speeds first
- ⚠️ Ensure adequate power supply for motors
- ⚠️ Stop motors before making hardware changes
- ⚠️ Handle camera module with care (static sensitive)