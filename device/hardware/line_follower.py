"""
Line Following Module using PID Controller
Autonomous line tracking using 5-sensor IR array

Robust implementation with:
- Weighted continuous error calculation
- PID with anti-windup and derivative filtering
- Minimum motor speed to prevent stalling
- Smart multi-phase line recovery
- Intersection detection
- Throttled debug output to prevent I/O bottleneck
"""
import time
from config import Config


# Sensor position weights for error calculation
SENSOR_WEIGHTS = {
    'left2': -2.0,
    'left1': -1.0,
    'center': 0.0,
    'right1': 1.0,
    'right2': 2.0,
}


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
        self.previous_error = 0.0
        self.integral = 0.0
        self.last_time = time.time()
        self.last_correction = 0.0  # for smoothing

        # Line following speed
        self.base_speed = Config.LINE_FOLLOW_SPEED
        # Minimum motor speed so neither wheel fully stalls during turns
        self.min_motor_speed = max(15, self.base_speed * 0.25)

        # Line lost handling
        self.line_lost_counter = 0
        self.last_known_error = 0.0  # continuous error value when line was last seen
        self.last_direction = 'center'
        self.max_lost_iterations = Config.LINE_LOST_MAX_COUNT
        self.search_phase = 0  # track which recovery phase we're in
        self.search_direction = 'right'

        # Debug throttle — only print every N iterations to avoid I/O bottleneck
        self._iteration = 0
        self._debug_every = 10  # print every 10th iteration (~2 Hz at 20 Hz loop)

        if Config.DEBUG:
            print(f"[LineFollower] Initialized with PID: Kp={self.kp}, Ki={self.ki}, Kd={self.kd}")
            print(f"[LineFollower] Base speed: {self.base_speed}, Min motor speed: {self.min_motor_speed}")
            print(f"[LineFollower] Motor correction inverted: {Config.INVERT_MOTOR_CORRECTION}")
            print(f"[LineFollower] Sensor inversion: {Config.INVERT_LINE_SENSORS}")

    # ------------------------------------------------------------------
    # Sensor reading & error calculation
    # ------------------------------------------------------------------

    def _read_sensors(self):
        """Read and optionally invert line sensor values.
        Returns dict with 0 = on line, 1 = off line (after inversion if configured).
        """
        raw = self.sensors.read_line_sensors()
        if Config.INVERT_LINE_SENSORS:
            return {k: 1 - v for k, v in raw.items()}
        return raw

    def get_line_error(self):
        """Calculate line position error from sensor readings.

        Returns:
            float | None:
                Weighted position error in range roughly [-2, +2].
                - Negative → line is to the left → robot should turn left
                - Positive → line is to the right → robot should turn right
                - 0 → line is centred
                - None → no sensor detects the line (line lost)
        """
        sensors = self._read_sensors()

        # Count active sensors and compute weighted average position
        weighted_sum = 0.0
        active_count = 0

        for name, value in sensors.items():
            if value == 0:  # sensor detects line
                active_count += 1
                weighted_sum += SENSOR_WEIGHTS[name]

        # Throttled debug output
        should_print = Config.DEBUG and (self._iteration % self._debug_every == 0)
        if should_print:
            s = sensors
            sensor_str = (f"L2={s['left2']} L1={s['left1']} C={s['center']} "
                          f"R1={s['right1']} R2={s['right2']}")
            print(f"[LineFollower] Sensors: {sensor_str} | Active: {active_count}")

        if active_count == 0:
            return None  # line lost

        error = weighted_sum / active_count
        return error

    def detect_intersection(self, sensors=None):
        """Check if robot is on an intersection (4+ sensors active)."""
        if sensors is None:
            sensors = self._read_sensors()
        active = sum(1 for v in sensors.values() if v == 0)
        return active >= 4

    # ------------------------------------------------------------------
    # PID controller
    # ------------------------------------------------------------------

    def calculate_pid_correction(self, error):
        """
        Calculate PID correction value.

        Args:
            error: Current position error (roughly -2 to +2)

        Returns:
            correction: Motor speed adjustment
        """
        current_time = time.time()
        dt = current_time - self.last_time
        if dt <= 0:
            dt = 0.01

        # --- Proportional ---
        p_term = self.kp * error

        # --- Integral with anti-windup ---
        self.integral += error * dt
        # Clamp integral to prevent windup (scaled to be meaningful)
        max_integral = 10.0
        self.integral = max(-max_integral, min(max_integral, self.integral))
        i_term = self.ki * self.integral

        # --- Derivative (with simple low-pass filter to reduce noise) ---
        raw_derivative = (error - self.previous_error) / dt
        # Low-pass: blend with previous to smooth spikes
        alpha = 0.7  # 0 = full filter, 1 = no filter
        filtered_derivative = alpha * raw_derivative
        d_term = self.kd * filtered_derivative

        correction = p_term + i_term + d_term

        # Smooth correction to avoid sudden motor jerks
        smooth_factor = 0.3  # 0 = no smoothing, 1 = full old value
        correction = (1 - smooth_factor) * correction + smooth_factor * self.last_correction

        # Update state
        self.previous_error = error
        self.last_time = current_time
        self.last_correction = correction

        if Config.DEBUG and (self._iteration % self._debug_every == 0):
            print(f"[LineFollower] PID: P={p_term:.1f} I={i_term:.1f} D={d_term:.1f} → corr={correction:.1f}")

        return correction

    # ------------------------------------------------------------------
    # Motor application
    # ------------------------------------------------------------------

    def apply_correction(self, correction):
        """
        Apply PID correction to motor speeds with minimum speed clamping.

        Positive correction → line is to the right → speed up left, slow right → turn right.
        Negative correction → line is to the left → speed up right, slow left → turn left.
        """
        if Config.INVERT_MOTOR_CORRECTION:
            correction = -correction

        left_speed = self.base_speed + correction
        right_speed = self.base_speed - correction

        # Clamp to valid range but enforce a minimum so neither wheel stalls
        left_speed = max(self.min_motor_speed, min(100, left_speed))
        right_speed = max(self.min_motor_speed, min(100, right_speed))

        if Config.DEBUG and (self._iteration % self._debug_every == 0):
            if abs(correction) < 2:
                direction = "STRAIGHT"
            elif correction > 0:
                direction = "RIGHT"
            else:
                direction = "LEFT"
            print(f"[LineFollower] {direction} | L={left_speed:.0f} R={right_speed:.0f} | corr={correction:.1f}")

        self.motors.set_motor_speeds(left_speed, right_speed)

    # ------------------------------------------------------------------
    # Line-lost recovery
    # ------------------------------------------------------------------

    def handle_line_lost(self):
        """
        Multi-phase recovery when line is completely lost.

        Phase 1 (0-8 iter, ~400 ms): Creep forward — line may reappear.
        Phase 2 (9-35 iter, ~1.3 s): Rotate toward last-known direction at reduced speed.
        Phase 3 (36-70 iter, ~1.7 s): Rotate opposite direction (wider search).
        Phase 4: Give up → stop motors, signal failure.

        Returns True while still searching, False when giving up.
        """
        self.line_lost_counter += 1
        count = self.line_lost_counter

        # Reduced search speed to avoid overshooting
        search_speed = min(Config.TURN_MOTOR_SPEED, 45)

        # ── Phase 1: creep forward ──────────────────────────────
        if count <= 8:
            if count == 1:
                print("[LineFollower] ⚠ LINE LOST — Phase 1: creep forward")
                # Decide search direction from last known error
                if self.last_known_error < -0.3:
                    self.search_direction = 'left'
                elif self.last_known_error > 0.3:
                    self.search_direction = 'right'
                else:
                    # Default: try the side where line was last seen, or right
                    self.search_direction = self.last_direction if self.last_direction != 'center' else 'right'

            self.motors.forward(self.base_speed * 0.4)
            return True

        # ── Phase 2: rotate toward last-known side ──────────────
        if count <= 35:
            if count == 9:
                print(f"[LineFollower] Phase 2: rotate {self.search_direction} (last error={self.last_known_error:.1f})")

            if self.search_direction == 'left':
                self.motors.turn_left(search_speed)
            else:
                self.motors.turn_right(search_speed)
            return True

        # ── Phase 3: rotate opposite direction (wider sweep) ────
        if count <= 70:
            if count == 36:
                opposite = 'right' if self.search_direction == 'left' else 'left'
                print(f"[LineFollower] Phase 3: counter-rotate {opposite}")

            if self.search_direction == 'left':
                self.motors.turn_right(search_speed)
            else:
                self.motors.turn_left(search_speed)
            return True

        # ── Phase 4: give up ────────────────────────────────────
        print("[LineFollower] ❌ RECOVERY FAILED — line not found")
        self.motors.stop()
        return False

    # ------------------------------------------------------------------
    # Main update loop
    # ------------------------------------------------------------------

    def update(self):
        """
        Main line following update — call this in a loop.

        Returns:
            bool: True if following or recovering, False if recovery failed.
        """
        self._iteration += 1

        # Read error
        error = self.get_line_error()

        if error is None:
            # Line lost
            return self.handle_line_lost()

        # ── Line found ──────────────────────────────────────────
        if self.line_lost_counter > 0:
            print(f"[LineFollower] ✓ Line reacquired after {self.line_lost_counter} iterations")
        self.line_lost_counter = 0

        # Remember last known error for recovery direction
        self.last_known_error = error
        if error < -0.3:
            self.last_direction = 'left'
        elif error > 0.3:
            self.last_direction = 'right'
        else:
            self.last_direction = 'center'

        # PID
        correction = self.calculate_pid_correction(error)

        # Drive
        self.apply_correction(correction)

        return True

    # ------------------------------------------------------------------
    # Utility
    # ------------------------------------------------------------------

    def reset(self):
        """Reset PID controller state"""
        self.previous_error = 0.0
        self.integral = 0.0
        self.last_time = time.time()
        self.last_correction = 0.0
        self.line_lost_counter = 0
        self.last_known_error = 0.0
        self.last_direction = 'center'
        self._iteration = 0
        if Config.DEBUG:
            print("[LineFollower] Controller reset")

    def set_speed(self, speed):
        """Update base speed for line following"""
        self.base_speed = max(20, min(100, speed))
        self.min_motor_speed = max(15, self.base_speed * 0.25)
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
