"use client";

import { useEffect, useState } from "react";
import useAppStore from "@/store/appStore";
import { useRobotSocket } from "@/hooks/useRobotSocket";
import RobotMedicalItemLoadUnload from "@/components/RobotMedicalItemLoadUnload";

export default function DebugPage() {
  const { teamSession, robots, activeRobotId, teamRobots } = useAppStore();
  const [wsUrl, setWsUrl] = useState("");
  const [isLoadMode, setIsLoadMode] = useState(true);

  const { isConnected, logs, connect, disconnect, ping, clearLogs } =
    useRobotSocket(activeRobotId);

  useEffect(() => {
    setWsUrl(process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:5000/ws");
  }, []);

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <h1 className="text-3xl font-bold glow-heading">
          Robot Connection Debug
        </h1>

        {/* Medical Item Panels (always visible) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="glass-card">
            <DebugLoadHeader
              isLoadMode={isLoadMode}
              onToggle={() => setIsLoadMode((prev) => !prev)}
            />
            <RobotMedicalItemLoadUnload isLoadMode={isLoadMode} />
          </div>
        </div>

        {/* Team Session Status */}
        <div className="glass-card">
          <h2 className="text-xl font-semibold mb-4 text-white">
            Team Session
          </h2>
          <div className="space-y-2 text-gray-300">
            <p>
              <span className="font-medium text-gray-200">Logged in:</span>{" "}
              {teamSession.loggedIn ? "Yes" : "No"}
            </p>
            <p>
              <span className="font-medium text-gray-200">Team Code:</span>{" "}
              <span className="text-cyan-400">
                {teamSession.teamCode || "None"}
              </span>
            </p>
          </div>
        </div>

        {/* WebSocket Configuration */}
        <div className="glass-card">
          <h2 className="text-xl font-semibold mb-4 text-white">
            WebSocket Configuration
          </h2>
          <div className="space-y-2 text-gray-300">
            <p>
              <span className="font-medium text-gray-200">WebSocket URL:</span>{" "}
              <code className="text-cyan-400 text-sm">{wsUrl}</code>
            </p>
            <p>
              <span className="font-medium text-gray-200">
                Connection Status:
              </span>
              <span
                className={`ml-2 px-2 py-1 rounded-lg text-sm ${
                  isConnected
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "bg-red-500/20 text-red-400"
                }`}
              >
                {isConnected ? "Connected" : "Disconnected"}
              </span>
            </p>
          </div>
        </div>

        {/* Robot Status */}
        <div className="glass-card">
          <h2 className="text-xl font-semibold mb-4 text-white">
            Robot Status
          </h2>
          <div className="space-y-4 text-gray-300">
            <p>
              <span className="font-medium text-gray-200">
                Active Robot ID:
              </span>{" "}
              <span className="text-cyan-400">
                {activeRobotId || "None selected"}
              </span>
            </p>
            <p>
              <span className="font-medium text-gray-200">Total Robots:</span>{" "}
              {robots.length}
            </p>

            {robots.length > 0 && (
              <div>
                <h3 className="font-medium mb-2 text-gray-200">
                  Enrolled Robots:
                </h3>
                <div className="space-y-2">
                  {robots.map((robot) => (
                    <div
                      key={robot.robotId}
                      className="flex items-center space-x-4 p-3 border border-cyan-500/20 rounded-xl bg-white/5"
                    >
                      <div className="flex-1">
                        <p className="font-medium text-white">
                          {robot.name || "Unnamed Robot"}
                        </p>
                        <p className="text-sm text-gray-400">
                          ID: {robot.robotId}
                        </p>
                      </div>
                      <div className="text-right">
                        <span
                          className={`px-2 py-1 rounded-lg text-sm ${
                            robot.isOnline
                              ? "bg-emerald-500/20 text-emerald-400"
                              : "bg-gray-700/50 text-gray-400"
                          }`}
                        >
                          {robot.isOnline ? "Online" : "Offline"}
                        </span>
                        {robot.battery !== undefined && (
                          <p className="text-sm text-gray-400 mt-1">
                            Battery: {robot.battery}%
                          </p>
                        )}
                      </div>
                      {robot.robotId === activeRobotId && (
                        <span className="px-2 py-1 bg-cyan-500/20 text-cyan-400 text-sm rounded-lg">
                          Active
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* All Team Data (for debugging) */}
        <div className="glass-card">
          <h2 className="text-xl font-semibold mb-4 text-white">
            All Team Data (Debug)
          </h2>
          <pre className="bg-[#0a0e24] p-4 rounded-xl text-sm overflow-auto border border-cyan-500/10 text-cyan-300">
            {JSON.stringify(teamRobots, null, 2)}
          </pre>
        </div>

        {/* Connection Actions */}
        {activeRobotId && (
          <div className="glass-card">
            <h2 className="text-xl font-semibold mb-4 text-white">
              Connection Actions
            </h2>
            <div className="flex space-x-4 mb-4">
              <button
                onClick={connect}
                disabled={isConnected}
                className="neon-btn disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Connect
              </button>
              <button
                onClick={disconnect}
                disabled={!isConnected}
                className="neon-btn-danger disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Disconnect
              </button>
              <button
                onClick={ping}
                disabled={!isConnected}
                className="neon-btn-success disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Ping Robot
              </button>
              <button onClick={clearLogs} className="neon-btn-outline">
                Clear Logs
              </button>
            </div>
          </div>
        )}

        {/* Connection Logs */}
        <div className="glass-card">
          <h2 className="text-xl font-semibold mb-4 text-white">
            Connection Logs
          </h2>
          <div className="bg-[#0a0e24] text-green-400 p-4 rounded-xl font-mono text-sm h-64 overflow-y-auto border border-cyan-500/10">
            {logs.length === 0 ? (
              <p className="text-gray-500">No logs yet...</p>
            ) : (
              logs.map((log) => (
                <div key={log.id} className="mb-1">
                  <span className="text-gray-500">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                  <span
                    className={`ml-2 ${
                      log.type === "error"
                        ? "text-red-400"
                        : log.type === "success"
                          ? "text-green-400"
                          : "text-cyan-400"
                    }`}
                  >
                    [{log.type.toUpperCase()}]
                  </span>
                  <span className="ml-2">{log.message}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function DebugLoadHeader({
  isLoadMode,
  onToggle,
}: {
  isLoadMode: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-start justify-between mb-4">
      <h2 className="text-lg font-medium text-white">
        {isLoadMode ? "Load Medical Items" : "Unload Medical Items"}
      </h2>
      <label
        className="inline-flex items-center gap-2 text-sm select-none"
        title="Toggle load/unload mode"
      >
        <span className="text-gray-400">Mode</span>
        <span
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isLoadMode ? "bg-cyan-500" : "bg-gray-600"}`}
        >
          <input
            type="checkbox"
            checked={isLoadMode}
            onChange={onToggle}
            className="absolute w-full h-full opacity-0 cursor-pointer"
            aria-label="Toggle load/unload mode"
          />
          <span
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${isLoadMode ? "translate-x-6" : "translate-x-1"}`}
          />
        </span>
      </label>
    </div>
  );
}
