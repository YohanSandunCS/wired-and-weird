"use client";

import { useRouter, usePathname } from "next/navigation";
import useAppStore from "@/store/appStore";
import { useRobotSocket } from "@/hooks/useRobotSocket";
import BatteryStatus from "./BatteryStatus";

export default function RobotConnectionPanel() {
  const router = useRouter();
  const pathname = usePathname();
  const { activeRobotId, robots, wsConnected } = useAppStore();
  const activeRobot = robots.find((robot) => robot.robotId === activeRobotId);

  const {
    isConnected: localIsConnected,
    logs,
    connect,
    disconnect,
    ping,
    clearLogs,
  } = useRobotSocket(activeRobotId);

  // Use global wsConnected state as source of truth
  const isConnected = wsConnected || localIsConnected;

  const wsUrl = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:5000/ws";

  if (!activeRobotId || !activeRobot) {
    return (
      <div className="text-center py-8 text-gray-400">
        <p>No robot selected.</p>
        <p className="text-sm mt-1">
          Select a robot from the list to manage its connection.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Robot Info */}
      <div className="glass-card-light rounded-xl p-4">
        <h3 className="text-sm font-medium text-white mb-2">Selected Robot</h3>
        <div className="space-y-1 text-sm text-gray-400">
          <div>
            <span className="font-medium text-gray-300">Name:</span>{" "}
            {activeRobot.name || "No name"}
          </div>
          <div>
            <span className="font-medium text-gray-300">ID:</span>{" "}
            <span className="text-cyan-400">{activeRobot.robotId}</span>
          </div>
          <div>
            <span className="font-medium text-gray-300">Status:</span>
            <span
              className={`ml-2 inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-medium ${
                activeRobot.isOnline
                  ? "bg-emerald-500/20 text-emerald-400"
                  : "bg-gray-700/50 text-gray-400"
              }`}
            >
              {activeRobot.isOnline ? "Online" : "Offline"}
            </span>
          </div>
          <div className="flex items-center">
            <span className="font-medium">Battery:</span>
            <div className="ml-2">
              <BatteryStatus
                battery={activeRobot.battery}
                lastUpdate={activeRobot.lastTelemetryUpdate}
                size="sm"
              />
            </div>
          </div>
          <div>
            <span className="font-medium text-gray-300">WebSocket URL:</span>
            <code className="ml-1 text-xs bg-[#0a0e24] text-cyan-400 px-1 py-0.5 rounded border border-cyan-500/20">
              {wsUrl}?robotId={activeRobot.robotId}
            </code>
          </div>
        </div>
      </div>

      {/* Connection Controls */}
      <div className="space-y-3">
        <div className="flex space-x-3">
          {!isConnected ? (
            <button onClick={connect} className="flex-1 neon-btn-success">
              Connect
            </button>
          ) : (
            <button onClick={disconnect} className="flex-1 neon-btn-danger">
              Disconnect
            </button>
          )}

          <button
            onClick={ping}
            disabled={!isConnected}
            className="flex-1 neon-btn-outline disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Ping Robot
          </button>
        </div>

        {/* Mode Toggle */}
        {isConnected && (
          <div
            className="rounded-2xl p-4 border-2 border-cyan-400/40"
            style={{
              background:
                "linear-gradient(135deg, rgba(0,229,255,0.07) 0%, rgba(10,14,36,0.9) 60%, rgba(168,85,247,0.07) 100%)",
              boxShadow:
                "0 0 28px rgba(0,229,255,0.15), 0 0 0 1px rgba(0,229,255,0.08), inset 0 0 20px rgba(0,229,255,0.04)",
            }}
          >
            <div className="flex items-center justify-center gap-2 mb-4">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-cyan-400/40 to-cyan-400/60" />
              <span
                className="text-xs font-black tracking-[0.25em] uppercase px-2"
                style={{
                  color: "rgba(0,229,255,0.95)",
                  textShadow:
                    "0 0 10px rgba(0,229,255,0.7), 0 0 20px rgba(0,229,255,0.3)",
                }}
              >
                Select Mode
              </span>
              <div className="h-px flex-1 bg-gradient-to-l from-transparent via-cyan-400/40 to-cyan-400/60" />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() =>
                  router.push(`/console/control?robotId=${activeRobotId}`)
                }
                className={`flex-1 flex flex-col items-center gap-2 px-3 py-4 rounded-xl text-sm font-bold border-2 transition-all duration-150 ${
                  pathname?.includes("/console/control")
                    ? "border-cyan-400/80 text-cyan-200"
                    : "border-cyan-500/25 text-gray-500 hover:border-cyan-400/50 hover:text-cyan-300"
                }`}
                style={
                  pathname?.includes("/console/control")
                    ? {
                        background: "rgba(0,229,255,0.12)",
                        boxShadow:
                          "0 0 20px rgba(0,229,255,0.3), inset 0 0 14px rgba(0,229,255,0.08)",
                      }
                    : { background: "rgba(0,229,255,0.03)" }
                }
              >
                <svg
                  viewBox="0 0 24 24"
                  width="24"
                  height="24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={
                    pathname?.includes("/console/control")
                      ? { filter: "drop-shadow(0 0 6px rgba(0,229,255,0.8))" }
                      : {}
                  }
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
              </button>
              <button
                onClick={() =>
                  router.push(`/console/auto?robotId=${activeRobotId}`)
                }
                className={`flex-1 flex flex-col items-center gap-2 px-3 py-4 rounded-xl text-sm font-bold border-2 transition-all duration-150 ${
                  pathname?.includes("/console/auto")
                    ? "border-purple-400/80 text-purple-200"
                    : "border-purple-500/25 text-gray-500 hover:border-purple-400/50 hover:text-purple-300"
                }`}
                style={
                  pathname?.includes("/console/auto")
                    ? {
                        background: "rgba(168,85,247,0.12)",
                        boxShadow:
                          "0 0 20px rgba(168,85,247,0.3), inset 0 0 14px rgba(168,85,247,0.08)",
                      }
                    : { background: "rgba(168,85,247,0.03)" }
                }
              >
                <svg
                  viewBox="0 0 24 24"
                  width="24"
                  height="24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={
                    pathname?.includes("/console/auto")
                      ? { filter: "drop-shadow(0 0 6px rgba(168,85,247,0.8))" }
                      : {}
                  }
                >
                  <circle cx="12" cy="12" r="3" />
                  <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
                </svg>
                Auto
              </button>
            </div>
          </div>
        )}

        {/* Connection Status Indicators */}
        <div className="space-y-2">
          {/* WebSocket Connection Status */}
          <div className="flex items-center justify-center">
            <div
              className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm ${
                isConnected
                  ? "bg-cyan-500/20 text-cyan-400"
                  : "bg-gray-700/50 text-gray-400"
              }`}
            >
              <div
                className={`w-2 h-2 rounded-full ${
                  isConnected ? "bg-cyan-500" : "bg-gray-500"
                }`}
              ></div>
              <span>
                WebSocket: {isConnected ? "Connected" : "Disconnected"}
              </span>
            </div>
          </div>

          {/* Robot Status */}
          <div className="flex items-center justify-center">
            <div
              className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm ${
                activeRobot?.isOnline
                  ? "bg-emerald-500/20 text-emerald-400"
                  : "bg-red-500/20 text-red-400"
              }`}
            >
              <div
                className={`w-2 h-2 rounded-full ${
                  activeRobot?.isOnline ? "bg-emerald-500" : "bg-red-500"
                }`}
              ></div>
              <span>Robot: {activeRobot?.isOnline ? "Online" : "Offline"}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Logs Panel */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-white">Connection Logs</h3>
          {logs.length > 0 && (
            <button
              onClick={clearLogs}
              className="text-xs text-gray-400 hover:text-cyan-400 transition-colors"
            >
              Clear
            </button>
          )}
        </div>

        <div className="bg-[#0a0e24] text-gray-100 rounded-xl p-3 h-64 overflow-y-auto text-xs font-mono border border-cyan-500/10">
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
                    className={`flex-1 ${
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
  );
}
