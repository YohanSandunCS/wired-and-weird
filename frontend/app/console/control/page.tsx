'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import useAppStore from '@/store/appStore'
import { useRobotSocket } from '@/hooks/useRobotSocket'
import BatteryStatus from '@/components/BatteryStatus'

export default function RobotControlPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const robotId = searchParams.get('robotId')
  
  const { teamSession, robots, isAuthenticated } = useAppStore()
  const robot = robots.find(r => r.robotId === robotId)
  
  const [pressedKeys, setPressedKeys] = useState(new Set<string>())
  const [commandHistory, setCommandHistory] = useState<Array<{id: string, command: string, timestamp: number}>>([])
  const [streamStatus, setStreamStatus] = useState<'loading' | 'connected' | 'error'>('loading')
  const logContainerRef = useRef<HTMLDivElement>(null)
  const isMouseOnScrollbar = useRef(false)
  
  const {
    isConnected,
    logs,
    latestVisionFrame,
    connect,
    disconnect,
    send,
  } = useRobotSocket(robotId)

  // Redirect if not authenticated or not logged in or no robot
  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/face-login')
      return
    }
    if (!teamSession.loggedIn) {
      router.push('/')
      return
    }
    if (!robotId || !robot) {
      router.push('/console')
      return
    }
  }, [isAuthenticated, teamSession.loggedIn, robotId, robot, router])

  // Auto-connect when component mounts
  useEffect(() => {
    if (robotId && !isConnected) {
      connect()
    }
  }, [robotId, isConnected, connect])

  const sendMovementCommand = useCallback((direction: string) => {
    if (!isConnected || !robotId) return
    
    const command = {
      type: 'command',
      robotId,
      payload: {
        action: 'move',
        direction: direction
      },
      timestamp: Date.now()
    }
    
    send(command)
    
    // Add to command history
    const historyEntry = {
      id: Date.now().toString(),
      command: `Move ${direction}`,
      timestamp: Date.now()
    }
    setCommandHistory(prev => [...prev, historyEntry].slice(-20)) // Keep last 20 commands
  }, [isConnected, robotId, send])

  const sendStopCommand = useCallback(() => {
    if (!isConnected || !robotId) return
    
    const command = {
      type: 'command',
      robotId,
      payload: {
        action: 'stop'
      },
      timestamp: Date.now()
    }
    
    send(command)
    
    const historyEntry = {
      id: Date.now().toString(),
      command: 'Stop',
      timestamp: Date.now()
    }
    setCommandHistory(prev => [...prev, historyEntry].slice(-20))
  }, [isConnected, robotId, send])

  // Auto-scroll for logs
  useEffect(() => {
    const logContainer = logContainerRef.current
    if (logContainer && !isMouseOnScrollbar.current) {
      logContainer.scrollTop = logContainer.scrollHeight
    }
  }, [logs])

  // Handle keyboard events
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Prevent default behavior for arrow keys
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
        event.preventDefault()
      }

      if (pressedKeys.has(event.code)) return // Key already pressed

      const newPressedKeys = new Set(pressedKeys)
      newPressedKeys.add(event.code)
      setPressedKeys(newPressedKeys)

      switch (event.code) {
        case 'ArrowUp':
          sendMovementCommand('forward')
          break
        case 'ArrowDown':
          sendMovementCommand('backward')
          break
        case 'ArrowLeft':
          sendMovementCommand('left')
          break
        case 'ArrowRight':
          sendMovementCommand('right')
          break
        case 'Space':
          sendStopCommand()
          break
      }
    }

    const handleKeyUp = (event: KeyboardEvent) => {
      const newPressedKeys = new Set(pressedKeys)
      newPressedKeys.delete(event.code)
      setPressedKeys(newPressedKeys)

      // Send stop command when arrow key is released
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) {
        sendStopCommand()
      }
    }

    // Add focus to window to ensure we capture key events
    window.focus()
    
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [pressedKeys, sendMovementCommand, sendStopCommand])

  useEffect(() => {
    const logContainer = logContainerRef.current

    const handleMouseDown = () => {
      isMouseOnScrollbar.current = true
    }
    const handleMouseUp = () => {
      isMouseOnScrollbar.current = false
    }

    if (logContainer) {
      logContainer.addEventListener('mousedown', handleMouseDown)
      window.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      if (logContainer) {
        logContainer.removeEventListener('mousedown', handleMouseDown)
      }
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [])

  if (!teamSession.loggedIn || !robotId || !robot) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push('/console')}
                className="text-gray-600 hover:text-gray-900"
              >
                ← Back to Console
              </button>
              <h1 className="text-xl font-semibold text-gray-900">
                Robot Control Panel
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                {robot.name || robot.robotId}
              </span>
              <BatteryStatus 
                battery={robot.battery} 
                lastUpdate={robot.lastTelemetryUpdate}
                size="sm"
              />
              <div className={`flex items-center space-x-1 text-xs px-2 py-1 rounded-full border ${
                isConnected 
                  ? 'bg-green-50 border-green-200 text-green-700' 
                  : 'bg-red-50 border-red-200 text-red-700'
              }`}>
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className="font-medium">
                  WebSocket: {isConnected ? 'Connected' : 'Disconnected'}
                </span>
              </div>
              <div className={`flex items-center space-x-1 text-xs px-2 py-1 rounded-full border ${
                robot.isOnline
                  ? 'bg-green-50 border-green-200 text-green-700'
                  : 'bg-red-50 border-red-200 text-red-700'
              }`}>
                <div className={`w-2 h-2 rounded-full ${robot.isOnline ? 'bg-green-500' : 'bg-red-500'}`}></div>
                <span className="font-medium">
                  Robot: {robot.isOnline ? 'Online' : 'Offline'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-grow flex" style={{ width: '1216px', height: '792px' }}>
        <div className="flex flex-grow gap-8">
          {/* Main Content: Live Video Feed */}
          <div className="w-3/4 flex flex-col space-y-6">
            <div className="bg-white rounded-lg shadow-sm flex-grow flex flex-col p-0 overflow-hidden">
              <div className="relative flex-grow">
                {/* Video Feed */}
                <div className="absolute inset-0 bg-gray-100 flex items-center justify-center">
                  {!isConnected ? (
                    <div className="text-gray-500 text-center">
                      <div className="text-gray-400 mb-2 text-2xl">📹</div>
                      <div className="text-sm">Connect to view live feed</div>
                    </div>
                  ) : !latestVisionFrame ? (
                    <div className="text-gray-500 text-center">
                      <div className="text-gray-400 mb-2 text-2xl">⏳</div>
                      <div className="text-sm">Waiting for video stream...</div>
                    </div>
                  ) : (
                    <img
                      src={`data:${latestVisionFrame.payload.mime};base64,${latestVisionFrame.payload.data}`}
                      alt="Robot Camera Feed"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        console.error('Failed to load vision frame:', e)
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
                        {latestVisionFrame.payload.width}×{latestVisionFrame.payload.height} • 
                        {latestVisionFrame.payload.quality}% quality
                      </div>
                    )}
                  </div>

                  {/* Bottom Overlay */}
                  {latestVisionFrame && (
                    <div className="flex items-end">
                      <div className="bg-[#00000061] text-white text-xs px-2 py-1 rounded">
                        {new Date(latestVisionFrame.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              {latestVisionFrame && (
                <div className="p-6 bg-white border-t border-gray-200">
                  <div className="text-xs text-gray-500 space-y-2">
                    <div className="flex justify-between">
                      <span>Keyboard key mapping:</span>
                      <span className="font-mono">{latestVisionFrame.role}</span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2 text-sm pt-2">
                      <div className="flex items-center space-x-2">
                        <kbd className="px-2 py-1 text-xs font-bold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg">↑</kbd>
                        <span className="text-gray-800">Forward</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <kbd className="px-2 py-1 text-xs font-bold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg">↓</kbd>
                        <span className="text-gray-800">Backward</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <kbd className="px-2 py-1 text-xs font-bold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg">←</kbd>
                        <span className="text-gray-800">Turn Left</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <kbd className="px-2 py-1 text-xs font-bold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg">→</kbd>
                        <span className="text-gray-800">Turn Right</span>
                      </div>
                      <div className="flex items-center space-x-2 col-span-2">
                        <kbd className="px-2 py-1 text-xs font-bold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg">Space</kbd>
                        <span className="text-gray-800">Emergency Stop</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="w-1/4 flex flex-col space-y-6">
            {/* Input Visualizer */}
            <div className="bg-white rounded-lg p-6 shadow-sm">
              <h2 className="text-lg font-medium text-gray-900 mb-4">D-Pad</h2>
              <div className="grid grid-cols-3 gap-2 max-w-xs mx-auto">
                <div></div>
                <button
                  className={`p-4 rounded-md border-2 transition-colors ${
                    pressedKeys.has('ArrowUp') 
                      ? 'bg-blue-500 text-white border-blue-500' 
                      : 'bg-blue-500 text-white  hover:bg-blue-600 border-blue-500'
                  }`}
                  onClick={() => sendMovementCommand('forward')}
                  disabled={!isConnected || !robot.isOnline}
                >
                  🡑
                </button>
                <div></div>
                
                <button
                  className={`p-4 rounded-md border-2 transition-colors ${
                    pressedKeys.has('ArrowLeft') 
                      ? 'bg-blue-500 text-white border-blue-500' 
                      : 'bg-blue-500 text-white  hover:bg-blue-600 border-blue-500'
                  }`}
                  onClick={() => sendMovementCommand('left')}
                  disabled={!isConnected || !robot.isOnline}
                >
                  🡐
                </button>
                <button
                  className="p-4 rounded-md border-2 bg-red-500 text-white text-sm hover:bg-red-600 border-red-500"
                  onClick={sendStopCommand}
                  disabled={!isConnected}
                >
                  STOP
                </button>
                <button
                  className={`p-4 rounded-md border-2 transition-colors ${
                    pressedKeys.has('ArrowRight') 
                      ? 'bg-blue-500 text-white border-blue-500' 
                      : 'bg-blue-500 text-white  hover:bg-blue-600 border-blue-500'
                  }`}
                  onClick={() => sendMovementCommand('right')}
                  disabled={!isConnected || !robot.isOnline}
                >
                  🡒
                </button>
                
                <div></div>
                <button
                  className={`p-4 rounded-md border-2 transition-colors ${
                    pressedKeys.has('ArrowDown') 
                      ? 'bg-blue-500 text-white border-blue-500' 
                      : 'bg-blue-500 text-white  hover:bg-blue-600 border-blue-500'
                  }`}
                  onClick={() => sendMovementCommand('backward')}
                  disabled={!isConnected || !robot.isOnline}
                >
                  🡓
                </button>
                <div></div>
              </div>
            </div>

            {/* Filtered Logs / Diagnostics */}
            <div className="bg-gray-600 rounded-lg p-6 shadow-sm flex-grow relative">
              <h2 className="text-lg font-medium text-white mb-4">Control Log</h2>
              <div ref={logContainerRef} className="absolute left-3 right-3 bottom-3 bg-gray-600 text-gray-100 rounded-md p-3 overflow-y-auto text-xs font-mono log-scrollbar" style={{top: '4.75rem'}}>
                {logs.length === 0 ? (
                  <div className="text-gray-400 italic">No logs yet...</div>
                ) : (
                  <div className="space-y-1">
                    {logs.map((log) => (
                      <div key={log.id} className="flex">
                        <span className="text-gray-400 w-20 flex-shrink-0">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                        <span className={`flex-1 break-words overflow-hidden ${
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
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-white shadow-sm border-t border-gray-200 p-4">
        <div className="max-w-7xl mx-auto text-center text-sm text-gray-500">
          MediRunner Robot Control Interface
        </div>
      </footer>
    </div>
  )
}