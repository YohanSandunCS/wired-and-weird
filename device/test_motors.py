#!/usr/bin/env python3
"""
Motor Test Script
Simple program to test motor functionality with a predefined sequence:
1. Drive forward for 2 seconds
2. Stop for 1 second
3. Turn right and drive for 2 seconds
4. Stop for 1 second
5. Turn left and drive for 2 seconds
6. Stop for 1 second
7. Drive backwards for 2 seconds
8. Stop
"""
import time
import RPi.GPIO as GPIO
from hardware.motors import MotorController
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
    
    try:
        # Sequence 1: Forward for 2 seconds
        print("[Test] Moving FORWARD for 2 seconds...")
        motors.forward()
        time.sleep(2)
        
        # Stop for 1 second
        print("[Test] STOPPING for 1 second...")
        motors.stop()
        time.sleep(1)
        
        # Sequence 2: Turn right for 2 seconds
        print("[Test] Turning RIGHT for 2 seconds...")
        motors.turn_right()
        time.sleep(2)
        
        # Stop for 1 second
        print("[Test] STOPPING for 1 second...")
        motors.stop()
        time.sleep(1)
        
        # Sequence 3: Turn left for 2 seconds
        print("[Test] Turning LEFT for 2 seconds...")
        motors.turn_left()
        time.sleep(2)
        
        # Stop for 1 second
        print("[Test] STOPPING for 1 second...")
        motors.stop()
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
        GPIO.cleanup()
        print("[Test] Cleanup complete")

if __name__ == "__main__":
    main()
