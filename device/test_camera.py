#!/usr/bin/env python3
"""
Camera Test Script
Simple program to test camera functionality by capturing a photo
and saving it to the desktop.
"""
import os
from datetime import datetime
from hardware.camera import Camera
from config import Config

def main():
    """Run camera test"""
    print("=" * 60)
    print("Camera Test - Starting")
    print("=" * 60)
    
    # Initialize camera
    camera = None
    try:
        print("[Test] Initializing camera...")
        camera = Camera()
        camera.start()
        print("[Test] Camera initialized successfully\n")
    except Exception as e:
        print(f"[Test] Failed to initialize camera: {e}")
        return
    
    try:
        # Capture photo
        print("[Test] Capturing photo...")
        image = camera.capture_frame()
        
        if image:
            # Get desktop path
            desktop_path = os.path.join(os.path.expanduser('~'), 'Desktop')
            
            # Create filename with timestamp
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            filename = f'medirunner_camera_test_{timestamp}.jpg'
            filepath = os.path.join(desktop_path, filename)
            
            # Save image
            image.save(filepath, 'JPEG', quality=95)
            print(f"[Test] Photo saved successfully!")
            print(f"[Test] Location: {filepath}")
            print(f"[Test] Image size: {image.size[0]}x{image.size[1]}")
        else:
            print("[Test] Failed to capture photo")
        
        print("\n" + "=" * 60)
        print("Camera Test - COMPLETED SUCCESSFULLY")
        print("=" * 60)
        
    except KeyboardInterrupt:
        print("\n[Test] Test interrupted by user")
    
    except Exception as e:
        print(f"\n[Test] Error during test: {e}")
    
    finally:
        # Cleanup
        print("[Test] Cleaning up...")
        if camera:
            camera.cleanup()
        print("[Test] Cleanup complete")

if __name__ == "__main__":
    main()
