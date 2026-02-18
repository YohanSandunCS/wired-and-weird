"""
Line Following Script - MediRunner Robot
Reads 5 IR sensors directly and controls motors with if-else logic.

IR Sensor Array (BCM pin numbering):
  LEFT2 = GPIO 5   (far left)
  LEFT1 = GPIO 6   (near left)
  CENTER = GPIO 13 (center)
  RIGHT1 = GPIO 19 (near right)
  RIGHT2 = GPIO 26 (far right)

Sensor reading convention (INVERT_LINE_SENSORS=True):
  GPIO reads HIGH (1) on black line  →  we invert  →  1 means ON LINE
  GPIO reads LOW  (0) on white floor →  we invert  →  0 means OFF LINE
"""

import RPi.GPIO as GPIO
import time
from hardware.motors import MotorController

# ── IR Sensor Pins (BCM) ─────────────────────────────────────────────────────
IR_LEFT2  = 5
IR_LEFT1  = 6
IR_CENTER = 13
IR_RIGHT1 = 19
IR_RIGHT2 = 26

IR_PINS = [IR_LEFT2, IR_LEFT1, IR_CENTER, IR_RIGHT1, IR_RIGHT2]

# ── Speed Settings ────────────────────────────────────────────────────────────
SPEED_STRAIGHT   = 50   # % PWM – forward on line
SPEED_SOFT_TURN  = 50   # % PWM – gentle correction
SPEED_HARD_TURN  = 55   # % PWM – sharp correction

# ── Invert sensor logic ───────────────────────────────────────────────────────
# Set True if your IR module outputs HIGH (1) when it sees the black line
INVERT_SENSORS = True


def setup_sensors():
    """Configure IR sensor pins as inputs with pull-up resistors."""
    GPIO.setmode(GPIO.BCM)
    GPIO.setwarnings(False)
    for pin in IR_PINS:
        GPIO.setup(pin, GPIO.IN, pull_up_down=GPIO.PUD_UP)


def read_sensors():
    """
    Read all 5 IR sensors and return a tuple of booleans.
    True  = sensor is ON the line
    False = sensor is OFF the line (white floor)
    """
    raw = [GPIO.input(pin) for pin in IR_PINS]
    if INVERT_SENSORS:
        # HIGH raw reading means black line → on-line = True
        return tuple(bool(v) for v in raw)
    else:
        # LOW raw reading means black line → invert
        return tuple(not bool(v) for v in raw)


def follow_line(motors: MotorController):
    """
    Single iteration of the line-following control loop.
    Uses simple if-else logic based on the 5-sensor pattern.
    """
    l2, l1, c, r1, r2 = read_sensors()

    # ── All sensors off line ──────────────────────────────────────────────────
    if not l2 and not l1 and not c and not r1 and not r2:
        # Line lost – stop and let the caller handle recovery
        motors.stop()
        return "LINE_LOST"

    # ── Perfectly centered ────────────────────────────────────────────────────
    elif c and not l1 and not r1:
        motors.forward(SPEED_STRAIGHT)
        return "STRAIGHT"

    # ── Center + both near sensors (wide line / junction) ────────────────────
    elif c and l1 and r1:
        motors.forward(SPEED_STRAIGHT)
        return "STRAIGHT_WIDE"

    # ── Slight left (line drifted left) ──────────────────────────────────────
    elif l1 and not l2 and not r1:
        # Correct: slow left motor, speed up right motor (soft right steer)
        motors.turn_right_differential(SPEED_SOFT_TURN - 15, SPEED_SOFT_TURN)
        return "SOFT_RIGHT"

    # ── Hard left (line drifted far left) ────────────────────────────────────
    elif l2 and not r1 and not r2:
        motors.turn_right_differential(SPEED_HARD_TURN - 30, SPEED_HARD_TURN)
        return "HARD_RIGHT"

    # ── Slight right (line drifted right) ────────────────────────────────────
    elif r1 and not r2 and not l1:
        # Correct: slow right motor, speed up left motor (soft left steer)
        motors.turn_left_differential(SPEED_SOFT_TURN, SPEED_SOFT_TURN - 15)
        return "SOFT_LEFT"

    # ── Hard right (line drifted far right) ──────────────────────────────────
    elif r2 and not l1 and not l2:
        motors.turn_left_differential(SPEED_HARD_TURN, SPEED_HARD_TURN - 30)
        return "HARD_LEFT"

    # ── Center + slight left ──────────────────────────────────────────────────
    elif c and l1 and not r1:
        motors.turn_right_differential(SPEED_SOFT_TURN - 10, SPEED_SOFT_TURN)
        return "TRIM_RIGHT"

    # ── Center + slight right ─────────────────────────────────────────────────
    elif c and r1 and not l1:
        motors.turn_left_differential(SPEED_SOFT_TURN, SPEED_SOFT_TURN - 10)
        return "TRIM_LEFT"

    # ── Fallback: any center reading → go straight ────────────────────────────
    else:
        motors.forward(SPEED_STRAIGHT)
        return "STRAIGHT_FALLBACK"


def main():
    print("[line_follow] Starting line follower. Press CTRL+C to stop.")
    setup_sensors()
    motors = MotorController()

    line_lost_count = 0
    LINE_LOST_MAX = 30  # iterations before giving up

    try:
        while True:
            state = follow_line(motors)
            print(f"[line_follow] {state}  sensors={read_sensors()}")

            if state == "LINE_LOST":
                line_lost_count += 1
                if line_lost_count >= LINE_LOST_MAX:
                    print("[line_follow] Line lost too long – stopping.")
                    motors.stop()
                    break
            else:
                line_lost_count = 0  # reset counter when line re-found

            time.sleep(0.03)  # ~33 Hz loop

    except KeyboardInterrupt:
        print("\n[line_follow] Interrupted by user.")

    finally:
        motors.stop()
        GPIO.cleanup()
        print("[line_follow] GPIO cleaned up. Exiting.")


if __name__ == "__main__":
    main()
