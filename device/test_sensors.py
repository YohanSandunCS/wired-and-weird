#!/usr/bin/env python3
"""
Sensor Array Test Script
Continuously displays sensor readings in real-time
"""
import time
import sys
import RPi.GPIO as GPIO
from hardware.sensors import SensorArray
from config import Config

def format_sensor_display(sensor_data):
    """
    Format sensor data for display
    Returns formatted string with all sensor values
    """
    line = sensor_data['line_sensors']
    
    # Format line sensors with visual representation
    # 0 = detects line (black), 1 = no line (white)
    left2 = '█' if line['left2'] == 0 else '░'
    left1 = '█' if line['left1'] == 0 else '░'
    center = '█' if line['center'] == 0 else '░'
    right1 = '█' if line['right1'] == 0 else '░'
    right2 = '█' if line['right2'] == 0 else '░'
    
    # Proximity and bump status
    prox = '⚠ OBSTACLE' if sensor_data['proximity'] else '  clear   '
    bump = '💥 COLLISION' if sensor_data['bump'] else '   safe    '
    
    # Line detection status
    line_status = '✓ LINE' if sensor_data['line_detected'] else '✗ LOST'
    
    # Build display string
    display = (
        f"Line: [{left2}][{left1}][{center}][{right1}][{right2}]  "
        f"Status: {line_status}  "
        f"Prox: {prox}  "
        f"Bump: {bump}  "
        f"Raw: L2={line['left2']} L1={line['left1']} C={line['center']} "
        f"R1={line['right1']} R2={line['right2']}"
    )
    
    return display

def format_sensor_display_simple(sensor_data):
    """
    Simple numeric format (fallback if unicode issues)
    """
    line = sensor_data['line_sensors']
    
    display = (
        f"Left2:{line['left2']} Left1:{line['left1']} Center:{line['center']} "
        f"Right1:{line['right1']} Right2:{line['right2']} | "
        f"Proximity:{1 if sensor_data['proximity'] else 0} "
        f"Bump:{1 if sensor_data['bump'] else 0} | "
        f"Line:{'YES' if sensor_data['line_detected'] else 'NO '}"
    )
    
    return display

def main():
    """Main test loop"""
    print("=" * 80)
    print("MediRunner Sensor Array Test")
    print("=" * 80)
    print(f"Robot ID: {Config.ROBOT_ID}")
    print()
    print("Sensor Guide:")
    print("  Line Sensors: 0 = ON LINE (black), 1 = OFF LINE (white)")
    print("  Proximity: 0 = clear, 1 = obstacle detected")
    print("  Bump: 0 = safe, 1 = collision detected")
    print()
    print("Order: [LEFT2] [LEFT1] [CENTER] [RIGHT1] [RIGHT2]")
    print()
    print("Press Ctrl+C to exit")
    print("=" * 80)
    print()
    
    # Initialize sensor array
    try:
        sensors = SensorArray()
        print("✓ Sensors initialized successfully\n")
    except Exception as e:
        print(f"✗ Failed to initialize sensors: {e}")
        return 1
    
    # Choose display format
    use_fancy_display = True  # Set to False if unicode characters cause issues
    
    try:
        # Main read loop
        iteration = 0
        while True:
            # Read all sensors
            sensor_data = sensors.read_all()
            
            # Format and display
            if use_fancy_display:
                try:
                    display_line = format_sensor_display(sensor_data)
                except UnicodeEncodeError:
                    # Fall back to simple format
                    use_fancy_display = False
                    display_line = format_sensor_display_simple(sensor_data)
            else:
                display_line = format_sensor_display_simple(sensor_data)
            
            # Print on same line (overwrite previous)
            # Use \r to return to start of line
            print(f"\r{display_line}", end='', flush=True)
            
            # Optional: Print newline every N iterations for logging
            iteration += 1
            if iteration % 20 == 0:  # New line every 20 reads (for scroll back)
                print()  # New line
            
            # Small delay to avoid flooding
            time.sleep(0.1)  # 10Hz update rate
    
    except KeyboardInterrupt:
        print("\n\n[Test] Interrupted by user")
    except Exception as e:
        print(f"\n\n[Test] Error during testing: {e}")
        return 1
    finally:
        # Cleanup
        print("\n[Test] Cleaning up...")
        sensors.cleanup()
        print("[Test] Test complete!")
    
    return 0


if __name__ == "__main__":
    sys.exit(main())
