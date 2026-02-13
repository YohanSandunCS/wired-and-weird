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
        
        # Proximity sensor
        GPIO.setup(Config.PROXIMITY_SENSOR, GPIO.IN, pull_up_down=GPIO.PUD_UP)
        
        # Bump sensor
        GPIO.setup(Config.BUMP_SENSOR, GPIO.IN, pull_up_down=GPIO.PUD_UP)
    
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
        return GPIO.input(Config.PROXIMITY_SENSOR) == 0
    
    def read_bump(self):
        """
        Read bump sensor
        Returns True if collision detected, False otherwise
        """
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
