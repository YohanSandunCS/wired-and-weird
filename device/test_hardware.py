#!/usr/bin/env python3
"""
Hardware Test Script
Tests each hardware component individually to verify connections
"""
import time
import sys
from config import Config
from hardware import MotorController, SensorArray, Camera, Buzzer

def test_buzzer():
    """Test buzzer"""
    print("\n" + "="*50)
    print("Testing Buzzer...")
    print("="*50)
    
    try:
        buzzer = Buzzer()
        print("✓ Buzzer initialized")
        
        print("Playing startup sound...")
        buzzer.alert_startup()
        time.sleep(1)
        
        print("Playing connected sound...")
        buzzer.alert_connected()
        time.sleep(1)
        
        print("Playing error sound...")
        buzzer.alert_error()
        
        buzzer.cleanup()
        print("✓ Buzzer test PASSED\n")
        return True
    except Exception as e:
        print(f"✗ Buzzer test FAILED: {e}\n")
        return False

def test_sensors():
    """Test sensor readings"""
    print("\n" + "="*50)
    print("Testing Sensors...")
    print("="*50)
    
    try:
        sensors = SensorArray()
        print("✓ Sensors initialized")
        
        print("\nReading sensors for 5 seconds...")
        for i in range(5):
            data = sensors.read_all()
            print(f"\nReading {i+1}:")
            print(f"  Line sensors: {data['line_sensors']}")
            print(f"  Line position: {sensors.get_line_position()}")
            print(f"  Proximity: {data['proximity']}")
            print(f"  Bump: {data['bump']}")
            time.sleep(1)
        
        sensors.cleanup()
        print("\n✓ Sensors test PASSED\n")
        return True
    except Exception as e:
        print(f"✗ Sensors test FAILED: {e}\n")
        return False

def test_motors():
    """Test motor movements"""
    print("\n" + "="*50)
    print("Testing Motors...")
    print("="*50)
    print("⚠️  Make sure robot is on a stand or can move freely!")
    
    response = input("Continue? (y/n): ")
    if response.lower() != 'y':
        print("Skipping motor test\n")
        return True
    
    try:
        motors = MotorController()
        print("✓ Motors initialized")
        
        test_speed = 40  # Low speed for safety
        test_duration = 1.5
        
        print(f"\nTesting at {test_speed}% speed for {test_duration}s each...")
        
        print("Moving forward...")
        motors.forward(test_speed)
        time.sleep(test_duration)
        motors.stop()
        time.sleep(0.5)
        
        print("Moving backward...")
        motors.backward(test_speed)
        time.sleep(test_duration)
        motors.stop()
        time.sleep(0.5)
        
        print("Turning left...")
        motors.turn_left(test_speed)
        time.sleep(test_duration)
        motors.stop()
        time.sleep(0.5)
        
        print("Turning right...")
        motors.turn_right(test_speed)
        time.sleep(test_duration)
        motors.stop()
        
        motors.cleanup()
        print("\n✓ Motors test PASSED\n")
        return True
    except Exception as e:
        print(f"✗ Motors test FAILED: {e}\n")
        if 'motors' in locals():
            motors.cleanup()
        return False

def test_camera():
    """Test camera capture"""
    print("\n" + "="*50)
    print("Testing Camera...")
    print("="*50)
    
    try:
        camera = Camera()
        print("✓ Camera initialized")
        
        camera.start()
        print("✓ Camera started")
        
        time.sleep(2)  # Let camera warm up
        
        print("Capturing frame...")
        frame = camera.capture_frame()
        if frame:
            print(f"✓ Frame captured: {frame.size}")
        else:
            print("✗ Failed to capture frame")
            return False
        
        print("Capturing base64 frame...")
        base64_frame = camera.capture_frame_base64()
        if base64_frame:
            print(f"✓ Base64 frame captured: {len(base64_frame)} characters")
        else:
            print("✗ Failed to capture base64 frame")
            return False
        
        camera.cleanup()
        print("\n✓ Camera test PASSED\n")
        return True
    except Exception as e:
        print(f"✗ Camera test FAILED: {e}\n")
        if 'camera' in locals():
            try:
                camera.cleanup()
            except:
                pass
        return False

def main():
    """Run all hardware tests"""
    print("="*50)
    print("MediRunner Hardware Test Suite")
    print("="*50)
    print(f"Robot ID: {Config.ROBOT_ID}")
    print(f"Debug Mode: {Config.DEBUG}")
    print("="*50)
    
    results = {}
    
    # Test each component
    results['buzzer'] = test_buzzer()
    results['sensors'] = test_sensors()
    results['motors'] = test_motors()
    results['camera'] = test_camera()
    
    # Summary
    print("\n" + "="*50)
    print("Test Summary")
    print("="*50)
    
    for component, passed in results.items():
        status = "✓ PASSED" if passed else "✗ FAILED"
        print(f"{component.capitalize():15s}: {status}")
    
    print("="*50)
    
    all_passed = all(results.values())
    
    if all_passed:
        print("\n✓ All tests PASSED! Robot is ready.")
        return 0
    else:
        print("\n✗ Some tests FAILED. Check hardware connections.")
        return 1

if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print("\n\nTest interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n\nFatal error: {e}")
        sys.exit(1)
