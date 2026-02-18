"""
Sensor reading module for IR line sensors, proximity, and bump sensors
"""
import RPi.GPIO as GPIO
from config import Config

class SensorArray:
    """Manages all robot sensors"""
    
    def __init__(self):
        """Initialize GPIO pins for sensors"""
        GPIO.setmode(GPIO.BCM)
        GPIO.setwarnings(False)
        
        self._setup_sensor_pins()
        
        if Config.DEBUG:
            print("[SensorArray] Initialized successfully")
    
    def _setup_sensor_pins(self):
        """Configure GPIO pins for sensor input"""
        # IR Line sensors (INPUT with pull-up resistors)
        GPIO.setup(Config.IR_SENSOR_LEFT2, GPIO.IN, pull_up_down=GPIO.PUD_UP)
        GPIO.setup(Config.IR_SENSOR_LEFT1, GPIO.IN, pull_up_down=GPIO.PUD_UP)
        GPIO.setup(Config.IR_SENSOR_CENTER, GPIO.IN, pull_up_down=GPIO.PUD_UP)
        GPIO.setup(Config.IR_SENSOR_RIGHT1, GPIO.IN, pull_up_down=GPIO.PUD_UP)
        GPIO.setup(Config.IR_SENSOR_RIGHT2, GPIO.IN, pull_up_down=GPIO.PUD_UP)
        
        # IMPORTANT: Only setup proximity/bump if enabled AND pins don't conflict
        # with motor enable pins (default config has pin conflicts!)
        motor_pins = {Config.MOTOR_LEFT_ENABLE, Config.MOTOR_RIGHT_ENABLE,
                      Config.MOTOR_LEFT_FORWARD, Config.MOTOR_LEFT_BACKWARD,
                      Config.MOTOR_RIGHT_FORWARD, Config.MOTOR_RIGHT_BACKWARD}
        
        # Proximity sensor - skip if pin conflicts with motor pins
        if Config.ENABLE_PROXIMITY and Config.PROXIMITY_SENSOR not in motor_pins:
            GPIO.setup(Config.PROXIMITY_SENSOR, GPIO.IN, pull_up_down=GPIO.PUD_UP)
        elif Config.PROXIMITY_SENSOR in motor_pins:
            print(f"[SensorArray] ⚠ PROXIMITY pin {Config.PROXIMITY_SENSOR} conflicts with motor pin! Skipping setup.")
        
        # Bump sensor - skip if pin conflicts with motor pins
        if Config.ENABLE_BUMP and Config.BUMP_SENSOR not in motor_pins:
            GPIO.setup(Config.BUMP_SENSOR, GPIO.IN, pull_up_down=GPIO.PUD_UP)
        elif Config.BUMP_SENSOR in motor_pins:
            print(f"[SensorArray] ⚠ BUMP pin {Config.BUMP_SENSOR} conflicts with motor pin! Skipping setup.")
    
    def read_line_sensors(self):
        """
        Read all 5 IR line sensors
        Returns dict with sensor states (0 = black/line, 1 = white/no line)
        """
        return {
            'left2': GPIO.input(Config.IR_SENSOR_LEFT2),
            'left1': GPIO.input(Config.IR_SENSOR_LEFT1),
            'center': GPIO.input(Config.IR_SENSOR_CENTER),
            'right1': GPIO.input(Config.IR_SENSOR_RIGHT1),
            'right2': GPIO.input(Config.IR_SENSOR_RIGHT2)
        }
    
    def read_proximity(self):
        """
        Read proximity sensor
        Returns True if obstacle detected, False otherwise
        """
        if not Config.ENABLE_PROXIMITY:
            return False
        # Guard against pin conflict with motor pins
        motor_pins = {Config.MOTOR_LEFT_ENABLE, Config.MOTOR_RIGHT_ENABLE}
        if Config.PROXIMITY_SENSOR in motor_pins:
            return False
        return GPIO.input(Config.PROXIMITY_SENSOR) == 0
    
    def read_bump(self):
        """
        Read bump sensor
        Returns True if collision detected, False otherwise
        """
        if not Config.ENABLE_BUMP:
            return False
        # Guard against pin conflict with motor pins
        motor_pins = {Config.MOTOR_LEFT_ENABLE, Config.MOTOR_RIGHT_ENABLE}
        if Config.BUMP_SENSOR in motor_pins:
            return False
        return GPIO.input(Config.BUMP_SENSOR) == 0
    
    def read_all(self):
        """
        Read all sensors at once
        Returns comprehensive sensor data dict
        """
        line_sensors = self.read_line_sensors()
        
        return {
            'line_sensors': line_sensors,
            'proximity': self.read_proximity(),
            'bump': self.read_bump(),
            'line_detected': self._is_line_detected(line_sensors)
        }
    
    def _is_line_detected(self, line_sensors):
        """Check if any line sensor detects the line"""
        return any(sensor == 0 for sensor in line_sensors.values())
    
    def get_line_position(self):
        """
        Calculate line position relative to robot center
        Returns: 'left', 'center', 'right', 'lost', or 'multiple'
        """
        sensors = self.read_line_sensors()
        
        # Count how many sensors detect line
        detections = [k for k, v in sensors.items() if v == 0]
        
        if len(detections) == 0:
            return 'lost'
        elif len(detections) > 3:
            return 'multiple'
        elif 'center' in detections:
            return 'center'
        elif 'left1' in detections or 'left2' in detections:
            return 'left'
        elif 'right1' in detections or 'right2' in detections:
            return 'right'
        else:
            return 'center'
    
    def cleanup(self):
        """Clean up GPIO resources"""
        if Config.DEBUG:
            print("[SensorArray] Cleaned up")
