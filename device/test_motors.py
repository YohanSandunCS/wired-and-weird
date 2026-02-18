#!/usr/bin/env python3
"""
Motor Test Script
Simple program to test motor functionality with a predefined sequence:
1. Drive forward for 2 seconds, stop and wait 1 second
2. Turn right, then drive forward for 2 seconds, stop and wait 1 second
3. Turn left, then drive forward for 2 seconds, stop
4. Take a photo and save to desktop
5. Drive backwards for 2 seconds and stop
"""
import time
import os
from datetime import datetime
import RPi.GPIO as GPIO
from hardware.motors import MotorController
from hardware.camera import Camera
from config import Config

def main():
    """Run motor test sequence"""
    print("=" * 60)
    print("Motor Controller Test - Starting")
    print("=" * 60)
    
    # Initialize motor controller
    try:
        motors = MotorController()
        print("[Test] Motor controller initialized successfully\n")
    except Exception as e:
        print(f"[Test] Failed to initialize motors: {e}")
        return
    
    # Initialize camera
    camera = None
    try:
        camera = Camera()
        camera.start()
        print("[Test] Camera initialized successfully\n")
    except Exception as e:
        print(f"[Test] Failed to initialize camera: {e}")
        print("[Test] Continuing without camera...\n")
    
    try:
        # Sequence 1: Forward for 2 seconds
        print("[Test] Moving FORWARD for 2 seconds...")
        motors.forward()
        time.sleep(2)
        
        # Stop for 1 second
        print("[Test] STOPPING for 1 second...")
        motors.stop()
        time.sleep(1)
        
        # Sequence 2: Turn right, then forward
        print("[Test] Turning RIGHT...")
        motors.turn_right()
        time.sleep(1.0)  # Gentle turn
        
        print("[Test] Moving FORWARD for 2 seconds...")
        motors.forward()
        time.sleep(2)
        
        # Stop for 1 second
        print("[Test] STOPPING for 1 second...")
        motors.stop()
        time.sleep(1)
        
        # Sequence 3: Turn left, then forward
        print("[Test] Turning LEFT...")
        motors.turn_left()
        time.sleep(1.0)  # Gentle turn
        
        print("[Test] Moving FORWARD for 2 seconds...")
        motors.forward()
        time.sleep(2)
        
        # Stop
        print("[Test] STOPPING...")
        motors.stop()
        time.sleep(1)
        
        # Take a photo and save to desktop
        if camera:
            print("[Test] Taking photo...")
            try:
                image = camera.capture_frame()
                if image:
                    # Get script directory
                    script_dir = os.path.dirname(os.path.abspath(__file__))
                    # Create filename with timestamp
                    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
                    filename = f'medirunner_photo_{timestamp}.jpg'
                    filepath = os.path.join(script_dir, filename)
                    
                    # Save image
                    image.save(filepath, 'JPEG')
                    print(f"[Test] Photo saved to: {filepath}")
                else:
                    print("[Test] Failed to capture photo")
            except Exception as e:
                print(f"[Test] Error saving photo: {e}")
        else:
            print("[Test] Skipping photo (camera not available)")
        
        time.sleep(1)
        
        # Sequence 4: Backward for 2 seconds
        print("[Test] Moving BACKWARD for 2 seconds...")
        motors.backward()
        time.sleep(2)
        
        # Final stop
        print("[Test] STOPPING - Test complete!")
        motors.stop()
        
        print("\n" + "=" * 60)
        print("Motor Test - COMPLETED SUCCESSFULLY")
        print("=" * 60)
        
    except KeyboardInterrupt:
        print("\n[Test] Test interrupted by user")
        motors.stop()
    
    except Exception as e:
        print(f"\n[Test] Error during test: {e}")
        motors.stop()
    
    finally:
        # Cleanup
        print("[Test] Cleaning up...")
        motors.cleanup()
        if camera:
            camera.cleanup()
        GPIO.cleanup()
        print("[Test] Cleanup complete")

if __name__ == "__main__":
    main()
