"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import useAppStore from "@/store/appStore";
import RobotEnrollmentForm from "@/components/RobotEnrollmentForm";
import RobotList from "@/components/RobotList";
import RobotConnectionPanel from "@/components/RobotConnectionPanel";
import BatteryStatus from "@/components/BatteryStatus";
import RobotMedicalItemLoadUnload from "@/components/RobotMedicalItemLoadUnload";

export default function ConsolePage() {
  const router = useRouter();
  const { teamSession, logout, activeRobotId, robots, isAuthenticated } =
    useAppStore();
  const [isLoadMode, setIsLoadMode] = useState(true);
  const [isRobotBusy, setIsRobotBusy] = useState(false);

  const handleToggle = () => {
    if (isRobotBusy) {
      alert(
        isLoadMode
          ? "Samples are being loaded. Please stop loading first."
          : "Samples are being unloaded. Please stop unloading first.",
      );
      return;
    }
    setIsLoadMode((prev) => !prev);
  };

  // Redirect if not authenticated or not logged in
  useEffect(() => {
    if (!isAuthenticated) {
      router.push("/face-login");
    } else if (!teamSession.loggedIn) {
      router.push("/");
    }
  }, [isAuthenticated, teamSession.loggedIn, router]);

  const handleLogout = () => {
    logout();
    router.push("/");
  };

  if (!isAuthenticated || !teamSession.loggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center relative z-10">
        <div className="text-gray-400">Loading...</div>
      </div>
    );
  }

  const activeRobot = robots.find((robot) => robot.robotId === activeRobotId);

  return (
    <div className="min-h-screen relative z-10">
      {/* Top Navigation Bar */}
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
            {/* Left: title */}
            <div className="flex items-center gap-5">
              <div>
                <h1 className="text-2xl font-bold text-white tracking-wide glow-heading leading-tight">
                  Medi Runner Console
                </h1>
                <p className="text-xs text-cyan-400/70 mt-0.5 tracking-widest uppercase">
                  Hospital Delivery Robot — Control Center
                </p>
              </div>
            </div>

            {/* Right: active robot status + team + logout */}
            <div className="flex items-center gap-3">
              {activeRobot && (
                <>
                  <div
                    className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border tracking-wide ${
                      activeRobot.isOnline
                        ? "bg-emerald-500/10 border-emerald-400/40 text-emerald-300"
                        : "bg-red-500/10 border-red-400/40 text-red-300"
                    }`}
                  >
                    <div
                      className={`w-2 h-2 rounded-full ${activeRobot.isOnline ? "bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.9)]" : "bg-red-400 shadow-[0_0_6px_rgba(239,68,68,0.9)]"}`}
                    />
                    Robot: {activeRobot.isOnline ? "Online" : "Offline"}
                  </div>
                  <div className="w-px h-6 bg-cyan-500/25" />
                  <div className="text-right">
                    <p className="text-sm font-semibold text-white leading-tight">
                      {activeRobot.name || activeRobot.robotId}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Unit ID: {activeRobot.robotId}
                    </p>
                  </div>
                  <BatteryStatus
                    battery={activeRobot.battery}
                    lastUpdate={activeRobot.lastTelemetryUpdate}
                    size="sm"
                  />
                  <div className="w-px h-6 bg-cyan-500/25" />
                </>
              )}
              <span className="text-sm text-gray-400">
                Team:{" "}
                <span className="font-medium text-cyan-400">
                  {teamSession.teamCode}
                </span>
              </span>
              <button
                onClick={handleLogout}
                className="neon-btn-danger text-sm px-3 py-2"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column: Robot Enrollment & List */}
          <div className="space-y-6">
            <div className="glass-card p-6">
              <h2 className="text-lg font-medium text-white mb-4 glow-heading">
                Robot Enrollment
              </h2>
              <RobotEnrollmentForm />
            </div>

            <div className="glass-card p-6">
              <h2 className="text-lg font-medium text-white mb-4 glow-heading">
                Registered Robots
              </h2>
              <RobotList />
            </div>
          </div>

          {/* Right Column: Connection Panel */}
          <div className="space-y-6">
            <div className="glass-card p-6">
              <h2 className="text-lg font-medium text-white mb-4 glow-heading">
                Robot Connection
              </h2>
              <RobotConnectionPanel />
            </div>
          </div>
        </div>

        {/* Medical Item Panels: Full-width below. TODO: JUST REMOVE THE DISPLAY_NONE WHEN NECESSARY */}
        <div className="mt-6" style={{ display: "none" }}>
          <div className="glass-card p-6">
            <ConsoleLoadHeader
              isLoadMode={isLoadMode}
              onToggle={handleToggle}
            />
            <RobotMedicalItemLoadUnload
              isLoadMode={isLoadMode}
              onBusyChange={setIsRobotBusy}
            />
          </div>
        </div>
      </main>
    </div>
  );
}

function ConsoleLoadHeader({
  isLoadMode,
  onToggle,
}: {
  isLoadMode: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex justify-center mb-6">
      <div className="glass-card-light p-1 inline-flex items-center h-[48px]">
        <button
          onClick={() => !isLoadMode && onToggle()}
          className={`px-6 h-full rounded-xl font-medium transition-all duration-200 flex items-center ${
            isLoadMode
              ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[16px]"
              : "text-gray-500 hover:text-gray-300 text-sm"
          }`}
        >
          Load Medical Items
        </button>
        <button
          onClick={() => isLoadMode && onToggle()}
          className={`px-6 h-full rounded-xl font-medium transition-all duration-200 flex items-center ${
            !isLoadMode
              ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[16px]"
              : "text-gray-500 hover:text-gray-300 text-sm"
          }`}
        >
          Unload Medical Items
        </button>
      </div>
    </div>
  );
}
