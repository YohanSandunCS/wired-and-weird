# MediRunner Robot - AI Agent Instructions

## Project Overview
A one-day hackathon project building an autonomous hospital delivery robot with real-time control console. Three-component architecture: Raspberry Pi robot, Python WebSocket gateway, and Next.js frontend.

## Architecture & Data Flow

### Core Components
- **device/** - Python code for Raspberry Pi 4 (motors, sensors, camera, autonomous navigation)
- **gateway/** - Python WebSocket server acting as message broker between robot and frontend
- **frontend/** - Next.js control console for hospital staff (telemetry, video feed, manual control)

### Communication Pattern
```
Robot (WebSocket) ↔ Gateway Server ↔ Frontend (WebSocket)
```
- Robot registers with gateway on connection, sends video stream + telemetry, receives commands
- Frontend connects to gateway, displays live feed/telemetry, sends control commands
- Gateway is a **stateless broker** - no business logic, pure message routing

## Hardware Stack (Raspberry Pi Robot)
- Raspberry Pi 4 Model B
- L298N motor driver (DC motors control)
- IR Line Following Sensor Array (5 sensors + proximity + bump)
- Raspberry Pi Camera Module
- Buzzer for alerts

## Technology Choices

### Device (Raspberry Pi)
- **Python 3** - Use `RPi.GPIO`, `picamera2`, `websockets` libraries
- Hardware control via GPIO pins (motors on L298N, IR sensors, buzzer)
- Camera streaming: compress frames (JPEG) before sending via WebSocket
- Keep latency low - use asyncio for concurrent sensor reading + WebSocket communication

### Gateway Server
- **Python 3** with `websockets` or `socket.io`
- Maintain client registry: `{robot_id: ws_connection, frontend_clients: [ws_connections]}`
- Message routing only - no state persistence
- Handle reconnection logic for both robot and frontend

### Frontend
- **Next.js** (App Router or Pages Router - verify which is initialized)
- WebSocket client for real-time updates
- UI components: video feed display, telemetry dashboard, manual control interface, mode switcher (auto/manual)
- Consider using `socket.io-client` or native WebSocket API

## Key Development Workflows

### Running Components Locally
Since robot code runs on Raspberry Pi only, local development requires mocking:
```bash
# Gateway (runs on dev machine or Pi)
cd gateway
python server.py  # or uvicorn/similar

# Frontend (dev machine)
cd frontend
npm install
npm run dev
```

### Testing Device Code
- Use `device/` code on actual Raspberry Pi 4
- Mock sensor inputs when testing logic off-device
- Test WebSocket connection to gateway independently from hardware control

### Stage-Based Development
Competition has 4 stages - implement incrementally:
1. **Stage 1**: Basic assembly, login/enrollment UI, WebSocket connections
2. **Stage 2**: Line following algorithm, manual drive controls, telemetry display
3. **Stage 3**: Sign detection (computer vision), hospital zone logic, autonomous decision-making
4. **Stage 4**: Innovation extensions (advanced AI, medical domain features)

## Critical Patterns

### Message Protocol (WebSocket)
Define message types early and keep them consistent across all three components:
```json
// Example structure (define in shared schema)
{
  "type": "telemetry" | "command" | "video_frame" | "registration",
  "robot_id": "string",
  "payload": { ... }
}
```

### Robot Control Modes
- **Manual**: Frontend sends direct motor commands (forward/backward/turn)
- **Auto**: Robot follows line autonomously, frontend monitors only
- Implement clean mode switching without state conflicts

### Camera Streaming
- Compress frames on Pi before sending (target ~15-30 fps for responsiveness)
- Use JPEG encoding, adjust quality vs latency
- Frontend: decode base64 or binary frames and display in `<img>` or `<canvas>`

### Error Recovery
- Robot must handle line loss gracefully (search pattern, stop, alert)
- Gateway should handle client disconnects and notify other clients
- Frontend should show connection status prominently

## Project-Specific Conventions

### Directory Structure
Each component is self-contained with its own dependencies:
- No shared code directory (keep components decoupled for parallel development)
- Each README.md should document component-specific setup/run instructions

### Parallel Team Development
Project designed for pair programming and parallel work:
- Pilot team works on `device/` (robotics track)
- Co-pilot team works on `frontend/` (software track)
- Gateway can be developed early and shared as stable interface

### Competition Constraints
- Single day timeline - prioritize working prototype over perfect code
- Use AI assistance extensively (this is encouraged per competition brief)
- Hardware debugging is time-intensive - test software logic independently first

## Integration Points

### Robot-to-Gateway Registration
Robot must identify itself on connection (use unique ID or MAC address).

### Video Feed Encoding
Decide early: base64 strings vs binary WebSocket messages. Match encoder (Pi) and decoder (Next.js) formats.

### Command Acknowledgment
Robot should ACK received commands to help frontend track execution lag.

## Common Gotchas
- **Raspberry Pi GPIO**: Requires root/sudo or proper permissions
- **Camera module**: Needs `picamera2` (not `picamera` on newer Pi OS)
- **WebSocket reconnection**: Implement exponential backoff to avoid connection storms
- **CORS**: Frontend and gateway on different origins - configure properly
- **Line sensor calibration**: IR sensors need threshold tuning based on floor material

## Useful Commands
```bash
# On Raspberry Pi (SSH required)
python3 device/main.py

# Gateway server
cd gateway && python server.py

# Frontend dev
cd frontend && npm run dev

# Check Pi GPIO status
gpio readall  # if wiringpi installed
```

## References
- Main architecture: [README.md](../README.md)
- Competition stages described in root README
- Hardware list in root README
