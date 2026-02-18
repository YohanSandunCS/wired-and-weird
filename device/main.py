#!/usr/bin/env python3
"""
MediRunner Robot - Main Entry Point (Stage 1)
Raspberry Pi 4 autonomous hospital delivery robot

This is the entry point for Stage 1:
- Hardware initialization
- WebSocket connection to gateway
- Basic telemetry sending
- Command reception
"""
import asyncio
import signal
import sys
import time
import RPi.GPIO as GPIO
from datetime import datetime

from config import Config
from hardware import MotorController, SensorArray, Camera, Buzzer, LineFollower
from network import WebSocketClient


class MediRunnerRobot:
    """Main robot controller for Stage 1"""
    
    def __init__(self):
        """Initialize robot components"""
        print("=" * 60)
        print("MediRunner Robot - Stage 1 Initialization")
        print("=" * 60)
        
        # Display configuration
        Config.display()
        
        # Initialize hardware components
        self.motors = None
        self.sensors = None
        self.camera = None
        self.buzzer = None
        self.ws_client = None
        self.line_follower = None
        
        # Robot state
        self.running = False
        # Start in auto mode if WebSocket is disabled (for standalone line following)
        self.mode = 'manual' if Config.ENABLE_WEBSOCKET else 'auto'
        self.auto_mode_active = not Config.ENABLE_WEBSOCKET
        
        # Setup signal handlers for graceful shutdown
        signal.signal(signal.SIGINT, self._signal_handler)
        signal.signal(signal.SIGTERM, self._signal_handler)
    
    def _signal_handler(self, sig, frame):
        """Handle shutdown signals"""
        print("\n[Main] Shutdown signal received")
        self.running = False
    
    async def initialize_hardware(self):
        """Initialize all hardware components"""
        try:
            print("\n[Main] Initializing hardware...")
            
            # Initialize buzzer first for audio feedback
            if Config.ENABLE_BUZZER:
                self.buzzer = Buzzer()
                self.buzzer.alert_startup()
                print("[Main] ✓ Buzzer initialized")
            else:
                print("[Main] ✗ Buzzer disabled")
            
            # Initialize motors
            if Config.ENABLE_MOTORS:
                self.motors = MotorController()
                print("[Main] ✓ Motors initialized")
            else:
                print("[Main] ✗ Motors disabled")
            
            # Initialize sensors
            if Config.ENABLE_SENSORS:
                self.sensors = SensorArray()
                print("[Main] ✓ Sensors initialized")
            else:
                print("[Main] ✗ Sensors disabled")
            
            # Initialize camera
            if Config.ENABLE_CAMERA:
                self.camera = Camera()
                self.camera.start()
                print("[Main] ✓ Camera initialized")
            else:
                print("[Main] ✗ Camera disabled")
            
            # Initialize line follower (requires motors and sensors)
            if Config.ENABLE_MOTORS and Config.ENABLE_SENSORS:
                self.line_follower = LineFollower(self.motors, self.sensors)
                print("[Main] ✓ Line follower initialized")
            else:
                print("[Main] ✗ Line follower disabled (requires motors + sensors)")
            
            print("[Main] Hardware initialization complete")
            return True
            
        except Exception as e:
            print(f"[Main] Hardware initialization failed: {e}")
            if self.buzzer:
                self.buzzer.alert_error()
            return False
    
    async def initialize_network(self):
        """Initialize WebSocket connection to gateway"""
        if not Config.ENABLE_WEBSOCKET:
            print("\n[Main] WebSocket disabled - running in standalone mode")
            return True
        
        try:
            print("\n[Main] Initializing network connection...")
            
            # Create WebSocket client with message handler
            self.ws_client = WebSocketClient(message_handler=self.handle_command)
            
            # Start connection with auto-reconnect in background
            asyncio.create_task(self.ws_client.run_with_reconnect())
            
            # Wait a bit for initial connection
            await asyncio.sleep(2)
            
            if self.ws_client.connected:
                print("[Main] Network connection established")
                if self.buzzer:
                    self.buzzer.alert_connected()
                return True
            else:
                print("[Main] Network connection pending (will auto-reconnect)")
                return True  # Continue anyway, will reconnect
                
        except Exception as e:
            print(f"[Main] Network initialization failed: {e}")
            return False
    
    async def handle_command(self, message):
        """
        Handle incoming commands from gateway/frontend
        Args:
            message: Dict containing command data
        """
        msg_type = message.get('type')
        payload = message.get('payload', {})
        
        # Handle ping messages - respond with pong
        if msg_type == 'ping':
            if Config.DEBUG:
                print(f"[Main] 🔔 PING received, sending PONG")
            pong_msg = {
                'type': 'pong',
                'payload': {
                    'source': 'robot',
                    'mode': self.mode,
                    'auto_active': self.auto_mode_active
                }
            }
            await self.ws_client.send_message(pong_msg)
            return
        
        # Handle keep_alive silently
        if msg_type == 'keep_alive':
            return
        
        if msg_type == 'command':
            # Support multiple formats:
            # {command: "left"} or {direction: "left"} or {action: "stop"}
            command = payload.get('command') or payload.get('direction') or payload.get('action')
            action = payload.get('action')
            
            if Config.DEBUG:
                print(f"[Main] Command: {command}, Action: {action}, Payload: {payload}")
            
            # Skip if no valid command found
            if not command:
                if Config.DEBUG:
                    print(f"[Main] ⚠ No valid command found in payload")
                return
            
            # Mode switching commands
            if command == 'manual':
                await self.set_mode('manual')
                if self.buzzer:
                    self.buzzer.beep(0.05)
                if Config.DEBUG:
                    print(f"[Main] ✓ Switched to MANUAL mode")
            
            elif command == 'auto':
                await self.set_mode('auto')
                if self.buzzer:
                    self.buzzer.beep_pattern([(0.05, 0.05), (0.05, 0)])  # Double beep for auto mode
                if Config.DEBUG:
                    print(f"[Main] ✓ Switched to AUTO mode")
            
            elif command == 'panoramic':
                asyncio.create_task(self.capture_panoramic())
                if Config.DEBUG:
                    print(f"[Main] ✓ Panoramic capture started")
            
            # Motor commands (only in manual mode)
            elif self.mode != 'manual':
                if Config.DEBUG:
                    print(f"[Main] ⚠ Motor command '{command}' ignored - not in manual mode (current: {self.mode})")
            
            elif command == 'forward' or command == 'up':
                if self.motors:
                    speed = payload.get('speed', Config.DEFAULT_MOTOR_SPEED)
                    self.motors.forward(speed)
                    if Config.DEBUG:
                        print(f"[Main] ✓ Moving forward at speed {speed}")
            
            elif command == 'backward' or command == 'down':
                if self.motors:
                    speed = payload.get('speed', Config.DEFAULT_MOTOR_SPEED)
                    self.motors.backward(speed)
                    if Config.DEBUG:
                        print(f"[Main] ✓ Moving backward at speed {speed}")
            
            elif command == 'left':
                if self.motors:
                    speed = payload.get('speed', Config.TURN_MOTOR_SPEED)
                    self.motors.turn_left(speed)
                    if Config.DEBUG:
                        print(f"[Main] ✓ Turning left at speed {speed} (auto-stop in 0.2s)")
                    # Auto-stop after 0.2 seconds
                    asyncio.create_task(self._auto_stop_after(0.2))
            
            elif command == 'right':
                if self.motors:
                    speed = payload.get('speed', Config.TURN_MOTOR_SPEED)
                    self.motors.turn_right(speed)
                    if Config.DEBUG:
                        print(f"[Main] ✓ Turning right at speed {speed} (auto-stop in 0.2s)")
                    # Auto-stop after 0.2 seconds
                    asyncio.create_task(self._auto_stop_after(0.2))
            
            elif command == 'stop':
                if self.motors:
                    self.motors.stop()
                    if Config.DEBUG:
                        print(f"[Main] ✓ Motors stopped")
            
            elif command == 'set_speed':
                if self.motors:
                    speed = payload.get('speed', Config.DEFAULT_MOTOR_SPEED)
                    self.motors.set_speed(speed)
                    if Config.DEBUG:
                        print(f"[Main] ✓ Speed set to {speed}")
            
            # Mode switching (legacy format)
            elif command == 'set_mode':
                mode = payload.get('mode', 'manual')
                await self.set_mode(mode)
                if self.buzzer:
                    self.buzzer.beep(0.05)
                if Config.DEBUG:
                    print(f"[Main] ✓ Mode switched to {mode}")
            
            # Buzzer commands
            elif command == 'beep':
                if self.buzzer:
                    self.buzzer.beep()
                    if Config.DEBUG:
                        print(f"[Main] ✓ Beep triggered")
            
            else:
                if Config.DEBUG:
                    print(f"[Main] ⚠ Unknown command: {command}")
            
            # Send acknowledgment
            await self.send_acknowledgment(message.get('id'))
    
    async def _auto_stop_after(self, delay):
        """Auto-stop motors after specified delay (in seconds)"""
        await asyncio.sleep(delay)
        if self.motors and self.mode == 'manual':  # Only auto-stop in manual mode
            self.motors.stop()
            if Config.DEBUG:
                print(f"[Main] ⏹ Auto-stopped after {delay}s")
    
    async def set_mode(self, mode):
        """Switch between manual and auto modes"""
        if mode == self.mode:
            return  # Already in this mode
        
        old_mode = self.mode
        self.mode = mode
        
        print(f"[Main] Mode switched: {old_mode} -> {mode}")
        
        if mode == 'auto':
            # Activate autonomous line following
            self.auto_mode_active = True
            if self.line_follower:
                self.line_follower.reset()
            print("[Main] Autonomous mode activated")
        else:
            # Deactivate autonomous control
            self.auto_mode_active = False
            if self.motors:
                self.motors.stop()
            print("[Main] Manual mode activated")
    
    async def capture_panoramic(self):
        """
        Capture a 360° panoramic image by rotating the robot in steps,
        capturing a frame at each step, stitching them together, and
        sending the result back to the gateway/frontend.
        """
        NUM_STEPS = 8                      # 8 x 45° = 360°
        ROTATE_DURATION = 0.35             # seconds to rotate per step (tune on hardware)
        SETTLE_DURATION = 0.2             # seconds to wait after stopping before capture
        TURN_SPEED = getattr(Config, 'TURN_MOTOR_SPEED', 60)

        print("[Main] 📸 Starting panoramic capture...")

        if self.buzzer:
            self.buzzer.beep(0.05)

        # Pause autonomous driving while capturing
        was_auto = self.auto_mode_active
        if was_auto:
            self.auto_mode_active = False
        if self.motors:
            self.motors.stop()

        capture_time = int(time.time() * 1000)  # ms timestamp
        frames_b64 = []

        try:
            for step in range(NUM_STEPS):
                # Rotate right one step
                if self.motors:
                    self.motors.turn_right(TURN_SPEED)
                    await asyncio.sleep(ROTATE_DURATION)
                    self.motors.stop()
                    await asyncio.sleep(SETTLE_DURATION)

                # Capture frame
                if self.camera:
                    frame = self.camera.capture_frame_base64()
                    if frame:
                        frames_b64.append(frame)
                        if Config.DEBUG:
                            print(f"[Main] 📷 Panoramic frame {step + 1}/{NUM_STEPS} captured")
                else:
                    if Config.DEBUG:
                        print(f"[Main] ⚠ Camera not available for panoramic step {step + 1}")

            # Stitch frames using camera helper (re-encode joined images)
            if frames_b64 and self.camera:
                import io, base64
                from PIL import Image

                pil_frames = []
                for b64 in frames_b64:
                    raw = base64.b64decode(b64)
                    img = Image.open(io.BytesIO(raw)).convert('RGB')
                    pil_frames.append(img)

                if pil_frames:
                    fw, fh = pil_frames[0].size
                    panoramic = Image.new('RGB', (fw * len(pil_frames), fh))
                    for idx, f in enumerate(pil_frames):
                        panoramic.paste(f, (idx * fw, 0))

                    buf = io.BytesIO()
                    panoramic.save(buf, format='JPEG', quality=getattr(Config, 'CAMERA_QUALITY', 75))
                    buf.seek(0)
                    panoramic_b64 = base64.b64encode(buf.read()).decode('utf-8')

                    total_w, total_h = panoramic.size
                    print(f"[Main] ✓ Panoramic stitched: {total_w}x{total_h} from {len(pil_frames)} frames")

                    if self.ws_client:
                        await self.ws_client.send_panoramic_image(
                            panoramic_b64, total_w, total_h, capture_time
                        )
                        print("[Main] ✓ Panoramic image sent")
                    if self.buzzer:
                        self.buzzer.beep_pattern([(0.05, 0.05), (0.05, 0)])
                else:
                    print("[Main] ⚠ No valid frames to stitch")
            else:
                print("[Main] ⚠ Insufficient frames for panoramic stitching")

        except Exception as e:
            print(f"[Main] Panoramic capture error: {e}")
        finally:
            # Restore previous auto mode
            if was_auto:
                self.auto_mode_active = True

    async def send_acknowledgment(self, command_id):
        """Send command acknowledgment"""
        if self.ws_client and command_id:
            ack_msg = {
                'type': 'pong',
                'payload': {
                    'command_id': command_id,
                    'acknowledged': True
                }
            }
            await self.ws_client.send_message(ack_msg)
    
    async def telemetry_loop(self):
        """Periodically send telemetry data to gateway"""
        print("[Main] Starting telemetry loop")
        
        telemetry_count = 0
        start_time = time.time()
        
        while self.running:
            try:
                if self.ws_client and self.ws_client.connected:
                    # Read sensor data if sensors are enabled
                    sensor_data = {}
                    line_position = None
                    proximity = False
                    bump = False
                    if self.sensors:
                        sensor_data = self.sensors.read_all()
                        line_position = self.sensors.get_line_position()
                        proximity = sensor_data.get('proximity', False)
                        bump = sensor_data.get('bump', False)
                    
                    # Motor speed
                    speed = self.motors.current_speed if self.motors else 0
                    
                    # Build telemetry payload
                    telemetry = {
                        'sensors': sensor_data,
                        'mode': self.mode,
                        'auto_mode_active': self.auto_mode_active,
                        'speed': speed,
                        'line_position': line_position,
                        'proximity': proximity,
                        'bump': bump,
                        'uptime_seconds': int(time.time() - start_time),
                        'timestamp': datetime.now().isoformat()
                    }
                    
                    # Send telemetry
                    await self.ws_client.send_telemetry(telemetry)
                    
                    # Only print debug every 10 telemetry messages to avoid spam
                    telemetry_count += 1
                    if Config.DEBUG and telemetry_count % 10 == 0:
                        print(f"[Main] 📊 Telemetry #{telemetry_count}: mode={self.mode}, speed={speed}, line={line_position}")
                
                await asyncio.sleep(Config.TELEMETRY_INTERVAL)
                
            except Exception as e:
                if Config.DEBUG:
                    print(f"[Main] Telemetry error: {e}")
                await asyncio.sleep(1)
    
    async def camera_loop(self):
        """Periodically capture and send camera frames"""
        if not self.camera:
            print("[Main] Camera loop skipped (camera disabled)")
            # Keep loop alive but do nothing
            while self.running:
                await asyncio.sleep(1)
            return
        
        print("[Main] Starting camera loop")
        
        # Calculate frame interval from FPS
        frame_interval = 1.0 / Config.CAMERA_FPS
        
        while self.running:
            try:
                if self.ws_client and self.ws_client.connected:
                    # Capture frame as base64
                    frame_data = self.camera.capture_frame_base64()
                    
                    if frame_data:
                        await self.ws_client.send_video_frame(frame_data, encoding='base64')
                
                await asyncio.sleep(frame_interval)
                
            except Exception as e:
                if Config.DEBUG:
                    print(f"[Main] Camera error: {e}")
                await asyncio.sleep(1)
    
    async def autonomous_control_loop(self):
        """Autonomous line following control loop"""
        if not self.line_follower:
            print("[Main] Autonomous loop skipped (line follower disabled)")
            while self.running:
                await asyncio.sleep(1)
            return
        
        print("[Main] Starting autonomous control loop")
        print(f"[Main] Auto mode active: {self.auto_mode_active}")
        
        while self.running:
            try:
                if self.auto_mode_active:
                    # Check for obstacles first (only if proximity sensor enabled)
                    if Config.ENABLE_PROXIMITY and self.sensors and self.sensors.read_proximity():
                        print("[Main] Obstacle detected! Stopping.")
                        self.motors.stop()
                        if self.buzzer:
                            self.buzzer.beep(0.1)
                        await asyncio.sleep(0.5)
                        continue
                    
                    # Check for bump collision (only if bump sensor enabled)
                    if Config.ENABLE_BUMP and self.sensors and self.sensors.read_bump():
                        print("[Main] Collision detected! Stopping.")
                        self.motors.stop()
                        if self.buzzer:
                            self.buzzer.alert_error()
                        self.auto_mode_active = False
                        self.mode = 'manual'
                        continue
                    
                    # Execute line following
                    success = self.line_follower.update()
                    
                    if not success:
                        print("\n[Main] ⚠ Line following failed - AUTO MODE DISABLED")
                        print("[Main] Switching to MANUAL mode\n")
                        self.auto_mode_active = False
                        self.mode = 'manual'
                        if self.buzzer:
                            self.buzzer.alert_error()
                        # Wait a bit before potential restart
                        await asyncio.sleep(1)
                    
                    # Update at configured rate
                    await asyncio.sleep(Config.LINE_FOLLOW_UPDATE_RATE)
                else:
                    # Not in auto mode, just wait
                    await asyncio.sleep(0.1)
                    
            except Exception as e:
                if Config.DEBUG:
                    print(f"[Main] Autonomous control error: {e}")
                self.auto_mode_active = False
                if self.motors:
                    self.motors.stop()
                await asyncio.sleep(1)
    
    async def run(self):
        """Main robot execution loop"""
        print("\n[Main] Starting MediRunner Robot...")
        
        # Initialize hardware
        if not await self.initialize_hardware():
            print("[Main] Failed to initialize hardware. Exiting.")
            return
        
        # Initialize network
        if not await self.initialize_network():
            print("[Main] Failed to initialize network. Exiting.")
            self.cleanup()
            return
        
        # Set running flag
        self.running = True
        
        print("\n" + "=" * 60)
        print("MediRunner Robot Online - Stage 1")
        print(f"Robot ID: {Config.ROBOT_ID}")
        print(f"Mode: {self.mode.upper()}")
        if not Config.ENABLE_WEBSOCKET:
            print("Running in STANDALONE mode (WebSocket disabled)")
        print("=" * 60 + "\n")
        
        # Start telemetry, camera, and autonomous control loops
        try:
            await asyncio.gather(
                self.telemetry_loop(),
                self.camera_loop(),
                self.autonomous_control_loop()
            )
        except asyncio.CancelledError:
            print("[Main] Tasks cancelled")
        finally:
            self.cleanup()
    
    def cleanup(self):
        """Clean up all resources"""
        print("\n[Main] Cleaning up resources...")
        
        self.running = False
        
        if self.motors:
            try:
                self.motors.cleanup()
            except Exception as e:
                print(f"[Main] Error cleaning up motors: {e}")
        
        if self.sensors:
            try:
                self.sensors.cleanup()
            except Exception as e:
                print(f"[Main] Error cleaning up sensors: {e}")
        
        if self.camera:
            try:
                self.camera.cleanup()
            except Exception as e:
                print(f"[Main] Error cleaning up camera: {e}")
        
        if self.buzzer:
            try:
                self.buzzer.cleanup()
            except Exception as e:
                print(f"[Main] Error cleaning up buzzer: {e}")
        
        # Clean up GPIO - must be done after all PWM objects are stopped
        try:
            GPIO.cleanup()
        except Exception as e:
            print(f"[Main] Error during GPIO cleanup: {e}")
        
        print("[Main] Cleanup complete. Goodbye!")


async def main():
    """Application entry point"""
    robot = MediRunnerRobot()
    await robot.run()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n[Main] Interrupted by user")
    except Exception as e:
        print(f"[Main] Fatal error: {e}")
        sys.exit(1)
