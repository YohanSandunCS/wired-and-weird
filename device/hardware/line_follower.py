"""
Line Following Module — PID or If-Condition Controller
Autonomous line tracking using 5-sensor IR array

Switchable via LINE_FOLLOW_MODE env variable:
  'pid' — Weighted continuous error + PID with anti-windup and derivative filtering
  'if'  — Simple if-condition pattern matching on sensor states

Shared features for both modes:
- Minimum motor speed to prevent stalling
- Smart multi-phase line recovery
- Intersection detection
- FULL verbose logging on every iteration for diagnostics
"""
import time
from config import Config


# Sensor position weights for error calculation (PID mode)
SENSOR_WEIGHTS = {
    'left2': -2.0,
    'left1': -1.0,
    'center': 0.0,
    'right1': 1.0,
    'right2': 2.0,
}


class LineFollower:
    """
    Line following controller with switchable algorithm.
    Uses 5 IR sensors to maintain position on black line.

    Mode is chosen by Config.LINE_FOLLOW_MODE:
        'pid' — classic PID  (default)
        'if'  — simple if-condition branching
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

        # Active mode
        self.mode = Config.LINE_FOLLOW_MODE  # 'pid' or 'if'

        # PID controller parameters (used only in pid mode)
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

        # If-condition mode speed settings
        self.if_slight_speed = Config.LINE_FOLLOW_IF_SLIGHT_SPEED
        self.if_sharp_speed = Config.LINE_FOLLOW_IF_SHARP_SPEED

        # Line lost handling
        self.line_lost_counter = 0
        self.last_known_error = 0.0  # continuous error value when line was last seen
        self.last_direction = 'center'
        self.max_lost_iterations = Config.LINE_LOST_MAX_COUNT
        self.search_phase = 0
        self.search_direction = 'right'

        # Iteration counter & start time for log timestamps
        self._iteration = 0
        self._start_time = time.time()

        print(f"[LF:INIT] t=0.000 MODE={self.mode.upper()}")
        if self.mode == 'pid':
            print(f"[LF:INIT] t=0.000 PID Kp={self.kp} Ki={self.ki} Kd={self.kd}")
        else:
            print(f"[LF:INIT] t=0.000 IF slight_speed={self.if_slight_speed} sharp_speed={self.if_sharp_speed}")
        print(f"[LF:INIT] t=0.000 base_speed={self.base_speed} min_motor={self.min_motor_speed}")
        print(f"[LF:INIT] t=0.000 INVERT_MOTOR_CORRECTION={Config.INVERT_MOTOR_CORRECTION}")
        print(f"[LF:INIT] t=0.000 INVERT_LINE_SENSORS={Config.INVERT_LINE_SENSORS}")

    def _ts(self):
        """Return elapsed seconds since init as formatted string for log lines."""
        return f"{time.time() - self._start_time:.3f}"

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

        # LOG: always print sensor state
        s = sensors
        sensor_bits = f"{s['left2']}{s['left1']}{s['center']}{s['right1']}{s['right2']}"
        active_names = [n for n, v in sensors.items() if v == 0]

        if active_count == 0:
            print(f"[LF:SENS] t={self._ts()} i={self._iteration} bits={sensor_bits} active=0 LOST")
            return None

        error = weighted_sum / active_count
        print(f"[LF:SENS] t={self._ts()} i={self._iteration} bits={sensor_bits} active={active_count} names={active_names} err={error:+.2f}")
        return error

    def detect_intersection(self, sensors=None):
        """Check if robot is on an intersection (4+ sensors active)."""
        if sensors is None:
            sensors = self._read_sensors()
        active = sum(1 for v in sensors.values() if v == 0)
        return active >= 4

    # ------------------------------------------------------------------
    # If-condition controller
    # ------------------------------------------------------------------

    def calculate_if_correction(self, sensors):
        """
        Determine motor speeds using simple if-condition logic based on
        which sensors see the line (value == 0 after inversion).

        Sensor layout (robot front view):
            left2  left1  center  right1  right2

        Returns:
            (left_speed, right_speed) tuple
        """
        l2 = sensors['left2'] == 0
        l1 = sensors['left1'] == 0
        c  = sensors['center'] == 0
        r1 = sensors['right1'] == 0
        r2 = sensors['right2'] == 0

        base = self.base_speed
        slight = self.if_slight_speed
        sharp = self.if_sharp_speed

        # --- Straight / centred patterns ---
        if c and not l2 and not l1 and not r1 and not r2:
            # Only centre → go straight
            action = "STRAIGHT (C)"
            left, right = base, base

        elif c and l1 and not l2 and not r1 and not r2:
            # Centre + left1 → slight left drift
            action = "SLIGHT_LEFT (C+L1)"
            left, right = slight, base

        elif c and r1 and not l1 and not l2 and not r2:
            # Centre + right1 → slight right drift
            action = "SLIGHT_RIGHT (C+R1)"
            left, right = base, slight

        elif c and l1 and r1:
            # Wide line or intersection area → go straight
            action = "STRAIGHT (L1+C+R1)"
            left, right = base, base

        # --- Moderate turns ---
        elif l1 and not c and not l2 and not r1 and not r2:
            # Only left1 → moderate left
            action = "LEFT (L1)"
            left, right = slight, base

        elif r1 and not c and not l1 and not l2 and not r2:
            # Only right1 → moderate right
            action = "RIGHT (R1)"
            left, right = base, slight

        # --- Sharp turns ---
        elif l2 and not r1 and not r2:
            # Far left sensor(s) active → sharp left
            action = "SHARP_LEFT (L2)"
            left, right = sharp, base

        elif r2 and not l1 and not l2:
            # Far right sensor(s) active → sharp right
            action = "SHARP_RIGHT (R2)"
            left, right = base, sharp

        elif l2 and l1 and not r1 and not r2:
            # Left2 + left1 (no centre) → sharp left
            action = "SHARP_LEFT (L2+L1)"
            left, right = sharp, base

        elif r2 and r1 and not l1 and not l2:
            # Right2 + right1 (no centre) → sharp right
            action = "SHARP_RIGHT (R2+R1)"
            left, right = base, sharp

        # --- All sensors active (intersection) ---
        elif l2 and l1 and c and r1 and r2:
            action = "INTERSECTION (ALL)"
            left, right = base, base

        # --- Fallback: go straight at reduced speed ---
        else:
            active = [n for n in ('left2', 'left1', 'center', 'right1', 'right2')
                      if sensors[n] == 0]
            action = f"FALLBACK ({'+'.join(active) if active else 'NONE'})"
            left, right = base, base

        # Apply motor correction inversion
        if Config.INVERT_MOTOR_CORRECTION:
            left, right = right, left
            action += " [INV]"

        # Enforce minimum speed
        left = max(self.min_motor_speed, min(100, left))
        right = max(self.min_motor_speed, min(100, right))

        print(f"[LF:IF  ] t={self._ts()} i={self._iteration} {action} L={left:.0f} R={right:.0f}")
        return left, right

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
        max_integral = 10.0
        self.integral = max(-max_integral, min(max_integral, self.integral))
        i_term = self.ki * self.integral

        # --- Derivative (with simple low-pass filter to reduce noise) ---
        raw_derivative = (error - self.previous_error) / dt
        alpha = 0.7  # 0 = full filter, 1 = no filter
        filtered_derivative = alpha * raw_derivative
        d_term = self.kd * filtered_derivative

        correction = p_term + i_term + d_term

        # Smooth correction to avoid sudden motor jerks
        smooth_factor = 0.3
        raw_correction = correction
        correction = (1 - smooth_factor) * correction + smooth_factor * self.last_correction

        # Update state
        self.previous_error = error
        self.last_time = current_time
        self.last_correction = correction

        # LOG: always print PID breakdown
        print(f"[LF:PID ] t={self._ts()} i={self._iteration} err={error:+.2f} dt={dt:.3f} P={p_term:+.1f} I={i_term:+.1f} D={d_term:+.1f} raw={raw_correction:+.1f} smooth={correction:+.1f} integral={self.integral:+.2f}")

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
        pre_invert = correction
        if Config.INVERT_MOTOR_CORRECTION:
            correction = -correction

        left_speed = self.base_speed + correction
        right_speed = self.base_speed - correction

        # Remember pre-clamp values for logging
        left_raw = left_speed
        right_raw = right_speed

        # Clamp to valid range but enforce a minimum so neither wheel stalls
        left_speed = max(self.min_motor_speed, min(100, left_speed))
        right_speed = max(self.min_motor_speed, min(100, right_speed))

        if abs(correction) < 2:
            direction = "STRAIGHT"
        elif correction > 0:
            direction = "RIGHT"
        else:
            direction = "LEFT"

        # LOG: always print motor output
        inv_str = f" (inverted from {pre_invert:+.1f})" if Config.INVERT_MOTOR_CORRECTION else ""
        print(f"[LF:MOT ] t={self._ts()} i={self._iteration} {direction} corr={correction:+.1f}{inv_str} L={left_speed:.0f}({left_raw:.0f}) R={right_speed:.0f}({right_raw:.0f}) base={self.base_speed}")

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
                # Decide search direction from last known error
                if self.last_known_error < -0.3:
                    self.search_direction = 'left'
                elif self.last_known_error > 0.3:
                    self.search_direction = 'right'
                else:
                    self.search_direction = self.last_direction if self.last_direction != 'center' else 'right'
                print(f"[LF:LOST] t={self._ts()} i={self._iteration} ⚠ LINE LOST — Phase 1: creep forward | last_err={self.last_known_error:+.2f} search_dir={self.search_direction}")

            fwd_speed = self.base_speed * 0.4
            print(f"[LF:LOST] t={self._ts()} i={self._iteration} phase=1 count={count}/8 action=FORWARD speed={fwd_speed:.0f}")
            self.motors.forward(fwd_speed)
            return True

        # ── Phase 2: rotate toward last-known side ──────────────
        if count <= 35:
            if count == 9:
                print(f"[LF:LOST] t={self._ts()} i={self._iteration} Phase 2: rotate {self.search_direction} | last_err={self.last_known_error:+.2f}")

            print(f"[LF:LOST] t={self._ts()} i={self._iteration} phase=2 count={count}/35 action=TURN_{self.search_direction.upper()} speed={search_speed}")
            if self.search_direction == 'left':
                self.motors.turn_left(search_speed)
            else:
                self.motors.turn_right(search_speed)
            return True

        # ── Phase 3: rotate opposite direction (wider sweep) ────
        if count <= 70:
            opposite = 'right' if self.search_direction == 'left' else 'left'
            if count == 36:
                print(f"[LF:LOST] t={self._ts()} i={self._iteration} Phase 3: counter-rotate {opposite}")

            print(f"[LF:LOST] t={self._ts()} i={self._iteration} phase=3 count={count}/70 action=TURN_{opposite.upper()} speed={search_speed}")
            if self.search_direction == 'left':
                self.motors.turn_right(search_speed)
            else:
                self.motors.turn_left(search_speed)
            return True

        # ── Phase 4: give up ────────────────────────────────────
        print(f"[LF:LOST] t={self._ts()} i={self._iteration} ❌ RECOVERY FAILED — line not found after {count} iterations")
        self.motors.stop()
        return False

    # ------------------------------------------------------------------
    # Main update loop
    # ------------------------------------------------------------------

    def update(self):
        """
        Main line following update — call this in a loop.

        Dispatches to PID or if-condition logic based on self.mode.

        Returns:
            bool: True if following or recovering, False if recovery failed.
        """
        self._iteration += 1

        if self.mode == 'if':
            return self._update_if()
        else:
            return self._update_pid()

    def _update_pid(self):
        """PID-based line following update."""
        # Read error
        error = self.get_line_error()

        if error is None:
            # Line lost
            return self.handle_line_lost()

        # ── Line found ──────────────────────────────────────────
        if self.line_lost_counter > 0:
            print(f"[LF:RECV] t={self._ts()} i={self._iteration} ✓ Line reacquired after {self.line_lost_counter} lost iterations")
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

    def _update_if(self):
        """If-condition-based line following update."""
        sensors = self._read_sensors()

        # Log sensor state
        s = sensors
        sensor_bits = f"{s['left2']}{s['left1']}{s['center']}{s['right1']}{s['right2']}"
        active_count = sum(1 for v in sensors.values() if v == 0)
        active_names = [n for n, v in sensors.items() if v == 0]

        print(f"[LF:SENS] t={self._ts()} i={self._iteration} bits={sensor_bits} active={active_count} names={active_names}")

        if active_count == 0:
            # No sensors see the line → lost
            print(f"[LF:SENS] t={self._ts()} i={self._iteration} LOST")
            return self.handle_line_lost()

        # ── Line found ──────────────────────────────────────────
        if self.line_lost_counter > 0:
            print(f"[LF:RECV] t={self._ts()} i={self._iteration} ✓ Line reacquired after {self.line_lost_counter} lost iterations")
        self.line_lost_counter = 0

        # Track last direction for recovery
        if sensors['left2'] == 0 or sensors['left1'] == 0:
            self.last_direction = 'left'
            self.last_known_error = -1.0
        elif sensors['right2'] == 0 or sensors['right1'] == 0:
            self.last_direction = 'right'
            self.last_known_error = 1.0
        else:
            self.last_direction = 'center'
            self.last_known_error = 0.0

        # Calculate and apply motor speeds
        left_speed, right_speed = self.calculate_if_correction(sensors)
        self.motors.set_motor_speeds(left_speed, right_speed)

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
        self._start_time = time.time()
        print(f"[LF:RST ] t=0.000 Controller reset")

    def set_speed(self, speed):
        """Update base speed for line following"""
        old = self.base_speed
        self.base_speed = max(20, min(100, speed))
        self.min_motor_speed = max(15, self.base_speed * 0.25)
        print(f"[LF:CFG ] t={self._ts()} speed {old}->{self.base_speed} min_motor={self.min_motor_speed}")

    def set_pid_gains(self, kp=None, ki=None, kd=None):
        """Update PID gains on the fly"""
        if kp is not None:
            self.kp = kp
        if ki is not None:
            self.ki = ki
        if kd is not None:
            self.kd = kd
        print(f"[LF:CFG ] t={self._ts()} PID updated: Kp={self.kp} Ki={self.ki} Kd={self.kd}")
