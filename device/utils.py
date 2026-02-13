#!/usr/bin/env python3
"""
Robot Utilities
Helper scripts for debugging and testing
"""
import sys
import time
from config import Config

def show_config():
    """Display current configuration"""
    Config.display()

def check_gpio_pins():
    """Check GPIO pin configuration"""
    print("=" * 50)
    print("GPIO Pin Configuration (BCM Mode)")
    print("=" * 50)
    print("\nMotor Driver (L298N):")
    print(f"  Left Forward:   GPIO {Config.MOTOR_LEFT_FORWARD}")
    print(f"  Left Backward:  GPIO {Config.MOTOR_LEFT_BACKWARD}")
    print(f"  Left Enable:    GPIO {Config.MOTOR_LEFT_ENABLE}")
    print(f"  Right Forward:  GPIO {Config.MOTOR_RIGHT_FORWARD}")
    print(f"  Right Backward: GPIO {Config.MOTOR_RIGHT_BACKWARD}")
    print(f"  Right Enable:   GPIO {Config.MOTOR_RIGHT_ENABLE}")
    
    print("\nIR Line Sensors:")
    print(f"  Left 2:  GPIO {Config.IR_SENSOR_LEFT2}")
    print(f"  Left 1:  GPIO {Config.IR_SENSOR_LEFT1}")
    print(f"  Center:  GPIO {Config.IR_SENSOR_CENTER}")
    print(f"  Right 1: GPIO {Config.IR_SENSOR_RIGHT1}")
    print(f"  Right 2: GPIO {Config.IR_SENSOR_RIGHT2}")
    
    print("\nOther Sensors:")
    print(f"  Proximity: GPIO {Config.PROXIMITY_SENSOR}")
    print(f"  Bump:      GPIO {Config.BUMP_SENSOR}")
    
    print("\nBuzzer:")
    print(f"  Buzzer: GPIO {Config.BUZZER_PIN}")
    print("=" * 50)

def test_websocket():
    """Test WebSocket connection to gateway"""
    import asyncio
    from network import WebSocketClient
    
    async def test():
        print("=" * 50)
        print("WebSocket Connection Test")
        print("=" * 50)
        print(f"Gateway URL: {Config.GATEWAY_URL}")
        print("\nAttempting connection...")
        
        client = WebSocketClient()
        success = await client.connect()
        
        if success:
            print("✓ Connection successful!")
            print(f"✓ Registered as: {Config.ROBOT_ID}")
            
            # Send test message
            print("\nSending test telemetry...")
            await client.send_telemetry({
                "test": True,
                "message": "Test from utilities script"
            })
            print("✓ Test message sent")
            
            await client.close()
        else:
            print("✗ Connection failed")
            print("\nTroubleshooting:")
            print("1. Ensure gateway server is running")
            print("2. Check GATEWAY_HOST and GATEWAY_PORT in .env")
            print("3. Verify network connectivity")
        
        print("=" * 50)
    
    asyncio.run(test())

def monitor_sensors():
    """Continuously monitor sensor readings"""
    from hardware import SensorArray
    
    print("=" * 50)
    print("Sensor Monitor (Press Ctrl+C to stop)")
    print("=" * 50)
    
    sensors = SensorArray()
    
    try:
        while True:
            data = sensors.read_all()
            line_pos = sensors.get_line_position()
            
            # Clear line and print
            sys.stdout.write('\r')
            sys.stdout.write(' ' * 100)
            sys.stdout.write('\r')
            
            output = f"Line: {data['line_sensors']} | Pos: {line_pos:8s} | "
            output += f"Prox: {'YES' if data['proximity'] else 'NO ':3s} | "
            output += f"Bump: {'YES' if data['bump'] else 'NO ':3s}"
            
            sys.stdout.write(output)
            sys.stdout.flush()
            
            time.sleep(0.1)
    
    except KeyboardInterrupt:
        print("\n\nStopped")
    finally:
        sensors.cleanup()

def main():
    """Utility menu"""
    if len(sys.argv) > 1:
        command = sys.argv[1]
        
        if command == 'config':
            show_config()
        elif command == 'pins':
            check_gpio_pins()
        elif command == 'websocket':
            test_websocket()
        elif command == 'monitor':
            monitor_sensors()
        else:
            print(f"Unknown command: {command}")
            show_usage()
    else:
        show_usage()

def show_usage():
    """Show usage information"""
    print("MediRunner Robot Utilities")
    print("\nUsage: python3 utils.py <command>")
    print("\nCommands:")
    print("  config     - Display current configuration")
    print("  pins       - Show GPIO pin mappings")
    print("  websocket  - Test WebSocket connection to gateway")
    print("  monitor    - Monitor sensor readings in real-time")
    print("\nExamples:")
    print("  python3 utils.py config")
    print("  python3 utils.py monitor")

if __name__ == "__main__":
    main()
