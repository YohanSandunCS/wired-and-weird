#!/usr/bin/env python3
"""
Line Follower Test Script
Tests line following functionality in isolation
Run this on the Raspberry Pi to test line following without the full system
"""
import time
import sys
import signal
import RPi.GPIO as GPIO

from config import Config
from hardware import MotorController, SensorArray, LineFollower, Buzzer


class LineFollowerTest:
    """Simple test harness for line following"""
    
    def __init__(self):
        """Initialize test components"""
        print("=" * 60)
        print("Line Follower Test")
        print("=" * 60)
        
        self.running = False
        
        # Initialize hardware
        try:
            print("\nInitializing hardware...")
            self.motors = MotorController()
            self.sensors = SensorArray()
            self.buzzer = Buzzer() if Config.ENABLE_BUZZER else None
            self.line_follower = LineFollower(self.motors, self.sensors)
            
            print("✓ Hardware initialized successfully")
            
            if self.buzzer:
                self.buzzer.beep(0.1)
            
        except Exception as e:
            print(f"✗ Hardware initialization failed: {e}")
            sys.exit(1)
        
        # Setup signal handler
        signal.signal(signal.SIGINT, self._signal_handler)
        signal.signal(signal.SIGTERM, self._signal_handler)
    
    def _signal_handler(self, sig, frame):
        """Handle shutdown signals"""
        print("\n\nShutdown signal received")
        self.running = False
    
    def display_sensor_status(self):
        """Display current sensor readings"""
        sensors = self.sensors.read_line_sensors()
        print("\nSensor Status:")
        print(f"  L2: {'█' if sensors['left2'] == 0 else '░'}", end="  ")
        print(f"L1: {'█' if sensors['left1'] == 0 else '░'}", end="  ")
        print(f"C: {'█' if sensors['center'] == 0 else '░'}", end="  ")
        print(f"R1: {'█' if sensors['right1'] == 0 else '░'}", end="  ")
        print(f"R2: {'█' if sensors['right2'] == 0 else '░'}")
        print(f"  (█ = Line detected, ░ = No line)")
    
    def calibration_mode(self):
        """Sensor calibration mode - shows sensor readings"""
        print("\n" + "=" * 60)
        print("CALIBRATION MODE")
        print("=" * 60)
        print("Move the robot over the line to see sensor readings")
        print("Press Ctrl+C to exit calibration and start line following")
        print()
        
        try:
            while True:
                self.display_sensor_status()
                
                # Show proximity and bump status
                proximity = self.sensors.read_proximity()
                bump = self.sensors.read_bump()
                
                if proximity:
                    print("  ⚠ Proximity sensor triggered!")
                if bump:
                    print("  ⚠ Bump sensor triggered!")
                
                time.sleep(0.5)
                print("\033[F" * 4, end="")  # Move cursor up 4 lines
                
        except KeyboardInterrupt:
            print("\n\nCalibration complete!\n")
    
    def run_test(self, duration=None, calibrate=True):
        """
        Run line following test
        
        Args:
            duration: Test duration in seconds (None = run until stopped)
            calibrate: Show calibration mode first
        """
        # Show calibration if requested
        if calibrate:
            try:
                self.calibration_mode()
            except KeyboardInterrupt:
                pass
        
        # Start line following
        print("=" * 60)
        print("STARTING LINE FOLLOWING")
        print("=" * 60)
        print(f"Base Speed: {self.line_follower.base_speed}")
        print(f"PID Gains: Kp={self.line_follower.kp}, Ki={self.line_follower.ki}, Kd={self.line_follower.kd}")
        print("Press Ctrl+C to stop")
        print()
        
        if self.buzzer:
            self.buzzer.beep(0.05)
            time.sleep(0.1)
            self.buzzer.beep(0.05)
        
        self.running = True
        start_time = time.time()
        iteration = 0
        
        try:
            while self.running:
                # Check duration limit
                if duration and (time.time() - start_time) > duration:
                    print(f"\nTest duration ({duration}s) reached")
                    break
                
                # Update line follower
                success = self.line_follower.update()
                
                if not success:
                    print("\nLine following failed!")
                    if self.buzzer:
                        self.buzzer.alert_error()
                    break
                
                # Progress indicator
                iteration += 1
                if iteration % 5 == 0:
                    print(".", end="", flush=True)
                
                # Sleep at configured update rate
                time.sleep(Config.LINE_FOLLOW_UPDATE_RATE)
                
        except KeyboardInterrupt:
            print("\n\nTest stopped by user")
        
        finally:
            # Stop motors
            self.motors.stop()
            print("\n\nMotors stopped")
    
    def cleanup(self):
        """Clean up resources"""
        print("\nCleaning up...")
        
        try:
            self.motors.stop()
            self.motors.cleanup()
        except Exception as e:
            print(f"Error cleaning up motors: {e}")
        
        try:
            self.sensors.cleanup()
        except Exception as e:
            print(f"Error cleaning up sensors: {e}")
        
        if self.buzzer:
            try:
                self.buzzer.cleanup()
            except Exception as e:
                print(f"Error cleaning up buzzer: {e}")
        
        try:
            GPIO.cleanup()
        except Exception as e:
            print(f"Error during GPIO cleanup: {e}")
        
        print("Cleanup complete")


def main():
    """Entry point"""
    print("\n")
    print("╔════════════════════════════════════════════════════════╗")
    print("║       MediRunner - Line Follower Test Script          ║")
    print("╚════════════════════════════════════════════════════════╝")
    print("\n")
    
    # Create and run test
    test = LineFollowerTest()
    
    try:
        # Run test (will show calibration first)
        test.run_test(duration=None, calibrate=True)
        
    except Exception as e:
        print(f"\nTest error: {e}")
        import traceback
        traceback.print_exc()
    
    finally:
        test.cleanup()
        print("\nTest complete. Goodbye!\n")


if __name__ == "__main__":
    main()
