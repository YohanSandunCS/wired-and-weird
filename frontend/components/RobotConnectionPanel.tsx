'use client'

import { useRouter } from 'next/navigation'
import useAppStore from '@/store/appStore'
import { useRobotSocket } from '@/hooks/useRobotSocket'
import BatteryStatus from './BatteryStatus'

export default function RobotConnectionPanel() {
  const router = useRouter()
  const { activeRobotId, robots } = useAppStore()
  const activeRobot = robots.find(robot => robot.robotId === activeRobotId)
  
  const {
    isConnected,
    logs,
    connect,
    disconnect,
    ping,
    clearLogs
  } = useRobotSocket(activeRobotId)

  const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:5000/ws'

  if (!activeRobotId || !activeRobot) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>No robot selected.</p>
        <p className="text-sm mt-1">Select a robot from the list to manage its connection.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Robot Info */}
      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="text-sm font-medium text-gray-900 mb-2">
          Selected Robot
        </h3>
        <div className="space-y-1 text-sm text-gray-600">
          <div>
            <span className="font-medium">Name:</span> {activeRobot.name || 'No name'}
          </div>
          <div>
            <span className="font-medium">ID:</span> {activeRobot.robotId}
          </div>
          <div>
            <span className="font-medium">Status:</span>
            <span className={`ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
              activeRobot.isOnline 
                ? 'bg-green-100 text-green-800' 
                : 'bg-gray-100 text-gray-800'
            }`}>
              {activeRobot.isOnline ? 'Online' : 'Offline'}
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
            <span className="font-medium">WebSocket URL:</span>
            <code className="ml-1 text-xs bg-white px-1 py-0.5 rounded border">
              {wsUrl}?robotId={activeRobot.robotId}
            </code>
          </div>
        </div>
      </div>

      {/* Connection Controls */}
      <div className="space-y-3">
        <div className="flex space-x-3">
          {!isConnected ? (
            <button
              onClick={connect}
              className="flex-1 inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
            >
              Connect
            </button>
          ) : (
            <button
              onClick={disconnect}
              className="flex-1 inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
            >
              Disconnect
            </button>
          )}
          
          <button
            onClick={ping}
            disabled={!isConnected}
            className="flex-1 inline-flex justify-center items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Ping Robot
          </button>
        </div>

        {/* Control Robot Button */}
        {isConnected && activeRobot?.isOnline && (
          <button
            onClick={() => router.push(`/console/control?robotId=${activeRobotId}`)}
            className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            🎮 Control Robot
          </button>
        )}

        {/* Connection Status Indicators */}
        <div className="space-y-2">
          {/* WebSocket Connection Status */}
          <div className="flex items-center justify-center">
            <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm ${
              isConnected 
                ? 'bg-blue-100 text-blue-800' 
                : 'bg-gray-100 text-gray-800'
            }`}>
              <div className={`w-2 h-2 rounded-full ${
                isConnected ? 'bg-blue-500' : 'bg-gray-400'
              }`}></div>
              <span>WebSocket: {isConnected ? 'Connected' : 'Disconnected'}</span>
            </div>
          </div>
          
          {/* Robot Status */}
          <div className="flex items-center justify-center">
            <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm ${
              activeRobot?.isOnline 
                ? 'bg-green-100 text-green-800' 
                : 'bg-red-100 text-red-800'
            }`}>
              <div className={`w-2 h-2 rounded-full ${
                activeRobot?.isOnline ? 'bg-green-500' : 'bg-red-500'
              }`}></div>
              <span>Robot: {activeRobot?.isOnline ? 'Online' : 'Offline'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Logs Panel */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-900">Connection Logs</h3>
          {logs.length > 0 && (
            <button
              onClick={clearLogs}
              className="text-xs text-gray-500 hover:text-gray-700"
            >
              Clear
            </button>
          )}
        </div>
        
        <div className="bg-gray-900 text-gray-100 rounded-md p-3 h-64 overflow-y-auto text-xs font-mono">
          {logs.length === 0 ? (
            <div className="text-gray-400 italic">No logs yet...</div>
          ) : (
            <div className="space-y-1">
              {logs.map((log) => (
                <div key={log.id} className="flex">
                  <span className="text-gray-400 w-20 flex-shrink-0">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                  <span className={`flex-1 ${
                    log.type === 'error' ? 'text-red-400' :
                    log.type === 'success' ? 'text-green-400' :
                    'text-gray-100'
                  }`}>
                    {log.message}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}