'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import useAppStore from '@/store/appStore'
import { useRobotSocket } from '@/hooks/useRobotSocket'
import BatteryStatus from '@/components/BatteryStatus'
import PanoramicViewer from '@/components/PanoramicViewer'

export default function RobotAutonomousPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const robotId = searchParams.get('robotId')
  
  const { teamSession, robots, isAuthenticated } = useAppStore()
  const robot = robots.find(r => r.robotId === robotId)
  
  const logContainerRef = useRef<HTMLDivElement>(null)
  const isMouseOnScrollbar = useRef(false)
  const [autoCommandSent, setAutoCommandSent] = useState(false)
  const [showPanoramicModal, setShowPanoramicModal] = useState(false)
  const [isPanoramicCapturing, setIsPanoramicCapturing] = useState(false)
  const [currentMode, setCurrentMode] = useState<'manual' | 'auto'>('auto')
  
  const {
    isConnected,
    logs,
    latestVisionFrame,
    latestPanoramicImage,
    connect,
    disconnect,
    send,
    clearPanoramicImage,
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

  // Send autonomous mode command once connected
  useEffect(() => {
    if (isConnected && robotId && !autoCommandSent) {
      const command = {
        type: 'command',
        robotId,
        payload: {
          action: 'auto'
        },
        timestamp: Date.now()
      }
      
      send(command)
      setAutoCommandSent(true)
      
      console.log('Sent autonomous mode command:', command)
    }
  }, [isConnected, robotId, send, autoCommandSent])

  const capturePanoramicImage = () => {
    if (!isConnected || !robotId) return
    
    setIsPanoramicCapturing(true)
    
    const command = {
      type: 'command',
      robotId,
      payload: {
        action: 'panoramic'
      },
      timestamp: Date.now()
    }
    
    send(command)
    console.log('Sent panoramic capture command:', command)
  }

  const toggleMode = () => {
    if (!isConnected || !robotId) return
    
    const newMode = currentMode === 'manual' ? 'auto' : 'manual'
    
    const command = {
      type: 'command',
      robotId,
      payload: {
        action: newMode === 'auto' ? 'auto' : 'manual'
      },
      timestamp: Date.now()
    }
    
    send(command)
    setCurrentMode(newMode)
    console.log(`Switched to ${newMode} mode`)
  }

  // Handle panoramic image response
  useEffect(() => {
    if (latestPanoramicImage) {
      setIsPanoramicCapturing(false)
      setShowPanoramicModal(true)
    }
  }, [latestPanoramicImage])

  // Auto-scroll for logs
  useEffect(() => {
    const logContainer = logContainerRef.current
    if (logContainer && !isMouseOnScrollbar.current) {
      logContainer.scrollTop = logContainer.scrollHeight
    }
  }, [logs])

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
              <h1 className="text-xl font-semibold text-gray-900">
                Robot Autonomous Mode
              </h1>
              <div className="flex items-center space-x-2 ml-4">
                <span className="text-sm text-gray-600">Mode:</span>
                <button
                  onClick={toggleMode}
                  disabled={!isConnected}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                    currentMode === 'manual'
                      ? 'bg-blue-600 text-white'
                      : 'bg-purple-600 text-white'
                  }`}
                >
                  {currentMode === 'manual' ? '🎮 Manual' : '🤖 Auto'}
                </button>
              </div>
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
              <button
                onClick={() => router.push('/console')}
                className="px-3 py-2 rounded-md bg-gray-600 text-white text-sm font-medium hover:bg-gray-700 transition-colors"
              >
                ✕ Exit
              </button>
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
                      {currentMode === 'auto' ? 'Live Preview - Autonomous Mode' : 'Live Preview - Manual Mode'}
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
                    <div className="flex items-end justify-between">
                      <div className="bg-[#00000061] text-white text-xs px-2 py-1 rounded">
                        {new Date(latestVisionFrame.timestamp).toLocaleTimeString()}
                      </div>
                      <div className="bg-[#00000061] text-white text-sm px-3 py-1 rounded-md font-medium">
                        {currentMode === 'auto' ? '🤖 AUTO MODE' : '🎮 MANUAL MODE'}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              {latestVisionFrame && (
                <div className="p-6 bg-white border-t border-gray-200">
                  <div className="text-xs text-gray-500 space-y-2">
                    <div className="flex justify-between items-center">
                      <span>{currentMode === 'auto' ? 'Robot is operating in autonomous mode' : 'Robot in manual mode (use Control page for controls)'}</span>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        currentMode === 'auto' ? 'bg-green-100 text-green-800' : 'bg-blue-100 text-blue-800'
                      }`}>
                        {currentMode === 'auto' ? 'Following line autonomously' : 'Manual control'}
                      </span>
                    </div>
                    <div className="text-sm pt-2 text-gray-600">
                      {currentMode === 'auto' 
                        ? 'The robot is following the line autonomously. Monitor the video feed and logs for real-time status.' 
                        : 'Switch to Control Robot page for manual controls or toggle back to Auto mode.'}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="w-1/4 flex flex-col space-y-6">
            {/* Status Panel */}
            <div className="bg-white rounded-lg p-6 shadow-sm">
              <h2 className="text-lg font-medium text-gray-900 mb-4">Status</h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Mode</span>
                  <span className="text-sm font-medium text-gray-900">
                    {currentMode === 'auto' ? 'Autonomous' : 'Manual'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Command Sent</span>
                  <span className={`text-sm font-medium ${autoCommandSent ? 'text-green-600' : 'text-gray-400'}`}>
                    {autoCommandSent ? '✓ Yes' : 'Pending'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Connection</span>
                  <span className={`text-sm font-medium ${isConnected ? 'text-green-600' : 'text-red-600'}`}>
                    {isConnected ? '✓ Active' : '✗ Inactive'}
                  </span>
                </div>
              </div>
              
              {/* Panoramic Capture Button */}
              <div className="mt-6">
                <button
                  onClick={capturePanoramicImage}
                  disabled={!isConnected || isPanoramicCapturing}
                  className="w-full p-3 rounded-md border-2 bg-purple-500 text-white font-medium hover:bg-purple-600 border-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isPanoramicCapturing ? '📸 Capturing...' : '📸 360° Panoramic'}
                </button>
              </div>
            </div>

            {/* Filtered Logs / Diagnostics */}
            <div className="bg-gray-600 rounded-lg p-6 shadow-sm flex-grow relative">
              <h2 className="text-lg font-medium text-white mb-4">Autonomous Log</h2>
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
          MediRunner Robot Interface - {currentMode === 'auto' ? 'Autonomous Mode' : 'Manual Mode'}
        </div>
      </footer>

      {/* Panoramic Image Viewer */}
      {showPanoramicModal && latestPanoramicImage && (
        <PanoramicViewer
          imageUrl={`data:${latestPanoramicImage.payload.mime};base64,${latestPanoramicImage.payload.data}`}
          onClose={() => {
            setShowPanoramicModal(false)
            clearPanoramicImage()
          }}
          captureTime={latestPanoramicImage.payload.captureTime}
          width={latestPanoramicImage.payload.width}
          height={latestPanoramicImage.payload.height}
        />
      )}
    </div>
  )
}
