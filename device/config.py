"""
Configuration management for MediRunner Robot
Loads settings from .env file
"""
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class Config:
    """Application configuration loaded from environment variables"""
    
    # Gateway Configuration
    GATEWAY_HOST = os.getenv('GATEWAY_HOST', 'localhost')
    GATEWAY_PORT = int(os.getenv('GATEWAY_PORT', '8765'))
    GATEWAY_URL = os.getenv('GATEWAY_URL', f'ws://{GATEWAY_HOST}:{GATEWAY_PORT}')
    
    # Robot Identification
    ROBOT_ID = os.getenv('ROBOT_ID', 'medirunner_001')
    ROBOT_NAME = os.getenv('ROBOT_NAME', 'MediRunner Alpha')
    
    # GPIO Pin Configuration (BCM numbering)
    # L298N Motor Driver
    MOTOR_LEFT_FORWARD = int(os.getenv('MOTOR_LEFT_FORWARD', '17'))
    MOTOR_LEFT_BACKWARD = int(os.getenv('MOTOR_LEFT_BACKWARD', '18'))
    MOTOR_LEFT_ENABLE = int(os.getenv('MOTOR_LEFT_ENABLE', '22'))
    MOTOR_RIGHT_FORWARD = int(os.getenv('MOTOR_RIGHT_FORWARD', '23'))
    MOTOR_RIGHT_BACKWARD = int(os.getenv('MOTOR_RIGHT_BACKWARD', '24'))
    MOTOR_RIGHT_ENABLE = int(os.getenv('MOTOR_RIGHT_ENABLE', '25'))
    
    # IR Line Sensors
    IR_SENSOR_LEFT2 = int(os.getenv('IR_SENSOR_LEFT2', '5'))
    IR_SENSOR_LEFT1 = int(os.getenv('IR_SENSOR_LEFT1', '6'))
    IR_SENSOR_CENTER = int(os.getenv('IR_SENSOR_CENTER', '13'))
    IR_SENSOR_RIGHT1 = int(os.getenv('IR_SENSOR_RIGHT1', '19'))
    IR_SENSOR_RIGHT2 = int(os.getenv('IR_SENSOR_RIGHT2', '26'))
    
    # Other Sensors
    PROXIMITY_SENSOR = int(os.getenv('PROXIMITY_SENSOR', '16'))
    BUMP_SENSOR = int(os.getenv('BUMP_SENSOR', '20'))
    
    # Buzzer
    BUZZER_PIN = int(os.getenv('BUZZER_PIN', '21'))
    
    # Camera Configuration
    CAMERA_WIDTH = int(os.getenv('CAMERA_WIDTH', '640'))
    CAMERA_HEIGHT = int(os.getenv('CAMERA_HEIGHT', '480'))
    CAMERA_FPS = int(os.getenv('CAMERA_FPS', '30'))
    CAMERA_QUALITY = int(os.getenv('CAMERA_QUALITY', '85'))
    
    # Telemetry Configuration
    TELEMETRY_INTERVAL = float(os.getenv('TELEMETRY_INTERVAL', '0.5'))
    
    # Motor Speed Settings
    DEFAULT_MOTOR_SPEED = int(os.getenv('DEFAULT_MOTOR_SPEED', '70'))
    TURN_MOTOR_SPEED = int(os.getenv('TURN_MOTOR_SPEED', '60'))
    
    # Debug Mode
    DEBUG = os.getenv('DEBUG', 'True').lower() in ('true', '1', 'yes')
    
    @classmethod
    def display(cls):
        """Display current configuration (for debugging)"""
        print("=" * 50)
        print("MediRunner Robot Configuration")
        print("=" * 50)
        print(f"Robot ID: {cls.ROBOT_ID}")
        print(f"Robot Name: {cls.ROBOT_NAME}")
        print(f"Gateway URL: {cls.GATEWAY_URL}")
        print(f"Camera: {cls.CAMERA_WIDTH}x{cls.CAMERA_HEIGHT} @ {cls.CAMERA_FPS}fps")
        print(f"Debug Mode: {cls.DEBUG}")
        print("=" * 50)
