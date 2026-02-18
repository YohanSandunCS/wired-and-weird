"""
Motor control module for L298N motor driver
Manages DC motors for robot movement
"""
import RPi.GPIO as GPIO
from config import Config

class MotorController:
    """Controls robot movement via L298N motor driver"""
    
    def __init__(self):
        """Initialize GPIO pins for motor control"""
        GPIO.setmode(GPIO.BCM)
        GPIO.setwarnings(False)
        
        # Setup motor pins
        self._setup_motor_pins()
        
        # Initialize PWM for speed control
        self.left_pwm = GPIO.PWM(Config.MOTOR_LEFT_ENABLE, 1000)  # 1kHz frequency
        self.right_pwm = GPIO.PWM(Config.MOTOR_RIGHT_ENABLE, 1000)
        
        self.left_pwm.start(0)
        self.right_pwm.start(0)
        
        self.current_speed = Config.DEFAULT_MOTOR_SPEED
        
        if Config.DEBUG:
            print("[MotorController] Initialized successfully")
    
    def _setup_motor_pins(self):
        """Configure GPIO pins for motor control"""
        # Left motor pins
        GPIO.setup(Config.MOTOR_LEFT_FORWARD, GPIO.OUT)
        GPIO.setup(Config.MOTOR_LEFT_BACKWARD, GPIO.OUT)
        GPIO.setup(Config.MOTOR_LEFT_ENABLE, GPIO.OUT)
        
        # Right motor pins
        GPIO.setup(Config.MOTOR_RIGHT_FORWARD, GPIO.OUT)
        GPIO.setup(Config.MOTOR_RIGHT_BACKWARD, GPIO.OUT)
        GPIO.setup(Config.MOTOR_RIGHT_ENABLE, GPIO.OUT)
        
        # Initialize all to LOW
        GPIO.output(Config.MOTOR_LEFT_FORWARD, GPIO.LOW)
        GPIO.output(Config.MOTOR_LEFT_BACKWARD, GPIO.LOW)
        GPIO.output(Config.MOTOR_RIGHT_FORWARD, GPIO.LOW)
        GPIO.output(Config.MOTOR_RIGHT_BACKWARD, GPIO.LOW)
    
    def forward(self, speed=None):
        """Move robot forward"""
        speed = speed or self.current_speed
        
        GPIO.output(Config.MOTOR_LEFT_FORWARD, GPIO.LOW)
        GPIO.output(Config.MOTOR_LEFT_BACKWARD, GPIO.HIGH)
        GPIO.output(Config.MOTOR_RIGHT_FORWARD, GPIO.LOW)
        GPIO.output(Config.MOTOR_RIGHT_BACKWARD, GPIO.HIGH)
        
        self.left_pwm.ChangeDutyCycle(speed)
        self.right_pwm.ChangeDutyCycle(speed)
        
        if Config.DEBUG:
            print(f"[MotorController] Moving forward at speed {speed}")
    
    def backward(self, speed=None):
        """Move robot backward"""
        speed = speed or self.current_speed
        
        GPIO.output(Config.MOTOR_LEFT_FORWARD, GPIO.HIGH)
        GPIO.output(Config.MOTOR_LEFT_BACKWARD, GPIO.LOW)
        GPIO.output(Config.MOTOR_RIGHT_FORWARD, GPIO.HIGH)
        GPIO.output(Config.MOTOR_RIGHT_BACKWARD, GPIO.LOW)
        
        self.left_pwm.ChangeDutyCycle(speed)
        self.right_pwm.ChangeDutyCycle(speed)
        
        if Config.DEBUG:
            print(f"[MotorController] Moving backward at speed {speed}")
    
    def turn_left(self, speed=None):
        """Turn robot left"""
        speed = speed or Config.TURN_MOTOR_SPEED
        
        GPIO.output(Config.MOTOR_LEFT_FORWARD, GPIO.HIGH)
        GPIO.output(Config.MOTOR_LEFT_BACKWARD, GPIO.LOW)
        GPIO.output(Config.MOTOR_RIGHT_FORWARD, GPIO.LOW)
        GPIO.output(Config.MOTOR_RIGHT_BACKWARD, GPIO.HIGH)
        
        self.left_pwm.ChangeDutyCycle(speed)
        self.right_pwm.ChangeDutyCycle(speed)
        
        if Config.DEBUG:
            print(f"[MotorController] Turning left at speed {speed}")
    
    def turn_right(self, speed=None):
        """Turn robot right"""
        speed = speed or Config.TURN_MOTOR_SPEED
        
        GPIO.output(Config.MOTOR_LEFT_FORWARD, GPIO.LOW)
        GPIO.output(Config.MOTOR_LEFT_BACKWARD, GPIO.HIGH)
        GPIO.output(Config.MOTOR_RIGHT_FORWARD, GPIO.HIGH)
        GPIO.output(Config.MOTOR_RIGHT_BACKWARD, GPIO.LOW)
        
        self.left_pwm.ChangeDutyCycle(speed)
        self.right_pwm.ChangeDutyCycle(speed)
        
        if Config.DEBUG:
            print(f"[MotorController] Turning right at speed {speed}")
    
    def stop(self):
        """Stop all motors"""
        GPIO.output(Config.MOTOR_LEFT_FORWARD, GPIO.LOW)
        GPIO.output(Config.MOTOR_LEFT_BACKWARD, GPIO.LOW)
        GPIO.output(Config.MOTOR_RIGHT_FORWARD, GPIO.LOW)
        GPIO.output(Config.MOTOR_RIGHT_BACKWARD, GPIO.LOW)
        
        self.left_pwm.ChangeDutyCycle(0)
        self.right_pwm.ChangeDutyCycle(0)
        
        if Config.DEBUG:
            print("[MotorController] Stopped")
    
    def turn_left_differential(self, left_speed, right_speed):
        """
        Turn left using differential steering
        Left motor slower/backward, right motor faster/forward
        
        Args:
            left_speed: Speed for left motor (0-100)
            right_speed: Speed for right motor (0-100)
        """
        # Left motor - backward or slower
        GPIO.output(Config.MOTOR_LEFT_FORWARD, GPIO.HIGH)
        GPIO.output(Config.MOTOR_LEFT_BACKWARD, GPIO.LOW)
        self.left_pwm.ChangeDutyCycle(left_speed)
        
        # Right motor - forward or faster
        GPIO.output(Config.MOTOR_RIGHT_FORWARD, GPIO.LOW)
        GPIO.output(Config.MOTOR_RIGHT_BACKWARD, GPIO.HIGH)
        self.right_pwm.ChangeDutyCycle(right_speed)
        
        if Config.DEBUG:
            print(f"[MotorController] Differential left: L={left_speed}, R={right_speed}")
    
    def turn_right_differential(self, left_speed, right_speed):
        """
        Turn right using differential steering
        Left motor faster/forward, right motor slower/backward
        
        Args:
            left_speed: Speed for left motor (0-100)
            right_speed: Speed for right motor (0-100)
        """
        # Left motor - forward or faster
        GPIO.output(Config.MOTOR_LEFT_FORWARD, GPIO.LOW)
        GPIO.output(Config.MOTOR_LEFT_BACKWARD, GPIO.HIGH)
        self.left_pwm.ChangeDutyCycle(left_speed)
        
        # Right motor - backward or slower
        GPIO.output(Config.MOTOR_RIGHT_FORWARD, GPIO.HIGH)
        GPIO.output(Config.MOTOR_RIGHT_BACKWARD, GPIO.LOW)
        self.right_pwm.ChangeDutyCycle(right_speed)
        
        if Config.DEBUG:
            print(f"[MotorController] Differential right: L={left_speed}, R={right_speed}")
    
    def set_motor_speeds(self, left_speed, right_speed):
        """
        Set individual motor speeds for smooth differential steering
        Both motors move forward at different speeds for smooth turns
        
        Args:
            left_speed: Speed for left motor (0-100)
            right_speed: Speed for right motor (0-100)
        """
        # Clamp speeds
        left_speed = max(0, min(100, left_speed))
        right_speed = max(0, min(100, right_speed))
        
        # Both motors forward, just at different speeds
        GPIO.output(Config.MOTOR_LEFT_FORWARD, GPIO.LOW)
        GPIO.output(Config.MOTOR_LEFT_BACKWARD, GPIO.HIGH)
        GPIO.output(Config.MOTOR_RIGHT_FORWARD, GPIO.LOW)
        GPIO.output(Config.MOTOR_RIGHT_BACKWARD, GPIO.HIGH)
        
        self.left_pwm.ChangeDutyCycle(left_speed)
        self.right_pwm.ChangeDutyCycle(right_speed)
        
        if Config.DEBUG:
            print(f"[MotorController] Differential forward: L={left_speed:.1f}, R={right_speed:.1f}")
    
    def set_speed(self, speed):
        """Set default motor speed (0-100)"""
        self.current_speed = max(0, min(100, speed))
        if Config.DEBUG:
            print(f"[MotorController] Speed set to {self.current_speed}")
    
    def cleanup(self):
        """Clean up GPIO resources"""
        try:
            self.stop()
        except Exception as e:
            if Config.DEBUG:
                print(f"[MotorController] Error stopping motors: {e}")
        
        try:
            self.left_pwm.stop()
        except Exception as e:
            if Config.DEBUG:
                print(f"[MotorController] Error stopping left PWM: {e}")
        
        try:
            self.right_pwm.stop()
        except Exception as e:
            if Config.DEBUG:
                print(f"[MotorController] Error stopping right PWM: {e}")
        
        if Config.DEBUG:
            print("[MotorController] Cleaned up")
