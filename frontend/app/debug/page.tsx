'use client'

import { useEffect, useState } from 'react'
import useAppStore from '@/store/appStore'
import { useRobotSocket } from '@/hooks/useRobotSocket'
import RobotMedicalItemLoadUnload from '@/components/RobotMedicalItemLoadUnload'

export default function DebugPage() {
  const { teamSession, robots, activeRobotId, teamRobots } = useAppStore()
  const [wsUrl, setWsUrl] = useState('')
  const [isLoadMode, setIsLoadMode] = useState(true)
  
  const {
    isConnected,
    logs,
    connect,
    disconnect,
    ping,
    clearLogs
  } = useRobotSocket(activeRobotId)

  useEffect(() => {
    setWsUrl(process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:5000/ws')
  }, [])

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <h1 className="text-3xl font-bold text-gray-900">Robot Connection Debug</h1>
        
        {/* Medical Item Panels (always visible) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <DebugLoadHeader isLoadMode={isLoadMode} onToggle={() => setIsLoadMode(prev => !prev)} />
            <RobotMedicalItemLoadUnload isLoadMode={isLoadMode} />
          </div>
        </div>

        {/* Team Session Status */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Team Session</h2>
          <div className="space-y-2">
            <p><span className="font-medium">Logged in:</span> {teamSession.loggedIn ? 'Yes' : 'No'}</p>
            <p><span className="font-medium">Team Code:</span> {teamSession.teamCode || 'None'}</p>
          </div>
        </div>

        {/* WebSocket Configuration */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">WebSocket Configuration</h2>
          <div className="space-y-2">
            <p><span className="font-medium">WebSocket URL:</span> {wsUrl}</p>
            <p><span className="font-medium">Connection Status:</span> 
              <span className={`ml-2 px-2 py-1 rounded text-sm ${
                isConnected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </p>
          </div>
        </div>

        {/* Robot Status */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Robot Status</h2>
          <div className="space-y-4">
            <p><span className="font-medium">Active Robot ID:</span> {activeRobotId || 'None selected'}</p>
            <p><span className="font-medium">Total Robots:</span> {robots.length}</p>
            
            {robots.length > 0 && (
              <div>
                <h3 className="font-medium mb-2">Enrolled Robots:</h3>
                <div className="space-y-2">
                  {robots.map((robot) => (
                    <div key={robot.robotId} className="flex items-center space-x-4 p-3 border border-gray-200 rounded">
                      <div className="flex-1">
                        <p className="font-medium">{robot.name || 'Unnamed Robot'}</p>
                        <p className="text-sm text-gray-600">ID: {robot.robotId}</p>
                      </div>
                      <div className="text-right">
                        <span className={`px-2 py-1 rounded text-sm ${
                          robot.isOnline ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {robot.isOnline ? 'Online' : 'Offline'}
                        </span>
                        {robot.battery !== undefined && (
                          <p className="text-sm text-gray-600 mt-1">Battery: {robot.battery}%</p>
                        )}
                      </div>
                      {robot.robotId === activeRobotId && (
                        <span className="px-2 py-1 bg-blue-100 text-blue-800 text-sm rounded">Active</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* All Team Data (for debugging) */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">All Team Data (Debug)</h2>
          <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
            {JSON.stringify(teamRobots, null, 2)}
          </pre>
        </div>

        {/* Connection Actions */}
        {activeRobotId && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Connection Actions</h2>
            <div className="flex space-x-4 mb-4">
              <button
                onClick={connect}
                disabled={isConnected}
                className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Connect
              </button>
              <button
                onClick={disconnect}
                disabled={!isConnected}
                className="px-4 py-2 bg-red-600 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Disconnect
              </button>
              <button
                onClick={ping}
                disabled={!isConnected}
                className="px-4 py-2 bg-green-600 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Ping Robot
              </button>
              <button
                onClick={clearLogs}
                className="px-4 py-2 bg-gray-600 text-white rounded"
              >
                Clear Logs
              </button>
            </div>
          </div>
        )}

        {/* Connection Logs */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Connection Logs</h2>
          <div className="bg-black text-green-400 p-4 rounded font-mono text-sm h-64 overflow-y-auto">
            {logs.length === 0 ? (
              <p className="text-gray-500">No logs yet...</p>
            ) : (
              logs.map((log) => (
                <div key={log.id} className="mb-1">
                  <span className="text-gray-500">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                  <span className={`ml-2 ${
                    log.type === 'error' ? 'text-red-400' :
                    log.type === 'success' ? 'text-green-400' :
                    'text-blue-400'
                  }`}>
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
  )
}

function DebugLoadHeader({ isLoadMode, onToggle }: { isLoadMode: boolean; onToggle: () => void }) {
  return (
    <div className="flex items-start justify-between mb-4">
      <h2 className="text-lg font-medium text-gray-900">
        {isLoadMode ? 'Load Medical Items' : 'Unload Medical Items'}
      </h2>
      <label className="inline-flex items-center gap-2 text-sm select-none" title="Toggle load/unload mode">
        <span className="text-gray-600">Mode</span>
        <span className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${isLoadMode ? 'bg-blue-600' : 'bg-gray-300'}`}>
          <input
            type="checkbox"
            checked={isLoadMode}
            onChange={onToggle}
            className="absolute w-full h-full opacity-0 cursor-pointer"
            aria-label="Toggle load/unload mode"
          />
          <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${isLoadMode ? 'translate-x-6' : 'translate-x-1'}`} />
        </span>
        
      </label>
    </div>
  )
}