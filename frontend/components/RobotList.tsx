'use client'

import { useState } from 'react'
import useAppStore from '@/store/appStore'
import BatteryStatus from './BatteryStatus'

export default function RobotList() {
  const { robots, activeRobotId, setActiveRobot, clearAllRobots } = useAppStore()
  const [showConfirmDelete, setShowConfirmDelete] = useState(false)

  if (robots.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>No robots registered yet.</p>
        <p className="text-sm mt-1">Use the form above to add your first robot.</p>
      </div>
    )
  }

  const handleClearAllRobots = () => {
    clearAllRobots()
    setShowConfirmDelete(false)
  }

  const handleSelectRobot = (robotId: string) => {
    setActiveRobot(robotId)
  }

  const handleDeselectRobot = () => {
    setActiveRobot(null)
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {robots.map((robot) => (
          <div
            key={robot.robotId}
            className={`border rounded-lg p-4 transition-colors ${
              robot.robotId === activeRobotId
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 bg-white'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center space-x-2">
                  <h3 className="text-sm font-medium text-gray-900">
                    {robot.name || robot.robotId}
                  </h3>
                  {robot.name && (
                    <span className="text-xs text-gray-500">({robot.robotId})</span>
                  )}
                </div>
                <div className="mt-1 flex items-center space-x-2">
                  <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    robot.isOnline 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {robot.isOnline ? 'Online' : 'Offline'}
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
                    <span className="inline-flex items-center px-3 py-1.5 rounded-md text-xs font-medium bg-blue-100 text-blue-800">
                      ✓ Active
                    </span>
                    <button
                      onClick={handleDeselectRobot}
                      className="inline-flex items-center px-2 py-1 border border-gray-300 shadow-sm text-xs font-medium rounded text-gray-500 bg-white hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-blue-500"
                      title="Deselect robot"
                    >
                      ✕
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => handleSelectRobot(robot.robotId)}
                    className="inline-flex items-center px-3 py-1.5 border border-gray-300 shadow-sm text-xs font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
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
        <div className="pt-4 border-t border-gray-200">
          {!showConfirmDelete ? (
            <button
              onClick={() => setShowConfirmDelete(true)}
              className="w-full inline-flex justify-center items-center px-3 py-2 border border-red-300 text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              Clear All Robots
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-gray-600 text-center">
                Are you sure? This will remove all registered robots.
              </p>
              <div className="flex space-x-2">
                <button
                  onClick={handleClearAllRobots}
                  className="flex-1 inline-flex justify-center items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  Yes, Clear All
                </button>
                <button
                  onClick={() => setShowConfirmDelete(false)}
                  className="flex-1 inline-flex justify-center items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}