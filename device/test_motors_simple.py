#!/usr/bin/env python3
"""
Simple Motor Test Script
Minimal script to test L298N motor driver with hardcoded GPIO pins
"""
import time
import RPi.GPIO as GPIO

# GPIO Pin Definitions (BCM numbering) - Based on your wiring diagram
# Left Motor
MOTOR_LEFT_FORWARD = 23      # IN1
MOTOR_LEFT_BACKWARD = 22     # IN2
MOTOR_LEFT_ENABLE = 20       # ENA

# Right Motor
MOTOR_RIGHT_FORWARD = 27     # IN3
MOTOR_RIGHT_BACKWARD = 17    # IN4
MOTOR_RIGHT_ENABLE = 16      # ENB

# Motor speed (0-100)
SPEED = 70

def setup_gpio():
    """Initialize GPIO pins"""
    print("Setting up GPIO pins...")
    GPIO.setmode(GPIO.BCM)
    GPIO.setwarnings(False)
    
    # Setup all motor pins as outputs
    GPIO.setup(MOTOR_LEFT_FORWARD, GPIO.OUT)
    GPIO.setup(MOTOR_LEFT_BACKWARD, GPIO.OUT)
    GPIO.setup(MOTOR_LEFT_ENABLE, GPIO.OUT)
    GPIO.setup(MOTOR_RIGHT_FORWARD, GPIO.OUT)
    GPIO.setup(MOTOR_RIGHT_BACKWARD, GPIO.OUT)
    GPIO.setup(MOTOR_RIGHT_ENABLE, GPIO.OUT)
    
    # Initialize all to LOW
    GPIO.output(MOTOR_LEFT_FORWARD, GPIO.LOW)
    GPIO.output(MOTOR_LEFT_BACKWARD, GPIO.LOW)
    GPIO.output(MOTOR_RIGHT_FORWARD, GPIO.LOW)
    GPIO.output(MOTOR_RIGHT_BACKWARD, GPIO.LOW)
    
    # Setup PWM on enable pins (1000 Hz)
    left_pwm = GPIO.PWM(MOTOR_LEFT_ENABLE, 1000)
    right_pwm = GPIO.PWM(MOTOR_RIGHT_ENABLE, 1000)
    left_pwm.start(0)
    right_pwm.start(0)
    
    print("GPIO setup complete")
    return left_pwm, right_pwm

def stop_motors(left_pwm, right_pwm):
    """Stop both motors"""
    GPIO.output(MOTOR_LEFT_FORWARD, GPIO.LOW)
    GPIO.output(MOTOR_LEFT_BACKWARD, GPIO.LOW)
    GPIO.output(MOTOR_RIGHT_FORWARD, GPIO.LOW)
    GPIO.output(MOTOR_RIGHT_BACKWARD, GPIO.LOW)
    left_pwm.ChangeDutyCycle(0)
    right_pwm.ChangeDutyCycle(0)

def forward(left_pwm, right_pwm, speed):
    """Move forward"""
    GPIO.output(MOTOR_LEFT_FORWARD, GPIO.HIGH)
    GPIO.output(MOTOR_LEFT_BACKWARD, GPIO.LOW)
    GPIO.output(MOTOR_RIGHT_FORWARD, GPIO.HIGH)
    GPIO.output(MOTOR_RIGHT_BACKWARD, GPIO.LOW)
    left_pwm.ChangeDutyCycle(speed)
    right_pwm.ChangeDutyCycle(speed)

def backward(left_pwm, right_pwm, speed):
    """Move backward"""
    GPIO.output(MOTOR_LEFT_FORWARD, GPIO.LOW)
    GPIO.output(MOTOR_LEFT_BACKWARD, GPIO.HIGH)
    GPIO.output(MOTOR_RIGHT_FORWARD, GPIO.LOW)
    GPIO.output(MOTOR_RIGHT_BACKWARD, GPIO.HIGH)
    left_pwm.ChangeDutyCycle(speed)
    right_pwm.ChangeDutyCycle(speed)

def turn_right(left_pwm, right_pwm, speed):
    """Turn right"""
    GPIO.output(MOTOR_LEFT_FORWARD, GPIO.HIGH)
    GPIO.output(MOTOR_LEFT_BACKWARD, GPIO.LOW)
    GPIO.output(MOTOR_RIGHT_FORWARD, GPIO.LOW)
    GPIO.output(MOTOR_RIGHT_BACKWARD, GPIO.HIGH)
    left_pwm.ChangeDutyCycle(speed)
    right_pwm.ChangeDutyCycle(speed)

def turn_left(left_pwm, right_pwm, speed):
    """Turn left"""
    GPIO.output(MOTOR_LEFT_FORWARD, GPIO.LOW)
    GPIO.output(MOTOR_LEFT_BACKWARD, GPIO.HIGH)
    GPIO.output(MOTOR_RIGHT_FORWARD, GPIO.HIGH)
    GPIO.output(MOTOR_RIGHT_BACKWARD, GPIO.LOW)
    left_pwm.ChangeDutyCycle(speed)
    right_pwm.ChangeDutyCycle(speed)

def main():
    """Run simple motor test"""
    print("=" * 60)
    print("SIMPLE MOTOR TEST")
    print("=" * 60)
    
    left_pwm = None
    right_pwm = None
    
    try:
        # Setup
        left_pwm, right_pwm = setup_gpio()
        
        print("\nStarting test sequence...")
        print("Press Ctrl+C to stop at any time\n")
        
        # Test 1: Forward
        print("1. Moving FORWARD (2 seconds)...")
        forward(left_pwm, right_pwm, SPEED)
        time.sleep(2)
        
        print("   STOP (1 second)...")
        stop_motors(left_pwm, right_pwm)
        time.sleep(1)
        
        # Test 2: Turn Right
        print("2. Turning RIGHT (2 seconds)...")
        turn_right(left_pwm, right_pwm, SPEED)
        time.sleep(2)
        
        print("   STOP (1 second)...")
        stop_motors(left_pwm, right_pwm)
        time.sleep(1)
        
        # Test 3: Turn Left
        print("3. Turning LEFT (2 seconds)...")
        turn_left(left_pwm, right_pwm, SPEED)
        time.sleep(2)
        
        print("   STOP (1 second)...")
        stop_motors(left_pwm, right_pwm)
        time.sleep(1)
        
        # Test 4: Backward
        print("4. Moving BACKWARD (2 seconds)...")
        backward(left_pwm, right_pwm, SPEED)
        time.sleep(2)
        
        print("   STOP")
        stop_motors(left_pwm, right_pwm)
        
        print("\n" + "=" * 60)
        print("TEST COMPLETED SUCCESSFULLY!")
        print("=" * 60)
        
    except KeyboardInterrupt:
        print("\n\nTest interrupted by user")
    
    except Exception as e:
        print(f"\n\nERROR: {e}")
        import traceback
        traceback.print_exc()
    
    finally:
        # Cleanup - IMPORTANT: Stop PWM before GPIO.cleanup()
        print("\nCleaning up GPIO...")
        if left_pwm is not None:
            try:
                left_pwm.stop()
            except Exception as e:
                print(f"Warning: Error stopping left PWM: {e}")
        
        if right_pwm is not None:
            try:
                right_pwm.stop()
            except Exception as e:
                print(f"Warning: Error stopping right PWM: {e}")
        
        try:
            GPIO.cleanup()
        except Exception as e:
            print(f"Warning: Error during GPIO cleanup: {e}")
        
        print("Done!")

if __name__ == "__main__":
    main()
