# MediRunner WSClientRobot

This project contains a Mock WebSocket robot client for testing purposes

## Configuration

All configurable values are stored in the `.env` file. Copy `.env.example` to `.env` and modify the values as needed.

### Environment Variables

#### Robot Configuration
- `ROBOT_ID`: Unique identifier for the robot (default: "robot-01")
- `WS_HOST`: WebSocket server host (default: "127.0.0.1")
- `WS_PORT`: WebSocket server port (default: "8000")

#### Robot Behavior
- `INITIAL_BATTERY_LEVEL`: Starting battery level percentage (default: 100)
- `TELEMETRY_INTERVAL`: Seconds between telemetry reports (default: 2)
- `RECONNECT_INTERVAL`: Seconds between reconnection attempts (default: 5)
- `PING_INTERVAL`: Seconds between ping messages (default: 30)
- `PING_TIMEOUT`: Ping response timeout in seconds (default: 10)
- `RETRY_INITIAL_DELAY`: Initial retry delay in seconds (default: 1)
- `RETRY_MAX_DELAY`: Maximum retry delay in seconds (default: 30)

#### Video Streaming
- `FRAME_WIDTH`: Width of streamed video frames in pixels (default: 320)
- `FRAME_HEIGHT`: Height of streamed video frames in pixels (default: 240)
- `JPEG_QUALITY`: JPEG compression quality 0-100 (default: 60)
- `FRAME_INTERVAL_SEC`: Seconds between video frames (default: 0.1 for 10fps)


## Installation

#### On Windows:

```powershell
# Create virtual environment
python -m venv venv

# Activate virtual environment
.\venv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt

 Modify the `.env` file with your desired configuration values.
```

## Usage

### Running the Robot Client
```bash
python Robot.py
```
## Features

### Core Functionality
- WebSocket connection to MediRunner gateway
- Automated ping/pong for connection health
- Telemetry reporting with battery simulation
- Automatic reconnection with exponential backoff

### Video Streaming
- Live mock video stream from `./assets/mock_camera_video.mp4`
- Automatic video loop when file ends
- Configurable frame rate, resolution, and JPEG quality
- Base64-encoded JPEG frames sent as `vision_frame` messages
- Non-blocking operation alongside telemetry and commands



The robot will automatically:
1. Connect to the WebSocket server
2. Start sending telemetry data
3. Begin streaming video frames from the mock video file
4. Respond to ping messages from the server