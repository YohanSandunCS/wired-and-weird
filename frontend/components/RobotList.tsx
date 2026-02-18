"use client";

import { useState } from "react";
import useAppStore from "@/store/appStore";
import BatteryStatus from "./BatteryStatus";

export default function RobotList() {
  const { robots, activeRobotId, setActiveRobot, clearAllRobots } =
    useAppStore();
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  if (robots.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        <p>No robots registered yet.</p>
        <p className="text-sm mt-1">
          Use the form above to add your first robot.
        </p>
      </div>
    );
  }

  const handleClearAllRobots = () => {
    clearAllRobots();
    setShowConfirmDelete(false);
  };

  const handleSelectRobot = (robotId: string) => {
    setActiveRobot(robotId);
  };

  const handleDeselectRobot = () => {
    setActiveRobot(null);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {robots.map((robot) => (
          <div
            key={robot.robotId}
            className={`border rounded-xl p-4 transition-colors ${
              robot.robotId === activeRobotId
                ? "border-cyan-500 bg-cyan-500/10"
                : "border-cyan-500/10 bg-white/5"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  <h3 className="text-sm font-medium text-white">
                    {robot.name || robot.robotId}
                  </h3>
                  {robot.name && (
                    <span className="text-xs text-gray-400">
                      ({robot.robotId})
                    </span>
                  )}
                </div>
                <div className="mt-1 flex items-center space-x-2">
                  <div
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      robot.isOnline
                        ? "bg-emerald-500/20 text-emerald-400"
                        : "bg-gray-700/50 text-gray-400"
                    }`}
                  >
                    {robot.isOnline ? "Online" : "Offline"}
                  </div>
                  <BatteryStatus
                    battery={robot.battery}
                    lastUpdate={robot.lastTelemetryUpdate}
                    size="sm"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                {robot.robotId === activeRobotId ? (
                  <div className="flex items-center space-x-2">
                    <span className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium bg-cyan-500/20 text-cyan-400">
                      ✓ Active
                    </span>
                    <button
                      onClick={handleDeselectRobot}
                      className="inline-flex items-center px-2 py-1 border border-cyan-500/20 text-xs font-medium rounded-lg text-gray-400 bg-white/5 hover:bg-white/10 focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-cyan-500 transition-colors"
                      title="Deselect robot"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => handleSelectRobot(robot.robotId)}
                    className="inline-flex items-center px-3 py-1.5 border border-cyan-500/20 text-xs font-medium rounded-lg text-cyan-400 bg-white/5 hover:bg-cyan-500/10 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500 transition-colors"
                  >
                    Select
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Clear All Robots Button */}
      {robots.length > 0 && (
        <div className="pt-4 border-t border-cyan-500/10">
          {!showConfirmDelete ? (
            <button
              onClick={() => setShowConfirmDelete(true)}
              className="w-full inline-flex justify-center items-center px-3 py-2 border border-red-500/30 text-sm font-medium rounded-xl text-red-400 bg-red-500/5 hover:bg-red-500/10 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
            >
              Clear All Robots
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-gray-400 text-center">
                Are you sure? This will remove all registered robots.
              </p>
              <div className="flex space-x-2">
                <button
                  onClick={handleClearAllRobots}
                  className="flex-1 neon-btn-danger"
                >
                  Yes, Clear All
                </button>
                <button
                  onClick={() => setShowConfirmDelete(false)}
                  className="flex-1 neon-btn-outline"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
