"""
Buzzer control module for audio alerts
"""
import RPi.GPIO as GPIO
import time
from config import Config

class Buzzer:
    """Controls buzzer for audio alerts"""
    
    def __init__(self):
        """Initialize GPIO pin for buzzer"""
        GPIO.setmode(GPIO.BCM)
        GPIO.setwarnings(False)
        
        GPIO.setup(Config.BUZZER_PIN, GPIO.OUT)
        GPIO.output(Config.BUZZER_PIN, GPIO.LOW)
        
        if Config.DEBUG:
            print("[Buzzer] Initialized successfully")
    
    def beep(self, duration=0.1):
        """
        Single beep
        Args:
            duration: Beep duration in seconds
        """
        GPIO.output(Config.BUZZER_PIN, GPIO.HIGH)
        time.sleep(duration)
        GPIO.output(Config.BUZZER_PIN, GPIO.LOW)
    
    def beep_pattern(self, pattern):
        """
        Play a beep pattern
        Args:
            pattern: List of (on_time, off_time) tuples in seconds
        """
        for on_time, off_time in pattern:
            GPIO.output(Config.BUZZER_PIN, GPIO.HIGH)
            time.sleep(on_time)
            GPIO.output(Config.BUZZER_PIN, GPIO.LOW)
            if off_time > 0:
                time.sleep(off_time)
    
    def alert_startup(self):
        """Play startup sound"""
        self.beep_pattern([(0.1, 0.1), (0.1, 0)])
    
    def alert_connected(self):
        """Play connection success sound"""
        self.beep_pattern([(0.05, 0.05), (0.05, 0.05), (0.15, 0)])
    
    def alert_error(self):
        """Play error sound"""
        self.beep_pattern([(0.2, 0.1), (0.2, 0.1), (0.2, 0)])
    
    def alert_line_lost(self):
        """Play line lost alert"""
        self.beep_pattern([(0.05, 0.05), (0.05, 0)])
    
    def alert_obstacle(self):
        """Play obstacle detected alert"""
        self.beep_pattern([(0.1, 0)])
    
    def cleanup(self):
        """Clean up GPIO resources"""
        GPIO.output(Config.BUZZER_PIN, GPIO.LOW)
        if Config.DEBUG:
            print("[Buzzer] Cleaned up")
