"""
Camera module for Raspberry Pi Camera
Handles video capture and frame encoding
"""
import io
import base64
from picamera2 import Picamera2
from PIL import Image
from config import Config

class Camera:
    """Manages Raspberry Pi Camera for video streaming"""
    
    def __init__(self):
        """Initialize camera with configured settings"""
        self.camera = Picamera2()
        
        # Configure camera
        camera_config = self.camera.create_still_configuration(
            main={
                "size": (Config.CAMERA_WIDTH, Config.CAMERA_HEIGHT),
                "format": "RGB888"
            }
        )
        self.camera.configure(camera_config)
        
        if Config.DEBUG:
            print(f"[Camera] Initialized: {Config.CAMERA_WIDTH}x{Config.CAMERA_HEIGHT}")
    
    def start(self):
        """Start camera preview/capture"""
        self.camera.start()
        if Config.DEBUG:
            print("[Camera] Started")
    
    def stop(self):
        """Stop camera"""
        self.camera.stop()
        if Config.DEBUG:
            print("[Camera] Stopped")
    
    def capture_frame(self):
        """
        Capture a single frame from camera
        Returns PIL Image object
        """
        try:
            frame = self.camera.capture_array()
            image = Image.fromarray(frame)
            return image
        except Exception as e:
            if Config.DEBUG:
                print(f"[Camera] Error capturing frame: {e}")
            return None
    
    def capture_frame_base64(self):
        """
        Capture frame and encode as base64 JPEG
        Returns base64 string suitable for WebSocket transmission
        """
        image = self.capture_frame()
        if image is None:
            return None
        
        try:
            # Convert to JPEG in memory
            buffer = io.BytesIO()
            image.save(buffer, format='JPEG', quality=Config.CAMERA_QUALITY)
            buffer.seek(0)
            
            # Encode to base64
            base64_data = base64.b64encode(buffer.read()).decode('utf-8')
            return base64_data
        except Exception as e:
            if Config.DEBUG:
                print(f"[Camera] Error encoding frame: {e}")
            return None
    
    def capture_frame_bytes(self):
        """
        Capture frame as JPEG bytes
        Returns bytes suitable for binary WebSocket transmission
        """
        image = self.capture_frame()
        if image is None:
            return None
        
        try:
            buffer = io.BytesIO()
            image.save(buffer, format='JPEG', quality=Config.CAMERA_QUALITY)
            return buffer.getvalue()
        except Exception as e:
            if Config.DEBUG:
                print(f"[Camera] Error encoding frame: {e}")
            return None
    
    def cleanup(self):
        """Clean up camera resources"""
        self.stop()
        self.camera.close()
        if Config.DEBUG:
            print("[Camera] Cleaned up")
