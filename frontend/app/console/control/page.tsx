"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import useAppStore from "@/store/appStore";
import { useRobotSocket } from "@/hooks/useRobotSocket";
import BatteryStatus from "@/components/BatteryStatus";
import PanoramicViewer from "@/components/PanoramicViewer";

export default function RobotControlPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const robotId = searchParams.get("robotId");

  const { teamSession, robots, isAuthenticated } = useAppStore();
  const robot = robots.find((r) => r.robotId === robotId);

  const [pressedKeys, setPressedKeys] = useState(new Set<string>());
  const [commandHistory, setCommandHistory] = useState<
    Array<{ id: string; command: string; timestamp: number }>
  >([]);
  const [streamStatus, setStreamStatus] = useState<
    "loading" | "connected" | "error"
  >("loading");
  const [showPanoramicModal, setShowPanoramicModal] = useState(false);
  const [isPanoramicCapturing, setIsPanoramicCapturing] = useState(false);
  const [currentMode, setCurrentMode] = useState<"manual" | "auto">("manual");
  const [manualCommandSent, setManualCommandSent] = useState(false);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const isMouseOnScrollbar = useRef(false);

  const {
    isConnected,
    logs,
    latestVisionFrame,
    latestPanoramicImage,
    connect,
    disconnect,
    send,
    clearPanoramicImage,
  } = useRobotSocket(robotId);

  // Redirect if not authenticated or not logged in or no robot
  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/face-login");
      return;
    }
    if (!teamSession.loggedIn) {
      router.push("/");
      return;
    }
    if (!robotId || !robot) {
      router.push("/console");
      return;
    }
  }, [isAuthenticated, teamSession.loggedIn, robotId, robot, router]);

  // Auto-connect when component mounts
  useEffect(() => {
    if (robotId && !isConnected) {
      connect();
    }
  }, [robotId, isConnected, connect]);

  // Send manual mode command once connected
  useEffect(() => {
    if (isConnected && robotId && !manualCommandSent) {
      const command = {
        type: "command",
        robotId,
        payload: {
          action: "manual",
        },
        timestamp: Date.now(),
      };

      send(command);
      setManualCommandSent(true);

      console.log("Sent manual mode command:", command);
    }
  }, [isConnected, robotId, send, manualCommandSent]);

  const sendMovementCommand = useCallback(
    (direction: string) => {
      if (!isConnected || !robotId) return;

      const command = {
        type: "command",
        robotId,
        payload: {
          action: "move",
          direction: direction,
        },
        timestamp: Date.now(),
      };

      send(command);

      // Add to command history
      const historyEntry = {
        id: Date.now().toString(),
        command: `Move ${direction}`,
        timestamp: Date.now(),
      };
      setCommandHistory((prev) => [...prev, historyEntry].slice(-20)); // Keep last 20 commands
    },
    [isConnected, robotId, send],
  );

  const sendStopCommand = useCallback(() => {
    if (!isConnected || !robotId) return;

    const command = {
      type: "command",
      robotId,
      payload: {
        action: "stop",
      },
      timestamp: Date.now(),
    };

    send(command);

    const historyEntry = {
      id: Date.now().toString(),
      command: "Stop",
      timestamp: Date.now(),
    };
    setCommandHistory((prev) => [...prev, historyEntry].slice(-20));
  }, [isConnected, robotId, send]);

  const capturePanoramicImage = useCallback(() => {
    if (!isConnected || !robotId) return;

    setIsPanoramicCapturing(true);

    const command = {
      type: "command",
      robotId,
      payload: {
        action: "panoramic",
      },
      timestamp: Date.now(),
    };

    send(command);

    const historyEntry = {
      id: Date.now().toString(),
      command: "Capture Panoramic Image",
      timestamp: Date.now(),
    };
    setCommandHistory((prev) => [...prev, historyEntry].slice(-20));
  }, [isConnected, robotId, send]);

  const toggleMode = useCallback(() => {
    if (!isConnected || !robotId) return;

    const newMode = currentMode === "manual" ? "auto" : "manual";

    const command = {
      type: "command",
      robotId,
      payload: {
        action: newMode === "auto" ? "auto" : "manual",
      },
      timestamp: Date.now(),
    };

    send(command);
    setCurrentMode(newMode);

    const historyEntry = {
      id: Date.now().toString(),
      command: `Switch to ${newMode === "auto" ? "Autonomous" : "Manual"} Mode`,
      timestamp: Date.now(),
    };
    setCommandHistory((prev) => [...prev, historyEntry].slice(-20));
  }, [isConnected, robotId, send, currentMode]);

  // Handle panoramic image response
  useEffect(() => {
    if (latestPanoramicImage) {
      setIsPanoramicCapturing(false);
      setShowPanoramicModal(true);
    }
  }, [latestPanoramicImage]);

  // Auto-scroll for logs
  useEffect(() => {
    const logContainer = logContainerRef.current;
    if (logContainer && !isMouseOnScrollbar.current) {
      logContainer.scrollTop = logContainer.scrollHeight;
    }
  }, [logs]);

  // Handle keyboard events
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't handle keyboard in auto mode
      if (currentMode === "auto") return;

      // Prevent default behavior for arrow keys
      if (
        ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(
          event.code,
        )
      ) {
        event.preventDefault();
      }

      if (pressedKeys.has(event.code)) return; // Key already pressed

      const newPressedKeys = new Set(pressedKeys);
      newPressedKeys.add(event.code);
      setPressedKeys(newPressedKeys);

      switch (event.code) {
        case "ArrowUp":
          sendMovementCommand("forward");
          break;
        case "ArrowDown":
          sendMovementCommand("backward");
          break;
        case "ArrowLeft":
          sendMovementCommand("left");
          break;
        case "ArrowRight":
          sendMovementCommand("right");
          break;
        case "Space":
          sendStopCommand();
          break;
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      // Don't handle keyboard in auto mode
      if (currentMode === "auto") return;

      const newPressedKeys = new Set(pressedKeys);
      newPressedKeys.delete(event.code);
      setPressedKeys(newPressedKeys);

      // Send stop command when arrow key is released
      if (
        ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code)
      ) {
        sendStopCommand();
      }
    };

    // Add focus to window to ensure we capture key events
    window.focus();

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [pressedKeys, sendMovementCommand, sendStopCommand, currentMode]);

  useEffect(() => {
    const logContainer = logContainerRef.current;

    const handleMouseDown = () => {
      isMouseOnScrollbar.current = true;
    };
    const handleMouseUp = () => {
      isMouseOnScrollbar.current = false;
    };

    if (logContainer) {
      logContainer.addEventListener("mousedown", handleMouseDown);
      window.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      if (logContainer) {
        logContainer.removeEventListener("mousedown", handleMouseDown);
      }
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, []);

  if (!teamSession.loggedIn || !robotId || !robot) {
    return (
      <div className="min-h-screen flex items-center justify-center relative z-10">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col relative z-10 overflow-y-auto">
      {/* Header */}
      <header
        className="border-b border-cyan-500/20"
        style={{
          background: "rgba(6,12,40,0.95)",
          backdropFilter: "blur(20px) saturate(1.4)",
          borderRadius: 0,
          boxShadow:
            "0 2px 32px rgba(0,229,255,0.07), 0 1px 0 rgba(0,229,255,0.12)",
        }}
      >
        <div className="max-w-full mx-auto px-6 lg:px-10">
          <div className="flex items-center justify-between py-4">
            {/* Left: back + title */}
            <div className="flex items-center gap-5">
              <button
                onClick={() => router.push("/console")}
                className="flex items-center gap-2 text-cyan-400 hover:text-cyan-200 transition-colors text-sm font-medium group"
              >
                <svg
                  viewBox="0 0 24 24"
                  width="18"
                  height="18"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="group-hover:-translate-x-0.5 transition-transform"
                >
                  <polyline points="15 18 9 12 15 6" />
                </svg>
                Back to Console
              </button>
              <div className="w-px h-8 bg-cyan-500/25" />
              <div>
                <h1 className="text-2xl font-bold text-white tracking-wide glow-heading leading-tight">
                  Robot Control Panel
                </h1>
                <p className="text-xs text-cyan-400/70 mt-0.5 tracking-widest uppercase">
                  Medi Runner — Live Control Interface
                </p>
              </div>
              <div className="w-px h-8 bg-cyan-500/25" />
              {/* Mode Status */}
              <div
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold border select-none ${
                  currentMode === "manual"
                    ? "bg-cyan-500/15 border-cyan-400/50 text-cyan-300"
                    : "bg-purple-500/15 border-purple-400/50 text-purple-300"
                }`}
              >
                {currentMode === "manual" ? (
                  <>
                    <svg
                      viewBox="0 0 24 24"
                      width="15"
                      height="15"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <rect x="2" y="7" width="20" height="14" rx="2" />
                      <path d="M12 7V3" />
                      <circle cx="12" cy="3" r="1" />
                      <line x1="8" y1="14" x2="8" y2="14" strokeWidth="3" />
                      <line x1="16" y1="14" x2="16" y2="14" strokeWidth="3" />
                      <line x1="12" y1="12" x2="12" y2="16" />
                      <line x1="10" y1="14" x2="14" y2="14" />
                    </svg>
                    Manual
                  </>
                ) : (
                  <>
                    <svg
                      viewBox="0 0 24 24"
                      width="15"
                      height="15"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <circle cx="12" cy="12" r="3" />
                      <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
                    </svg>
                    Auto
                  </>
                )}
              </div>
            </div>

            {/* Right: status pills + robot info + battery */}
            <div className="flex items-center gap-3">
              <div
                className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border tracking-wide ${
                  isConnected
                    ? "bg-cyan-500/10 border-cyan-400/40 text-cyan-300"
                    : "bg-red-500/10 border-red-400/40 text-red-300"
                }`}
              >
                <div
                  className={`w-2 h-2 rounded-full ${isConnected ? "bg-cyan-400 shadow-[0_0_6px_rgba(0,229,255,0.9)]" : "bg-red-400 shadow-[0_0_6px_rgba(239,68,68,0.9)]"}`}
                />
                WebSocket: {isConnected ? "Connected" : "Disconnected"}
              </div>
              <div
                className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border tracking-wide ${
                  robot.isOnline
                    ? "bg-emerald-500/10 border-emerald-400/40 text-emerald-300"
                    : "bg-red-500/10 border-red-400/40 text-red-300"
                }`}
              >
                <div
                  className={`w-2 h-2 rounded-full ${robot.isOnline ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.9)]" : "bg-red-400 shadow-[0_0_6px_rgba(239,68,68,0.9)]"}`}
                />
                Robot: {robot.isOnline ? "Online" : "Offline"}
              </div>
              <div className="w-px h-6 bg-cyan-500/25" />
              <div className="text-right">
                <p className="text-sm font-semibold text-white leading-tight">
                  {robot.name || robot.robotId}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Unit ID: {robot.robotId}
                </p>
              </div>
              <BatteryStatus
                battery={robot.battery}
                lastUpdate={robot.lastTelemetryUpdate}
                size="sm"
              />
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        {/* Row 1: Video | D-Pad */}
        <div className="flex gap-8 items-start">
          {/* Main Content: Live Video Feed */}
          <div className="w-3/5 flex flex-col space-y-6">
            <div
              className="glass-card flex flex-col p-0 overflow-hidden"
              style={{ minHeight: "520px" }}
            >
              <div className="relative flex-grow">
                {/* Video Feed */}
                <div className="absolute inset-0 bg-[#0B0F2A] flex items-center justify-center">
                  {!isConnected ? (
                    <div className="text-gray-500 text-center">
                      <div className="mb-3 flex justify-center">
                        <svg
                          viewBox="0 0 24 24"
                          width="48"
                          height="48"
                          fill="none"
                          stroke="rgba(0,229,255,0.35)"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M23 7l-7 5 7 5V7z" />
                          <rect
                            x="1"
                            y="5"
                            width="15"
                            height="14"
                            rx="2"
                            ry="2"
                          />
                        </svg>
                      </div>
                      <div className="text-sm text-gray-500">
                        Connect to view live feed
                      </div>
                    </div>
                  ) : !latestVisionFrame ? (
                    <div className="text-gray-500 text-center">
                      <div className="mb-3 flex justify-center">
                        <svg
                          viewBox="0 0 24 24"
                          width="48"
                          height="48"
                          fill="none"
                          stroke="rgba(0,229,255,0.35)"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="animate-spin"
                          style={{ animationDuration: "3s" }}
                        >
                          <circle
                            cx="12"
                            cy="12"
                            r="10"
                            strokeDasharray="40 20"
                          />
                          <polyline points="12 6 12 12 16 14" />
                        </svg>
                      </div>
                      <div className="text-sm text-gray-500">
                        Waiting for video stream...
                      </div>
                    </div>
                  ) : (
                    <img
                      src={`data:${latestVisionFrame.payload.mime};base64,${latestVisionFrame.payload.data}`}
                      alt="Robot Camera Feed"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        console.error("Failed to load vision frame:", e);
                      }}
                    />
                  )}
                </div>

                {/* Overlays */}
                <div className="absolute inset-0 p-6 flex flex-col justify-between">
                  {/* Top Overlay */}
                  <div className="flex items-start justify-between">
                    <h2 className="text-lg font-medium text-white bg-[#00000061] px-3 py-1 rounded-md">
                      Live Preview
                    </h2>
                    {latestVisionFrame && (
                      <div className="text-sm text-white bg-[#00000061] px-3 py-1 rounded-md">
                        {latestVisionFrame.payload.width}×
                        {latestVisionFrame.payload.height} •
                        {latestVisionFrame.payload.quality}% quality
                      </div>
                    )}
                  </div>

                  {/* Bottom Overlay */}
                  {latestVisionFrame && (
                    <div className="flex items-end">
                      <div className="bg-[#00000061] text-white text-xs px-2 py-1 rounded">
                        {new Date(
                          latestVisionFrame.timestamp,
                        ).toLocaleTimeString()}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* D-Pad */}
          <div className="w-2/5">
            <div className="glass-card p-6 flex flex-col items-center">
              {currentMode === "auto" && (
                <div className="w-full mb-3 text-center">
                  <span className="text-xs px-3 py-1 rounded-full bg-yellow-500/15 border border-yellow-400/30 text-yellow-300 font-medium">
                    Controls Disabled (Auto Mode)
                  </span>
                </div>
              )}
              {/* Fixed-size square D-Pad */}
              <div
                className="relative"
                style={{ width: "500px", height: "500px" }}
              >
                {/* Up */}
                <button
                  onClick={() => sendMovementCommand("forward")}
                  disabled={
                    !isConnected || !robot.isOnline || currentMode === "auto"
                  }
                  className={`absolute left-1/2 top-0 -translate-x-1/2 flex items-center justify-center rounded-2xl transition-all duration-150 disabled:opacity-40 ${
                    pressedKeys.has("ArrowUp")
                      ? "bg-cyan-400/25 text-cyan-100"
                      : "bg-[#071a2e] text-cyan-300 hover:bg-cyan-500/15"
                  }`}
                  style={{
                    width: "148px",
                    height: "148px",
                    border: "3px solid rgba(0,229,255,0.85)",
                    boxShadow: pressedKeys.has("ArrowUp")
                      ? "0 0 28px rgba(0,229,255,1), 0 0 56px rgba(0,229,255,0.45), inset 0 0 20px rgba(0,229,255,0.15)"
                      : "0 0 12px rgba(0,229,255,0.35), inset 0 0 10px rgba(0,229,255,0.07)",
                  }}
                >
                  <svg
                    viewBox="0 0 24 24"
                    width="64"
                    height="64"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="18 15 12 9 6 15" />
                  </svg>
                </button>
                {/* Left */}
                <button
                  onClick={() => sendMovementCommand("left")}
                  disabled={
                    !isConnected || !robot.isOnline || currentMode === "auto"
                  }
                  className={`absolute top-1/2 left-0 -translate-y-1/2 flex items-center justify-center rounded-2xl transition-all duration-150 disabled:opacity-40 ${
                    pressedKeys.has("ArrowLeft")
                      ? "bg-cyan-400/25 text-cyan-100"
                      : "bg-[#071a2e] text-cyan-300 hover:bg-cyan-500/15"
                  }`}
                  style={{
                    width: "148px",
                    height: "148px",
                    border: "3px solid rgba(0,229,255,0.85)",
                    boxShadow: pressedKeys.has("ArrowLeft")
                      ? "0 0 28px rgba(0,229,255,1), 0 0 56px rgba(0,229,255,0.45), inset 0 0 20px rgba(0,229,255,0.15)"
                      : "0 0 12px rgba(0,229,255,0.35), inset 0 0 10px rgba(0,229,255,0.07)",
                  }}
                >
                  <svg
                    viewBox="0 0 24 24"
                    width="64"
                    height="64"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                </button>
                {/* Center STOP */}
                <button
                  onClick={sendStopCommand}
                  disabled={!isConnected || currentMode === "auto"}
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center justify-center rounded-full text-white font-black tracking-widest transition-all duration-150 disabled:opacity-40 hover:bg-red-500/90"
                  style={{
                    width: "140px",
                    height: "140px",
                    fontSize: "1.1rem",
                    border: "3px solid rgba(239,68,68,0.9)",
                    background: "rgba(153,27,27,0.75)",
                    boxShadow:
                      "0 0 22px rgba(239,68,68,0.7), 0 0 44px rgba(239,68,68,0.3), inset 0 0 16px rgba(239,68,68,0.15)",
                  }}
                >
                  STOP
                </button>
                {/* Right */}
                <button
                  onClick={() => sendMovementCommand("right")}
                  disabled={
                    !isConnected || !robot.isOnline || currentMode === "auto"
                  }
                  className={`absolute top-1/2 right-0 -translate-y-1/2 flex items-center justify-center rounded-2xl transition-all duration-150 disabled:opacity-40 ${
                    pressedKeys.has("ArrowRight")
                      ? "bg-cyan-400/25 text-cyan-100"
                      : "bg-[#071a2e] text-cyan-300 hover:bg-cyan-500/15"
                  }`}
                  style={{
                    width: "148px",
                    height: "148px",
                    border: "3px solid rgba(0,229,255,0.85)",
                    boxShadow: pressedKeys.has("ArrowRight")
                      ? "0 0 28px rgba(0,229,255,1), 0 0 56px rgba(0,229,255,0.45), inset 0 0 20px rgba(0,229,255,0.15)"
                      : "0 0 12px rgba(0,229,255,0.35), inset 0 0 10px rgba(0,229,255,0.07)",
                  }}
                >
                  <svg
                    viewBox="0 0 24 24"
                    width="64"
                    height="64"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </button>
                {/* Down */}
                <button
                  onClick={() => sendMovementCommand("backward")}
                  disabled={
                    !isConnected || !robot.isOnline || currentMode === "auto"
                  }
                  className={`absolute left-1/2 bottom-0 -translate-x-1/2 flex items-center justify-center rounded-2xl transition-all duration-150 disabled:opacity-40 ${
                    pressedKeys.has("ArrowDown")
                      ? "bg-cyan-400/25 text-cyan-100"
                      : "bg-[#071a2e] text-cyan-300 hover:bg-cyan-500/15"
                  }`}
                  style={{
                    width: "148px",
                    height: "148px",
                    border: "3px solid rgba(0,229,255,0.85)",
                    boxShadow: pressedKeys.has("ArrowDown")
                      ? "0 0 28px rgba(0,229,255,1), 0 0 56px rgba(0,229,255,0.45), inset 0 0 20px rgba(0,229,255,0.15)"
                      : "0 0 12px rgba(0,229,255,0.35), inset 0 0 10px rgba(0,229,255,0.07)",
                  }}
                >
                  <svg
                    viewBox="0 0 24 24"
                    width="64"
                    height="64"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
              </div>
              {/* Panoramic Capture Button */}
              <div className="mt-6 w-full max-w-xs">
                <button
                  onClick={capturePanoramicImage}
                  disabled={!isConnected || isPanoramicCapturing}
                  className="w-full p-3 rounded-xl border border-purple-400/50 bg-purple-500/15 text-purple-300 font-medium hover:bg-purple-500/25 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  <svg
                    viewBox="0 0 24 24"
                    width="16"
                    height="16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                    <circle cx="12" cy="13" r="4" />
                  </svg>
                  {isPanoramicCapturing ? "Capturing..." : "360° Panoramic"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Row 2: Control Log | Keyboard Mapping */}
        <div className="flex gap-8 items-start mt-8">
          {/* Control Log */}
          <div className="w-3/5">
            <div className="glass-card p-6">
              <h2 className="text-base font-semibold text-white mb-4 glow-heading">
                Control Log
              </h2>
              <div
                ref={logContainerRef}
                className="bg-[#0a0e24] text-gray-100 rounded-xl p-3 overflow-y-auto text-xs font-mono log-scrollbar border border-cyan-500/10"
                style={{ height: "280px" }}
              >
                {logs.length === 0 ? (
                  <div className="text-gray-400 italic">No logs yet...</div>
                ) : (
                  <div className="space-y-1">
                    {logs.map((log) => (
                      <div key={log.id} className="flex">
                        <span className="text-gray-400 w-20 flex-shrink-0">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                        <span
                          className={`flex-1 break-words overflow-hidden ${
                            log.type === "error"
                              ? "text-red-400"
                              : log.type === "success"
                                ? "text-green-400"
                                : "text-gray-100"
                          }`}
                        >
                          {log.message}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          {/* Keyboard Mapping */}
          <div className="w-2/5">
            <div className="glass-card p-6">
              <h2 className="text-base font-semibold text-white mb-4 glow-heading">
                Keyboard Mapping
              </h2>
              {currentMode === "auto" ? (
                <div className="text-center py-4 text-yellow-300/70 text-sm">
                  Keyboard disabled in Auto Mode
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-x-6 gap-y-5 text-base">
                  <div className="flex items-center space-x-3">
                    <kbd
                      className={`px-4 py-2 text-base font-bold rounded-lg min-w-[2.5rem] text-center border transition-colors ${
                        pressedKeys.has("ArrowUp")
                          ? "bg-cyan-500 text-white border-cyan-600"
                          : "text-cyan-300 bg-cyan-500/10 border-cyan-500/20"
                      }`}
                    >
                      ↑
                    </kbd>
                    <span className="text-gray-300">Forward</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <kbd
                      className={`px-4 py-2 text-base font-bold rounded-lg min-w-[2.5rem] text-center border transition-colors ${
                        pressedKeys.has("ArrowDown")
                          ? "bg-cyan-500 text-white border-cyan-600"
                          : "text-cyan-300 bg-cyan-500/10 border-cyan-500/20"
                      }`}
                    >
                      ↓
                    </kbd>
                    <span className="text-gray-300">Backward</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <kbd
                      className={`px-4 py-2 text-base font-bold rounded-lg min-w-[2.5rem] text-center border transition-colors ${
                        pressedKeys.has("ArrowLeft")
                          ? "bg-cyan-500 text-white border-cyan-600"
                          : "text-cyan-300 bg-cyan-500/10 border-cyan-500/20"
                      }`}
                    >
                      ←
                    </kbd>
                    <span className="text-gray-300">Turn Left</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <kbd
                      className={`px-4 py-2 text-base font-bold rounded-lg min-w-[2.5rem] text-center border transition-colors ${
                        pressedKeys.has("ArrowRight")
                          ? "bg-cyan-500 text-white border-cyan-600"
                          : "text-cyan-300 bg-cyan-500/10 border-cyan-500/20"
                      }`}
                    >
                      →
                    </kbd>
                    <span className="text-gray-300">Turn Right</span>
                  </div>
                  <div className="flex items-center space-x-3 col-span-2">
                    <kbd
                      className={`px-4 py-2 text-base font-bold rounded-lg border transition-colors ${
                        pressedKeys.has("Space")
                          ? "bg-red-500 text-white border-red-600"
                          : "text-cyan-300 bg-cyan-500/10 border-cyan-500/20"
                      }`}
                    >
                      Space
                    </kbd>
                    <span className="text-gray-300">Emergency Stop</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer
        className="glass-card-light border-t border-cyan-500/10 p-4"
        style={{ borderRadius: 0 }}
      >
        <div className="max-w-7xl mx-auto text-center text-sm text-gray-500">
          MediRunner Robot Control Interface
        </div>
      </footer>

      {/* Panoramic Image Viewer */}
      {showPanoramicModal && latestPanoramicImage && (
        <PanoramicViewer
          imageUrl={`data:${latestPanoramicImage.payload.mime};base64,${latestPanoramicImage.payload.data}`}
          onClose={() => {
            setShowPanoramicModal(false);
            clearPanoramicImage();
          }}
          captureTime={latestPanoramicImage.payload.captureTime}
          width={latestPanoramicImage.payload.width}
          height={latestPanoramicImage.payload.height}
        />
      )}
    </div>
  );
}
