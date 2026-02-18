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
    MOTOR_LEFT_FORWARD = int(os.getenv('MOTOR_LEFT_FORWARD', '23'))    # IN1
    MOTOR_LEFT_BACKWARD = int(os.getenv('MOTOR_LEFT_BACKWARD', '22'))  # IN2
    MOTOR_LEFT_ENABLE = int(os.getenv('MOTOR_LEFT_ENABLE', '20'))      # ENA
    MOTOR_RIGHT_FORWARD = int(os.getenv('MOTOR_RIGHT_FORWARD', '27'))  # IN3
    MOTOR_RIGHT_BACKWARD = int(os.getenv('MOTOR_RIGHT_BACKWARD', '17')) # IN4
    MOTOR_RIGHT_ENABLE = int(os.getenv('MOTOR_RIGHT_ENABLE', '16'))    # ENB
    
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
    
    # Line Following Configuration
    LINE_FOLLOW_SPEED = int(os.getenv('LINE_FOLLOW_SPEED', '50'))
    LINE_FOLLOW_KP = float(os.getenv('LINE_FOLLOW_KP', '15.0'))  # Reduced for smoother control
    LINE_FOLLOW_KI = float(os.getenv('LINE_FOLLOW_KI', '0.0'))   # Disabled initially
    LINE_FOLLOW_KD = float(os.getenv('LINE_FOLLOW_KD', '5.0'))   # Reduced for less jitter
    LINE_LOST_MAX_COUNT = int(os.getenv('LINE_LOST_MAX_COUNT', '20'))
    LINE_FOLLOW_UPDATE_RATE = float(os.getenv('LINE_FOLLOW_UPDATE_RATE', '0.05'))  # 20Hz
    INVERT_LINE_SENSORS = os.getenv('INVERT_LINE_SENSORS', 'False').lower() in ('true', '1', 'yes')  # True if sensors return 1 for black
    
    # Debug Mode
    DEBUG = os.getenv('DEBUG', 'True').lower() in ('true', '1', 'yes')
    
    # Hardware Enable/Disable Flags (for testing)
    ENABLE_MOTORS = os.getenv('ENABLE_MOTORS', 'True').lower() in ('true', '1', 'yes')
    ENABLE_CAMERA = os.getenv('ENABLE_CAMERA', 'False').lower() in ('true', '1', 'yes')
    ENABLE_SENSORS = os.getenv('ENABLE_SENSORS', 'True').lower() in ('true', '1', 'yes')
    ENABLE_BUZZER = os.getenv('ENABLE_BUZZER', 'False').lower() in ('true', '1', 'yes')
    ENABLE_WEBSOCKET = os.getenv('ENABLE_WEBSOCKET', 'False').lower() in ('true', '1', 'yes')
    ENABLE_PROXIMITY = os.getenv('ENABLE_PROXIMITY', 'False').lower() in ('true', '1', 'yes')
    ENABLE_BUMP = os.getenv('ENABLE_BUMP', 'False').lower() in ('true', '1', 'yes')
    
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
        print("-" * 50)
        print("Hardware Status:")
        print(f"  Motors:    {'ENABLED' if cls.ENABLE_MOTORS else 'DISABLED'}")
        print(f"  Camera:    {'ENABLED' if cls.ENABLE_CAMERA else 'DISABLED'}")
        print(f"  Sensors:   {'ENABLED' if cls.ENABLE_SENSORS else 'DISABLED'}")
        print(f"  Proximity: {'ENABLED' if cls.ENABLE_PROXIMITY else 'DISABLED'}")
        print(f"  Bump:      {'ENABLED' if cls.ENABLE_BUMP else 'DISABLED'}")
        print(f"  Buzzer:    {'ENABLED' if cls.ENABLE_BUZZER else 'DISABLED'}")
        print(f"  WebSocket: {'ENABLED' if cls.ENABLE_WEBSOCKET else 'DISABLED'}")
        print("=" * 50)
