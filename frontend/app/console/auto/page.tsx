"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import useAppStore from "@/store/appStore";
import { useRobotSocket } from "@/hooks/useRobotSocket";
import BatteryStatus from "@/components/BatteryStatus";
import PanoramicViewer from "@/components/PanoramicViewer";

export default function RobotAutonomousPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const robotId = searchParams.get("robotId");

  const { teamSession, robots, isAuthenticated } = useAppStore();
  const robot = robots.find((r) => r.robotId === robotId);

  const logContainerRef = useRef<HTMLDivElement>(null);
  const isMouseOnScrollbar = useRef(false);
  const [autoCommandSent, setAutoCommandSent] = useState(false);
  const [showPanoramicModal, setShowPanoramicModal] = useState(false);
  const [isPanoramicCapturing, setIsPanoramicCapturing] = useState(false);
  const [currentMode, setCurrentMode] = useState<"manual" | "auto">("auto");

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

  // Send autonomous mode command once connected
  useEffect(() => {
    if (isConnected && robotId && !autoCommandSent) {
      const command = {
        type: "command",
        robotId,
        payload: {
          action: "auto",
        },
        timestamp: Date.now(),
      };

      send(command);
      setAutoCommandSent(true);

      console.log("Sent autonomous mode command:", command);
    }
  }, [isConnected, robotId, send, autoCommandSent]);

  const capturePanoramicImage = () => {
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
    console.log("Sent panoramic capture command:", command);
  };

  const toggleMode = () => {
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
    console.log(`Switched to ${newMode} mode`);
  };

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
            {/* Left: back + title + mode toggle */}
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
                  Autonomous Mode
                </h1>
                <p className="text-xs text-cyan-400/70 mt-0.5 tracking-widest uppercase">
                  Medi Runner — Live Autonomous Interface
                </p>
              </div>
              <div className="w-px h-8 bg-cyan-500/25" />
              {/* Mode Toggle */}
              <button
                onClick={toggleMode}
                disabled={!isConnected}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold border transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed ${
                  currentMode === "manual"
                    ? "bg-cyan-500/15 border-cyan-400/50 text-cyan-300 hover:bg-cyan-500/25"
                    : "bg-purple-500/15 border-purple-400/50 text-purple-300 hover:bg-purple-500/25"
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
              </button>
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
          <div className="w-3/4 flex flex-col space-y-6">
            <div className="glass-card flex flex-col p-0 overflow-hidden">
              <div className="relative w-full" style={{ aspectRatio: "6/3" }}>
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
                      <div className="text-sm">Connect to view live feed</div>
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
                      <div className="text-sm">Waiting for video stream...</div>
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
                      {currentMode === "auto"
                        ? "Live Preview — Autonomous Mode"
                        : "Live Preview — Manual Mode"}
                    </h2>
                    {latestVisionFrame && (
                      <div className="text-sm text-white bg-[#00000061] px-3 py-1 rounded-md">
                        {latestVisionFrame.payload.width}×
                        {latestVisionFrame.payload.height} •{" "}
                        {latestVisionFrame.payload.quality}% quality
                      </div>
                    )}
                  </div>

                  {/* Bottom Overlay */}
                  {latestVisionFrame && (
                    <div className="flex items-end justify-between">
                      <div className="bg-[#00000061] text-white text-xs px-2 py-1 rounded">
                        {new Date(
                          latestVisionFrame.timestamp,
                        ).toLocaleTimeString()}
                      </div>
                      <div
                        className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full ${
                          currentMode === "auto"
                            ? "bg-purple-500/60 text-purple-100"
                            : "bg-cyan-500/60 text-cyan-100"
                        }`}
                      >
                        <svg
                          viewBox="0 0 24 24"
                          width="12"
                          height="12"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          {currentMode === "auto" ? (
                            <>
                              <circle cx="12" cy="12" r="3" />
                              <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
                            </>
                          ) : (
                            <>
                              <rect x="2" y="7" width="20" height="14" rx="2" />
                              <path d="M12 7V3" />
                            </>
                          )}
                        </svg>
                        {currentMode === "auto" ? "AUTO MODE" : "MANUAL MODE"}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {latestVisionFrame && (
                <div
                  className="p-5 border-t border-cyan-500/10"
                  style={{ background: "rgba(6,12,40,0.7)" }}
                >
                  <div className="flex justify-between items-center text-xs text-gray-400">
                    <span>
                      {currentMode === "auto"
                        ? "Robot is operating in autonomous mode"
                        : "Robot in manual mode (use Control page for controls)"}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${
                        currentMode === "auto"
                          ? "bg-purple-500/15 border-purple-400/30 text-purple-300"
                          : "bg-cyan-500/15 border-cyan-400/30 text-cyan-300"
                      }`}
                    >
                      <div
                        className={`w-1.5 h-1.5 rounded-full ${currentMode === "auto" ? "bg-purple-400 shadow-[0_0_4px_rgba(168,85,247,0.9)]" : "bg-cyan-400 shadow-[0_0_4px_rgba(0,229,255,0.9)]"}`}
                      />
                      {currentMode === "auto"
                        ? "Following line autonomously"
                        : "Manual control"}
                    </span>
                  </div>
                  <div className="text-xs pt-2 text-gray-500">
                    {currentMode === "auto"
                      ? "The robot is following the line autonomously. Monitor the video feed and logs for real-time status."
                      : "Switch to Control Robot page for manual controls or toggle back to Auto mode."}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="w-1/4 flex flex-col space-y-6">
            {/* Status Panel */}
            <div className="glass-card p-6">
              <h2 className="text-base font-semibold text-white mb-4 glow-heading">
                Status
              </h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Mode</span>
                  <span
                    className={`text-sm font-semibold px-2.5 py-0.5 rounded-full border ${
                      currentMode === "auto"
                        ? "bg-purple-500/15 border-purple-400/30 text-purple-300"
                        : "bg-cyan-500/15 border-cyan-400/30 text-cyan-300"
                    }`}
                  >
                    {currentMode === "auto" ? "Autonomous" : "Manual"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Command Sent</span>
                  <span
                    className={`text-sm font-semibold flex items-center gap-1 ${autoCommandSent ? "text-emerald-400" : "text-gray-500"}`}
                  >
                    {autoCommandSent ? (
                      <>
                        <svg
                          viewBox="0 0 24 24"
                          width="13"
                          height="13"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        Yes
                      </>
                    ) : (
                      "Pending"
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-400">Connection</span>
                  <span
                    className={`text-sm font-semibold flex items-center gap-1 ${isConnected ? "text-emerald-400" : "text-red-400"}`}
                  >
                    {isConnected ? (
                      <>
                        <svg
                          viewBox="0 0 24 24"
                          width="13"
                          height="13"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        Active
                      </>
                    ) : (
                      <>
                        <svg
                          viewBox="0 0 24 24"
                          width="13"
                          height="13"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                        Inactive
                      </>
                    )}
                  </span>
                </div>
              </div>

              {/* Panoramic Capture Button */}
              <div className="mt-6">
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

            {/* Autonomous Log */}
            <div
              className="glass-card p-6 flex flex-col"
              style={{ minHeight: "320px" }}
            >
              <h2 className="text-base font-semibold text-white mb-4 glow-heading">
                Autonomous Log
              </h2>
              <div
                ref={logContainerRef}
                className="flex-1 bg-[#0a0e24] text-gray-100 rounded-xl p-3 overflow-y-auto text-xs font-mono log-scrollbar border border-cyan-500/10"
                style={{ height: "240px" }}
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
          MediRunner Robot Interface —{" "}
          {currentMode === "auto" ? "Autonomous Mode" : "Manual Mode"}
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
