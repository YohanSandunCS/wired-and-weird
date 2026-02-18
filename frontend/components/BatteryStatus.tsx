"use client";

interface BatteryStatusProps {
  battery?: number;
  lastUpdate?: number;
  size?: "sm" | "md" | "lg";
  showPercentage?: boolean;
}

export default function BatteryStatus({
  battery,
  lastUpdate,
  size = "md",
  showPercentage = true,
}: BatteryStatusProps) {
  if (battery === undefined) {
    return (
      <div
        className={`inline-flex items-center space-x-1 ${
          size === "sm" ? "text-xs" : size === "lg" ? "text-base" : "text-sm"
        }`}
      >
        <div
          className={`${
            size === "sm" ? "w-4 h-2" : size === "lg" ? "w-8 h-4" : "w-6 h-3"
          } border border-gray-600 rounded-sm bg-gray-800 relative`}
        >
          <div
            className={`${
              size === "sm"
                ? "w-0.5 h-1"
                : size === "lg"
                  ? "w-1 h-2"
                  : "w-0.5 h-1.5"
            } bg-gray-600 absolute -right-0.5 top-1/2 transform -translate-y-1/2 rounded-r-sm`}
          />
        </div>
        <span className="text-gray-500">--</span>
      </div>
    );
  }

  // Determine battery color based on level
  const getBatteryColor = (level: number) => {
    if (level <= 15) return "bg-red-500";
    if (level <= 30) return "bg-orange-500";
    if (level <= 50) return "bg-yellow-500";
    return "bg-green-500";
  };

  const getBatteryTextColor = (level: number) => {
    if (level <= 15) return "text-red-400";
    if (level <= 30) return "text-orange-400";
    if (level <= 50) return "text-yellow-400";
    return "text-green-400";
  };

  const batteryColor = getBatteryColor(battery);
  const textColor = getBatteryTextColor(battery);
  const batteryWidth = Math.max(2, (battery / 100) * 100); // Ensure minimum 2% width for visibility

  // Check if data is stale (older than 1 minute)
  const isStale = lastUpdate && Date.now() - lastUpdate > 60000;

  return (
    <div
      className={`inline-flex items-center space-x-2 ${
        size === "sm" ? "text-xs" : size === "lg" ? "text-base" : "text-sm"
      }`}
    >
      {/* Battery Icon */}
      <div
        className={`relative ${
          size === "sm" ? "w-4 h-2" : size === "lg" ? "w-8 h-4" : "w-6 h-3"
        } border-2 border-gray-500 rounded-sm bg-gray-800 ${isStale ? "opacity-50" : ""}`}
      >
        {/* Battery Fill */}
        <div
          className={`h-full ${batteryColor} rounded-sm transition-all duration-300`}
          style={{ width: `${batteryWidth}%` }}
        />
        {/* Battery Tip */}
        <div
          className={`${
            size === "sm"
              ? "w-0.5 h-1"
              : size === "lg"
                ? "w-1 h-2"
                : "w-0.5 h-1.5"
          } bg-gray-500 absolute -right-0.5 top-1/2 transform -translate-y-1/2 rounded-r-sm`}
        />
      </div>

      {/* Battery Percentage */}
      {showPercentage && (
        <span
          className={`font-medium ${textColor} ${isStale ? "opacity-50" : ""}`}
        >
          {battery}%
        </span>
      )}

      {/* Stale indicator */}
      {isStale && (
        <span className="text-gray-400 text-xs" title="Battery data is stale">
          ⚠
        </span>
      )}
    </div>
  );
}
