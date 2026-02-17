'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import useAppStore from '@/store/appStore'
import { useRobotSocket } from '@/hooks/useRobotSocket'
import BatteryStatus from '@/components/BatteryStatus'

export default function RobotControlPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const robotId = searchParams.get('robotId')
  
  const { teamSession, robots } = useAppStore()
  const robot = robots.find(r => r.robotId === robotId)
  
  const [pressedKeys, setPressedKeys] = useState(new Set<string>())
  const [commandHistory, setCommandHistory] = useState<Array<{id: string, command: string, timestamp: number}>>([])
  const [streamStatus, setStreamStatus] = useState<'loading' | 'connected' | 'error'>('loading')
  
  const {
    isConnected,
    logs,
    latestVisionFrame,
    connect,
    disconnect,
    send,
  } = useRobotSocket(robotId)

  // Redirect if not logged in or no robot
  useEffect(() => {
    if (!teamSession.loggedIn) {
      router.push('/')
      return
    }
    if (!robotId || !robot) {
      router.push('/console')
      return
    }
  }, [teamSession.loggedIn, robotId, robot, router])

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

  if (!teamSession.loggedIn || !robotId || !robot) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Control Panel */}
          <div className="space-y-6">
            {/* Control Instructions */}
            <div className="bg-white rounded-lg p-6 shadow-sm">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Controls</h2>
              <div className="space-y-3">
                <p className="text-sm text-gray-600">
                  Use your keyboard to control the robot:
                </p>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center space-x-2">
                    <kbd className="px-2 py-1 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg">↑</kbd>
                    <span>Forward</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <kbd className="px-2 py-1 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg">↓</kbd>
                    <span>Backward</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <kbd className="px-2 py-1 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg">←</kbd>
                    <span>Turn Left</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <kbd className="px-2 py-1 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg">→</kbd>
                    <span>Turn Right</span>
                  </div>
                  <div className="flex items-center space-x-2 col-span-2">
                    <kbd className="px-2 py-1 text-xs font-semibold text-gray-800 bg-gray-100 border border-gray-200 rounded-lg">Space</kbd>
                    <span>Emergency Stop</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Visual Control Pad */}
            <div className="bg-white rounded-lg p-6 shadow-sm">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Visual Controls</h2>
              <div className="grid grid-cols-3 gap-2 max-w-xs mx-auto">
                <div></div>
                <button
                  className={`p-4 rounded-lg border-2 transition-colors ${
                    pressedKeys.has('ArrowUp') 
                      ? 'bg-blue-500 text-white border-blue-500' 
                      : 'bg-gray-50 hover:bg-gray-100 border-gray-300'
                  }`}
                  onClick={() => sendMovementCommand('forward')}
                  disabled={!isConnected || !robot.isOnline}
                >
                  ↑
                </button>
                <div></div>
                
                <button
                  className={`p-4 rounded-lg border-2 transition-colors ${
                    pressedKeys.has('ArrowLeft') 
                      ? 'bg-blue-500 text-white border-blue-500' 
                      : 'bg-gray-50 hover:bg-gray-100 border-gray-300'
                  }`}
                  onClick={() => sendMovementCommand('left')}
                  disabled={!isConnected || !robot.isOnline}
                >
                  ←
                </button>
                <button
                  className="p-4 rounded-lg border-2 bg-red-50 hover:bg-red-100 border-red-300 text-red-600"
                  onClick={sendStopCommand}
                  disabled={!isConnected}
                >
                  STOP
                </button>
                <button
                  className={`p-4 rounded-lg border-2 transition-colors ${
                    pressedKeys.has('ArrowRight') 
                      ? 'bg-blue-500 text-white border-blue-500' 
                      : 'bg-gray-50 hover:bg-gray-100 border-gray-300'
                  }`}
                  onClick={() => sendMovementCommand('right')}
                  disabled={!isConnected || !robot.isOnline}
                >
                  →
                </button>
                
                <div></div>
                <button
                  className={`p-4 rounded-lg border-2 transition-colors ${
                    pressedKeys.has('ArrowDown') 
                      ? 'bg-blue-500 text-white border-blue-500' 
                      : 'bg-gray-50 hover:bg-gray-100 border-gray-300'
                  }`}
                  onClick={() => sendMovementCommand('backward')}
                  disabled={!isConnected || !robot.isOnline}
                >
                  ↓
                </button>
                <div></div>
              </div>
            </div>
          </div>

          {/* Logs and History */}
          <div className="space-y-6">
            {/* Live Preview */}
             <div className="bg-white rounded-lg p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-medium text-gray-900">Live Preview</h2>
                {latestVisionFrame && (
                  <div className="text-sm text-gray-500">
                    {latestVisionFrame.payload.width}×{latestVisionFrame.payload.height} • 
                    {latestVisionFrame.payload.quality}% quality
                  </div>
                )}
              </div>
              
              <div className="bg-gray-100 rounded-md p-3 h-48 flex items-center justify-center">
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
                  <div className="relative w-full h-full">
                    <img
                      src={`data:${latestVisionFrame.payload.mime};base64,${latestVisionFrame.payload.data}`}
                      alt="Robot Camera Feed"
                      className="w-full h-full object-contain rounded"
                      onError={(e) => {
                        console.error('Failed to load vision frame:', e)
                      }}
                    />
                    <div className="absolute bottom-2 left-2 bg-black bg-opacity-60 text-white text-xs px-2 py-1 rounded">
                      {new Date(latestVisionFrame.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                )}
              </div>
              
              {latestVisionFrame && (
                <div className="mt-3 text-xs text-gray-500 space-y-1">
                  <div className="flex justify-between">
                    <span>Role:</span>
                    <span className="font-mono">{latestVisionFrame.role}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>MIME:</span>
                    <span className="font-mono">{latestVisionFrame.payload.mime}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Timestamp:</span>
                    <span className="font-mono">{new Date(latestVisionFrame.timestamp).toLocaleString()}</span>
                  </div>
                </div>
              )}
            </div> 


            {/* Live Preview - MJPEG Stream */}
            {/*
            <div className="bg-white rounded-lg p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-medium text-gray-900">Live Preview</h2>
                <div className="text-sm text-gray-500">
                  MJPEG Stream
                </div>
              </div>
              
              <div className="bg-gray-100 rounded-md p-3 h-64 flex items-center justify-center">
                <div className="relative w-full h-full">
                  <img
                    src="http://127.0.0.1:5001/stream"
                    alt="Robot Camera Feed"
                    className="w-full h-full object-contain rounded"
                    style={{ 
                      maxWidth: '100%', 
                      maxHeight: '100%',
                      display: 'block'
                    }}
                    onError={(e) => {
                      console.error('Failed to load MJPEG stream:', e)
                      setStreamStatus('error')
                    }}
                    onLoad={() => {
                      console.log('MJPEG stream loaded successfully')
                      setStreamStatus('connected')
                    }}
                  />
                  <div className="absolute bottom-2 left-2 bg-black bg-opacity-60 text-white text-xs px-2 py-1 rounded">
                    Live Stream • {new Date().toLocaleTimeString()}
                  </div>
                  
                  {streamStatus === 'error' && (
                    <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-center bg-gray-100 rounded">
                      <div>
                        <div className="text-gray-400 mb-2 text-2xl">⚠️</div>
                        <div className="text-sm">Stream not available</div>
                        <div className="text-xs mt-1 text-gray-400">Check if server is running on port 5001</div>
                        <button 
                          onClick={() => {
                            setStreamStatus('loading')
                            // Force reload the image
                            const img = document.querySelector('img[src="http://127.0.0.1:5001/stream"]') as HTMLImageElement
                            if (img) {
                              img.src = `http://127.0.0.1:5001/stream?t=${Date.now()}`
                            }
                          }}
                          className="mt-2 px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
                        >
                          Retry
                        </button>
                      </div>
                    </div>
                  )}
                  
                  {streamStatus === 'loading' && (
                    <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-center bg-gray-100 rounded">
                      <div>
                        <div className="text-gray-400 mb-2 text-2xl">⏳</div>
                        <div className="text-sm">Loading stream...</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="mt-3 text-xs text-gray-500 space-y-1">
                <div className="flex justify-between">
                  <span>Source:</span>
                  <span className="font-mono">http://127.0.0.1:5001/stream</span>
                </div>
                <div className="flex justify-between">
                  <span>Format:</span>
                  <span className="font-mono">MJPEG</span>
                </div>
                <div className="flex justify-between">
                  <span>Status:</span>
                  <span className={`font-mono ${
                    streamStatus === 'connected' ? 'text-green-600' : 
                    streamStatus === 'error' ? 'text-red-600' : 
                    'text-yellow-600'
                  }`}>
                    {streamStatus === 'connected' ? 'Connected' : 
                     streamStatus === 'error' ? 'Error' : 
                     'Loading...'}
                  </span>
                </div>
              </div>
              
            </div> */}

            {/* Connection Logs */}
            <div className="bg-white rounded-lg p-6 shadow-sm">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Connection Logs</h2>
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
        </div>
      </div>
    </div>
  )
}