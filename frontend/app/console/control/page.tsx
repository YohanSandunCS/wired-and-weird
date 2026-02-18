"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import useAppStore from "@/store/appStore";
import { useRobotSocket } from "@/hooks/useRobotSocket";
import BatteryStatus from "@/components/BatteryStatus";

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
  const logContainerRef = useRef<HTMLDivElement>(null);
  const isMouseOnScrollbar = useRef(false);

  const { isConnected, logs, latestVisionFrame, connect, disconnect, send } =
    useRobotSocket(robotId);

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
  }, [pressedKeys, sendMovementCommand, sendStopCommand]);

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
        <div className="flex gap-8 items-start">
          {/* Main Content: Live Video Feed */}
          <div className="w-1/2 flex flex-col space-y-6">
            <div className="glass-card flex flex-col p-0 overflow-hidden" style={{ minHeight: "520px" }}>
              <div className="relative flex-grow">
                {/* Video Feed */}
                <div className="absolute inset-0 bg-[#0B0F2A] flex items-center justify-center">
                  {!isConnected ? (
                    <div className="text-gray-500 text-center">
                      <div className="text-gray-400 mb-2 text-2xl">📹</div>
                      <div className="text-sm">Connect to view live feed</div>
                    </div>
                  ) : !latestVisionFrame ? (
                    <div className="text-gray-500 text-center">
                      <div className="text-gray-500 mb-2 text-2xl">⏳</div>
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

              {latestVisionFrame && (
                <div
                  className="p-6 border-t border-cyan-500/10"
                  style={{ background: "rgba(15, 23, 60, 0.65)" }}
                >
                  <div className="text-xs text-gray-400 space-y-2">
                    <div className="flex justify-between">
                      <span>Keyboard key mapping:</span>
                      <span className="font-mono text-cyan-400">
                        {latestVisionFrame.role}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2 text-sm pt-2">
                      <div className="flex items-center space-x-2">
                        <kbd className="px-2 py-1 text-xs font-bold text-cyan-300 bg-cyan-500/10 border border-cyan-500/20 rounded-lg">
                          ↑
                        </kbd>
                        <span className="text-gray-300">Forward</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <kbd className="px-2 py-1 text-xs font-bold text-cyan-300 bg-cyan-500/10 border border-cyan-500/20 rounded-lg">
                          ↓
                        </kbd>
                        <span className="text-gray-300">Backward</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <kbd className="px-2 py-1 text-xs font-bold text-cyan-300 bg-cyan-500/10 border border-cyan-500/20 rounded-lg">
                          ←
                        </kbd>
                        <span className="text-gray-300">Turn Left</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <kbd className="px-2 py-1 text-xs font-bold text-cyan-300 bg-cyan-500/10 border border-cyan-500/20 rounded-lg">
                          →
                        </kbd>
                        <span className="text-gray-300">Turn Right</span>
                      </div>
                      <div className="flex items-center space-x-2 col-span-2">
                        <kbd className="px-2 py-1 text-xs font-bold text-cyan-300 bg-cyan-500/10 border border-cyan-500/20 rounded-lg">
                          Space
                        </kbd>
                        <span className="text-gray-300">Emergency Stop</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="w-1/2 flex flex-col space-y-6">
            {/* Input Visualizer */}
            <div className="glass-card p-4 flex flex-col items-center">
              {/* Fixed-size square D-Pad */}
              <div
                className="relative"
                style={{ width: "500px", height: "500px" }}
              >
                {/* Up */}
                <button
                  onClick={() => sendMovementCommand("forward")}
                  disabled={!isConnected || !robot.isOnline}
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
                  disabled={!isConnected || !robot.isOnline}
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
                  disabled={!isConnected}
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
                  disabled={!isConnected || !robot.isOnline}
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
                  disabled={!isConnected || !robot.isOnline}
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
            </div>

            {/* Filtered Logs / Diagnostics */}
            <div className="glass-card p-6">
              <h2 className="text-lg font-medium text-white mb-4 glow-heading">
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
    </div>
  );
}
