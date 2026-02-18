"""
Line Following Module using PID Controller
Autonomous line tracking using 5-sensor IR array
"""
import time
from config import Config


class LineFollower:
    """
    PID-based line following controller
    Uses 5 IR sensors to maintain position on black line
    """
    
    def __init__(self, motors, sensors):
        """
        Initialize line follower
        
        Args:
            motors: MotorController instance
            sensors: SensorArray instance
        """
        self.motors = motors
        self.sensors = sensors
        
        # PID controller parameters
        self.kp = Config.LINE_FOLLOW_KP
        self.ki = Config.LINE_FOLLOW_KI
        self.kd = Config.LINE_FOLLOW_KD
        
        # PID state
        self.previous_error = 0
        self.integral = 0
        self.last_time = time.time()
        
        # Line following speed
        self.base_speed = Config.LINE_FOLLOW_SPEED
        
        # Line lost handling
        self.line_lost_counter = 0
        self.last_direction = 'center'  # Track last known direction
        self.max_lost_iterations = Config.LINE_LOST_MAX_COUNT
        
        if Config.DEBUG:
            print(f"[LineFollower] Initialized with PID: Kp={self.kp}, Ki={self.ki}, Kd={self.kd}")
            print(f"[LineFollower] Base speed: {self.base_speed}")
    
    def get_line_error(self):
        """Calculate line position error from sensor readings
        
        Returns weighted position error:
        - Negative = line is left of center (turn left)
        - Positive = line is right of center (turn right)
        - 0 = line is centered
        
        Sensor weights:
        left2: -2, left1: -1, center: 0, right1: +1, right2: +2
        """
        sensors = self.sensors.read_line_sensors()
        
        # Invert sensor values if configured (some sensors return 1 for black line)
        if Config.INVERT_LINE_SENSORS:
            sensors = {k: 1 - v for k, v in sensors.items()}
        
        # Define sensor positions (weighted)
        positions = {
            'left2': -2,
            'left1': -1,
            'center': 0,
            'right1': 1,
            'right2': 2
        }
        
        # Calculate weighted average position
        # Sensor value: 0 = on line (black), 1 = off line (white)
        # We want to find where the line is
        total_weight = 0
        weighted_sum = 0
        sensors_on_line = 0
        
        for sensor_name, sensor_value in sensors.items():
            if sensor_value == 0:  # Sensor detects line
                sensors_on_line += 1
                weight = positions[sensor_name]
                total_weight += 1
                weighted_sum += weight
        
        # DEBUG: Always print sensor values to diagnose issue
        print(f"[LineFollower] RAW SENSORS: L2={sensors['left2']} L1={sensors['left1']} C={sensors['center']} R1={sensors['right1']} R2={sensors['right2']} | On line: {sensors_on_line} | Inverted: {Config.INVERT_LINE_SENSORS}")
        
        # Calculate error
        if sensors_on_line == 0:
            # Line lost - return None to trigger search behavior
            print("[LineFollower] ERROR: No sensors detect line (all sensors = 1)")
            return None
        
        # Average position error
        error = weighted_sum / total_weight if total_weight > 0 else 0
        
        if Config.DEBUG:
            print(f"[LineFollower] Error: {error:.2f}")
        
        return error
    
    def calculate_pid_correction(self, error):
        """
        Calculate PID correction value
        
        Args:
            error: Current position error
            
        Returns:
            correction: Motor speed adjustment (-100 to +100)
        """
        current_time = time.time()
        delta_time = current_time - self.last_time
        
        if delta_time <= 0:
            delta_time = 0.01  # Prevent division by zero
        
        # Proportional term
        p_term = self.kp * error
        
        # Integral term (accumulate error over time)
        self.integral += error * delta_time
        # Anti-windup: limit integral accumulation
        self.integral = max(-50, min(50, self.integral))
        i_term = self.ki * self.integral
        
        # Derivative term (rate of change)
        derivative = (error - self.previous_error) / delta_time
        d_term = self.kd * derivative
        
        # Total correction
        correction = p_term + i_term + d_term
        
        # Update state
        self.previous_error = error
        self.last_time = current_time
        
        if Config.DEBUG:
            print(f"[LineFollower] PID: P={p_term:.2f}, I={i_term:.2f}, D={d_term:.2f}, Correction={correction:.2f}")
        
        return correction
    
    def apply_correction(self, correction):
        """
        Apply PID correction to motor speeds
        
        Args:
            correction: Speed adjustment value
            Positive correction = line is right, need to turn right (slow right motor)
            Negative correction = line is left, need to turn left (slow left motor)
        """
        # Calculate individual motor speeds
        # When line is right (+correction), slow down right motor
        # When line is left (-correction), slow down left motor
        left_speed = self.base_speed + correction  # Increase if turning right
        right_speed = self.base_speed - correction  # Increase if turning left
        
        # Clamp speeds to valid range (0-100)
        left_speed = max(0, min(100, left_speed))
        right_speed = max(0, min(100, right_speed))
        
        # Always print motor speeds for debugging
        print(f"[LineFollower] → Motor speeds: L={left_speed:.1f}, R={right_speed:.1f} (correction={correction:.1f})")
        
        # Apply smooth differential steering (both motors forward)
        self.motors.set_motor_speeds(left_speed, right_speed)
    
    def handle_line_lost(self):
        """
        Handle situation when line is completely lost
        Implements search pattern to reacquire line
        """
        self.line_lost_counter += 1
        
        if self.line_lost_counter <= 3:
            # First few iterations: continue in last direction briefly
            print(f"[LineFollower] Line lost! Attempting recovery... ({self.line_lost_counter})")
            self.motors.forward(self.base_speed * 0.5)
            
        elif self.line_lost_counter <= 10:
            # Search pattern: turn in last known direction
            if self.last_direction == 'left' or self.previous_error < 0:
                print("[LineFollower] Searching left...")
                self.motors.turn_left(Config.TURN_MOTOR_SPEED)
            else:
                print("[LineFollower] Searching right...")
                self.motors.turn_right(Config.TURN_MOTOR_SPEED)
                
        else:
            # Line lost for too long - stop robot
            print("[LineFollower] Line completely lost! Stopping.")
            self.motors.stop()
            return False
        
        return True
    
    def update(self):
        """
        Main line following update - call this in a loop
        
        Returns:
            bool: True if successfully following, False if line lost
        """
        # Get current line position error
        error = self.get_line_error()
        
        # Check if line is detected
        if error is None:
            # Line not detected
            return self.handle_line_lost()
        
        # Line detected - reset lost counter
        self.line_lost_counter = 0
        
        # Update last known direction
        if error < -0.5:
            self.last_direction = 'left'
        elif error > 0.5:
            self.last_direction = 'right'
        else:
            self.last_direction = 'center'
        
        # Calculate PID correction
        correction = self.calculate_pid_correction(error)
        
        # Apply correction to motors
        self.apply_correction(correction)
        
        return True
    
    def reset(self):
        """Reset PID controller state"""
        self.previous_error = 0
        self.integral = 0
        self.last_time = time.time()
        self.line_lost_counter = 0
        self.last_direction = 'center'
        
        if Config.DEBUG:
            print("[LineFollower] Controller reset")
    
    def set_speed(self, speed):
        """Update base speed for line following"""
        self.base_speed = max(20, min(100, speed))
        if Config.DEBUG:
            print(f"[LineFollower] Base speed set to {self.base_speed}")
    
    def set_pid_gains(self, kp=None, ki=None, kd=None):
        """Update PID gains on the fly"""
        if kp is not None:
            self.kp = kp
        if ki is not None:
            self.ki = ki
        if kd is not None:
            self.kd = kd
        
        if Config.DEBUG:
            print(f"[LineFollower] PID gains updated: Kp={self.kp}, Ki={self.ki}, Kd={self.kd}")
