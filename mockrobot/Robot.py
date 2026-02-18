import websocket
import json
import time
import threading
import signal
import sys
import os
import cv2
import base64
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

ROBOT_ID = os.getenv("ROBOT_ID", "robot-01")
ROLE = "robot"
WS_HOST = os.getenv("WS_HOST", "127.0.0.1")
WS_PORT = os.getenv("WS_PORT", "8000")
URI = f"ws://{WS_HOST}:{WS_PORT}/ws/robot?robotId={ROBOT_ID}"

# Video streaming configuration
FRAME_WIDTH = int(os.getenv("FRAME_WIDTH", "320"))
FRAME_HEIGHT = int(os.getenv("FRAME_HEIGHT", "240"))
JPEG_QUALITY = int(os.getenv("JPEG_QUALITY", "60"))
FRAME_INTERVAL_SEC = float(os.getenv("FRAME_INTERVAL_SEC", "0.1"))  # 10 fps

class RobotClient:
    def __init__(self):
        self.ws = None
        self.battery_level = int(os.getenv("INITIAL_BATTERY_LEVEL", "100"))
        self.running = False
        self.telemetry_thread = None
        self.video_thread = None
        
    def on_message(self, ws, message):
        """Handle incoming messages from the gateway"""
        try:
            msg = json.loads(message)
            print("Robot received:", msg)

            if msg.get("type") == "ping":
                pong = {
                    "type": "pong",
                    "robotId": ROBOT_ID,
                    "timestamp": msg.get("timestamp", int(time.time() * 1000)),
                }
                ws.send(json.dumps(pong))
                print("Robot sent pong:", pong)
            elif msg.get("type") == "command" and msg.get("payload", {}).get("action") == "panoramic":
                # Handle panoramic image capture command
                print("Received panoramic capture command, generating panoramic image...")
                threading.Thread(target=self.send_panoramic_image, daemon=True).start()
            else:
                # Later: handle commands, missions, etc.
                pass
        except json.JSONDecodeError as e:
            print(f"Failed to parse message: {e}")
        except Exception as e:
            print(f"Error handling message: {e}")

    def on_error(self, ws, error):
        """Handle WebSocket errors"""
        print(f"WebSocket error: {error}")

    def on_close(self, ws, close_status_code, close_msg):
        """Handle WebSocket connection close"""
        print("WebSocket connection closed")
        self.running = False

    def on_open(self, ws):
        """Handle WebSocket connection open"""
        print(f"Robot {ROBOT_ID} connected to gateway successfully!")
        self.running = True
        
        # Start telemetry sending in a separate thread
        self.telemetry_thread = threading.Thread(target=self.send_telemetry)
        self.telemetry_thread.daemon = True
        self.telemetry_thread.start()
        
        # Start video streaming in a separate thread
        self.video_thread = threading.Thread(target=self.stream_mock_camera)
        self.video_thread.daemon = True
        self.video_thread.start()

    def send_telemetry(self):
        """Send telemetry data at configurable intervals with decreasing battery level"""
        telemetry_interval = int(os.getenv("TELEMETRY_INTERVAL", "2"))
        initial_battery = int(os.getenv("INITIAL_BATTERY_LEVEL", "100"))
        
        while self.running and self.ws:
            try:
                telemetry = {
                    "type": "telemetry",
                    "robotId": ROBOT_ID,
                    "payload": {
                        "battery": self.battery_level
                    },
                    "timestamp": int(time.time() * 1000)
                }
                
                self.ws.send(json.dumps(telemetry))
                print(f"Robot sent telemetry: battery={self.battery_level}%")
                
                # Decrease battery level by 1, reset to initial level if it goes below 0
                self.battery_level -= 1
                if self.battery_level < 0:
                    self.battery_level = initial_battery
                    
                time.sleep(telemetry_interval)
                
            except Exception as e:
                print(f"Error sending telemetry: {e}")
                break

    def open_video_capture(self):
        """Open video capture from mock video file"""
        return cv2.VideoCapture("./assets/mock_camera_video.mp4")

    def stream_mock_camera(self):
        """Stream mock camera frames at configurable intervals"""
        cap = None
        
        try:
            cap = self.open_video_capture()
            if not cap.isOpened():
                print("[ERROR] Failed to open video file: ./assets/mock_camera_video.mp4")
                return
                
            print("Started mock camera stream")
            
            while self.running and self.ws:
                try:
                    ret, frame = cap.read()
                    
                    # If end of video, restart from beginning
                    if not ret:
                        cap.release()
                        cap = self.open_video_capture()
                        if not cap.isOpened():
                            print("[ERROR] Failed to reopen video file")
                            break
                        ret, frame = cap.read()
                        if not ret:
                            print("[ERROR] Failed to read frame after reopening")
                            break
                    
                    # Resize frame to target dimensions
                    frame = cv2.resize(frame, (FRAME_WIDTH, FRAME_HEIGHT))
                    
                    # Encode frame as JPEG
                    encode_params = [cv2.IMWRITE_JPEG_QUALITY, JPEG_QUALITY]
                    success, encoded_frame = cv2.imencode('.jpg', frame, encode_params)
                    
                    if not success:
                        print("[WARN] Failed to JPEG-encode frame, skipping.")
                        time.sleep(FRAME_INTERVAL_SEC)
                        continue
                    
                    # Convert to base64
                    b64_frame = base64.b64encode(encoded_frame.tobytes()).decode('utf-8')
                    
                    # Build vision frame message
                    msg = {
                        "type": "vision_frame",
                        "role": ROLE,
                        "robotId": ROBOT_ID,
                        "payload": {
                            "mime": "image/jpeg",
                            "width": FRAME_WIDTH,
                            "height": FRAME_HEIGHT,
                            "quality": JPEG_QUALITY,
                            "data": b64_frame,
                        },
                        "timestamp": int(time.time() * 1000),
                    }
                    
                    # Send the frame
                    self.ws.send(json.dumps(msg))
                    print(f"Sent vision frame: {FRAME_WIDTH}x{FRAME_HEIGHT}, quality={JPEG_QUALITY}")
                    
                    # Wait before next frame
                    time.sleep(FRAME_INTERVAL_SEC)
                    
                except Exception as e:
                    print(f"Error streaming video frame: {e}")
                    # Continue loop - don't break on individual frame errors
                    time.sleep(FRAME_INTERVAL_SEC)
                    
        except Exception as e:
            print(f"Fatal error in video streaming: {e}")
        finally:
            if cap:
                cap.release()
            print("Mock camera stream stopped")

    def send_panoramic_image(self):
        """Generate and send a mock panoramic image"""
        try:
            # Generate a mock panoramic image (wider aspect ratio)
            # In a real scenario, this would be stitched from multiple camera angles
            cap = self.open_video_capture()
            if not cap.isOpened():
                print("[ERROR] Failed to open video file for panoramic capture")
                return
            
            # Read a frame and create a wider panoramic version
            ret, frame = cap.read()
            cap.release()
            
            if not ret:
                print("[ERROR] Failed to read frame for panoramic capture")
                return
            
            # Create a panoramic image by stitching multiple frames horizontally
            # For mock purposes, we'll just tile the frame horizontally 4 times
            panoramic_frame = cv2.hconcat([frame, frame, frame, frame])
            
            # Resize to a reasonable panoramic size
            panoramic_width = 1920
            aspect_ratio = panoramic_frame.shape[1] / panoramic_frame.shape[0]
            panoramic_height = int(panoramic_width / aspect_ratio)
            panoramic_frame = cv2.resize(panoramic_frame, (panoramic_width, panoramic_height))
            
            # Encode as high-quality JPEG
            encode_params = [cv2.IMWRITE_JPEG_QUALITY, 90]
            success, encoded_frame = cv2.imencode('.jpg', panoramic_frame, encode_params)
            
            if not success:
                print("[ERROR] Failed to encode panoramic image")
                return
            
            # Convert to base64
            b64_frame = base64.b64encode(encoded_frame.tobytes()).decode('utf-8')
            
            # Build panoramic image message
            capture_time = int(time.time() * 1000)
            msg = {
                "type": "panoramic_image",
                "robotId": ROBOT_ID,
                "payload": {
                    "mime": "image/jpeg",
                    "width": panoramic_width,
                    "height": panoramic_height,
                    "data": b64_frame,
                    "captureTime": capture_time,
                },
                "timestamp": capture_time,
            }
            
            # Send the panoramic image
            if self.ws:
                self.ws.send(json.dumps(msg))
                print(f"Sent panoramic image: {panoramic_width}x{panoramic_height}")
            
        except Exception as e:
            print(f"Error generating panoramic image: {e}")

    def connect_with_retry(self):
        """Try to connect to WebSocket server with exponential backoff"""
        retry_delay = int(os.getenv("RETRY_INITIAL_DELAY", "1"))  # Start delay from env
        max_delay = int(os.getenv("RETRY_MAX_DELAY", "30"))      # Max delay from env
        
        while True:
            try:
                print(f"Attempting to connect to {URI}...")
                
                # Enable trace for debugging (optional)
                # websocket.enableTrace(True)
                
                self.ws = websocket.WebSocketApp(URI,
                    on_open=self.on_open,
                    on_message=self.on_message,
                    on_error=self.on_error,
                    on_close=self.on_close)
                
                # Run forever will handle reconnection automatically
                reconnect_interval = int(os.getenv("RECONNECT_INTERVAL", "5"))
                ping_interval = int(os.getenv("PING_INTERVAL", "30"))
                ping_timeout = int(os.getenv("PING_TIMEOUT", "10"))
                
                self.ws.run_forever(
                    reconnect=reconnect_interval,  # Reconnect interval from env
                    ping_interval=ping_interval,   # Ping interval from env
                    ping_timeout=ping_timeout      # Ping timeout from env
                )
                
                # If we reach here, connection was closed normally
                break
                
            except KeyboardInterrupt:
                print("\nShutting down robot client...")
                self.running = False
                if self.ws:
                    self.ws.close()
                break
                
            except Exception as e:
                print(f"Connection failed: {e}")
                print(f"Retrying in {retry_delay} seconds...")
                time.sleep(retry_delay)
                
                # Exponential backoff: double the delay, but cap at max_delay
                retry_delay = min(retry_delay * 2, max_delay)

    def stop(self):
        """Stop the robot client gracefully"""
        print("Stopping robot client...")
        self.running = False
        if self.ws:
            self.ws.close()
            
        # Wait for threads to finish
        if self.telemetry_thread and self.telemetry_thread.is_alive():
            self.telemetry_thread.join(timeout=2)
        if self.video_thread and self.video_thread.is_alive():
            self.video_thread.join(timeout=2)

def signal_handler(sig, frame):
    """Handle Ctrl+C gracefully"""
    print('\nReceived interrupt signal, shutting down...')
    robot.stop()
    sys.exit(0)

if __name__ == "__main__":
    # Set up signal handler for graceful shutdown
    signal.signal(signal.SIGINT, signal_handler)
    
    robot = RobotClient()
    try:
        robot.connect_with_retry()
    except KeyboardInterrupt:
        print("\nRobot client stopped.")
    finally:
        robot.stop()