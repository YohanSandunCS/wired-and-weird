'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import sampleSnap from './images/sample_snap.jpg'
import useAppStore from '@/store/appStore'
import RobotEnrollmentForm from '@/components/RobotEnrollmentForm'
import RobotList from '@/components/RobotList'
import RobotConnectionPanel from '@/components/RobotConnectionPanel'
import BatteryStatus from '@/components/BatteryStatus'
import RobotMedicalItemLoadUnload from '@/components/RobotMedicalItemLoadUnload'

export default function ConsolePage() {
  const router = useRouter()
  const { teamSession, logout, activeRobotId, robots } = useAppStore()
  const [isLoadMode, setIsLoadMode] = useState(true)
  const [isRobotBusy, setIsRobotBusy] = useState(false)
  const [detectionResults, setDetectionResults] = useState<{label: string, direction: string, confidence: number}[]>([])
  const [detectionLogs, setDetectionLogs] = useState<string[]>([])
  const [isDetecting, setIsDetecting] = useState(false)

  const handleToggle = () => {
    if (isRobotBusy) {
      alert(isLoadMode 
        ? "Samples are being loaded. Please stop loading first." 
        : "Samples are being unloaded. Please stop unloading first."
      )
      return
    }
    setIsLoadMode(prev => !prev)
  }

  // Redirect if not logged in
  useEffect(() => {
    if (!teamSession.loggedIn) {
      router.push('/')
    }
  }, [teamSession.loggedIn, router])

  // Fake detection on mount
  useEffect(() => {
    let mounted = true
    
    async function runDetection() {
      if (isDetecting) return
      setIsDetecting(true)
      try {
        // In a real scenario we'd capture from video.
        // Here, fetch the static sample image to simulate a capture.
        const response = await fetch(sampleSnap.src)
        const blob = await response.blob()
        
        const formData = new FormData()
        formData.append('file', blob, 'snapshot.jpg')
        formData.append('possible_words', "DENTAL,ONCOLOGY,X-RAY,ICU,EMERGENCY")
        
        // Gateway runs on port 8000 by default (adjust if needed via env)
        const apiRes = await fetch('http://localhost:8000/detect-symbols', {
          method: 'POST',
          body: formData,
        })
        
        if (apiRes.ok && mounted) {
          const data = await apiRes.json()
          setDetectionResults(data.detected || [])
          setDetectionLogs(data.logs || [])
        }
      } catch (err) {
        console.error("Detection failed", err)
        setDetectionLogs(prev => [...prev, `Client error: ${JSON.stringify(err)}`])
      } finally {
        if (mounted) setIsDetecting(false)
      }
    }
    
    runDetection()
    
    return () => { mounted = false }
  }, [])

  const handleLogout = () => {
    logout()
    router.push('/')
  }

  if (!teamSession.loggedIn) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-gray-600">Loading...</div>
      </div>
    )
  }

  const activeRobot = robots.find(robot => robot.robotId === activeRobotId)

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Top Navigation Bar */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">
                Medi Runner - Console
              </h1>
              {activeRobot && (
                <div className="ml-4 flex items-center">
                  <span className="text-sm text-gray-600">Active:</span>
                  <div className="ml-2 flex items-center">
                    <span className="text-sm font-medium text-gray-900">
                      {activeRobot.name || activeRobot.robotId}
                    </span>
                    <div className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      activeRobot.isOnline 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {activeRobot.isOnline ? 'Online' : 'Offline'}
                    </div>
                    <div className="ml-3">
                      <BatteryStatus 
                        battery={activeRobot.battery} 
                        lastUpdate={activeRobot.lastTelemetryUpdate}
                        size="md"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                Team: <span className="font-medium text-gray-900">{teamSession.teamCode}</span>
              </span>
              <button
                onClick={handleLogout}
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
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
            <div className="bg-white shadow-sm rounded-lg p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">
                Robot Enrollment
              </h2>
              <RobotEnrollmentForm />
            </div>

            <div className="bg-white shadow-sm rounded-lg p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">
                Registered Robots
              </h2>
              <RobotList />
            </div>
          </div>

          {/* Right Column: Connection Panel */}
          <div className="space-y-6">
            <div className="bg-white shadow-sm rounded-lg p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">
                Robot Connection
              </h2>
              <RobotConnectionPanel />
            </div>

            <div className="bg-white shadow-sm rounded-lg p-6">
              <h2 className="text-lg font-medium text-gray-900 mb-4">
                Image Detection
              </h2>
              <div className="aspect-video relative bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
                <Image 
                  src={sampleSnap} 
                  alt="Detection Sample" 
                  fill
                  className="object-cover"
                />
              </div>
              
              <div className="mt-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <h3 className="text-sm font-medium text-gray-700 mb-2">Detected Symbols</h3>
                {isDetecting ? (
                  <div className="text-sm text-gray-500 animate-pulse">Analyzing frame...</div>
                ) : (
                  <ul className="space-y-2">
                    {detectionResults.map((item, i) => (
                      <li key={i} className="flex justify-between items-center text-sm border-b last:border-0 border-gray-100 pb-1 last:pb-0">
                        <span className="font-semibold text-gray-900">{item.label}</span>
                        <span className="text-gray-600 flex items-center gap-2">
                          <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold 
                            ${item.direction === 'LEFT' ? 'bg-blue-100 text-blue-800' : 
                              item.direction === 'RIGHT' ? 'bg-green-100 text-green-800' : 
                              'bg-yellow-100 text-yellow-800'}`}>
                            {item.direction}
                          </span>
                          <span className="text-xs text-gray-400">
                            {Math.round(item.confidence * 100)}%
                          </span>
                        </span>
                      </li>
                    ))}
                    {!detectionResults.length && <span className="text-gray-400 text-sm">No symbols detected.</span>}
                  </ul>
                )}
                
                {/* Debug Log Viewer */}
                {detectionLogs.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <details className="text-xs">
                      <summary className="text-gray-500 cursor-pointer hover:text-gray-700 select-none">Show Debug Logs</summary>
                      <div className="mt-2 bg-gray-900 text-gray-300 p-2 rounded overflow-x-auto max-h-32 font-mono whitespace-pre text-[10px]">
                        {detectionLogs.map((log, i) => (
                           <div key={i}>{log}</div>
                        ))}
                      </div>
                    </details>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Medical Item Panels: Full-width below. TODO: JUST REMOVE THE DISPLAY_NONE WHEN NECESSARY */}
        <div className="mt-6" style={{ display : 'none'}}>
          <div className="bg-white shadow-sm rounded-lg p-6">
            <ConsoleLoadHeader isLoadMode={isLoadMode} onToggle={handleToggle} />
            <RobotMedicalItemLoadUnload 
              isLoadMode={isLoadMode} 
              onBusyChange={setIsRobotBusy} 
            />
          </div>
        </div>
      </main>
    </div>
  )
}


function ConsoleLoadHeader({ isLoadMode, onToggle }: { isLoadMode: boolean; onToggle: () => void }) {
  return (
    <div className="flex justify-center mb-6">
      <div className="bg-gray-100 p-1 rounded-lg inline-flex shadow-inner items-center h-[48px]">
        <button
          onClick={() => !isLoadMode && onToggle()}
          className={`px-6 h-full rounded-md font-medium transition-all duration-200 flex items-center ${
            isLoadMode
              ? 'bg-white text-gray-900 shadow-sm text-[16px]'
              : 'text-gray-500 hover:text-gray-700 text-sm'
          }`}
        >
          Load Medical Items
        </button>
        <button
          onClick={() => isLoadMode && onToggle()}
          className={`px-6 h-full rounded-md font-medium transition-all duration-200 flex items-center ${
            !isLoadMode
              ? 'bg-white text-gray-900 shadow-sm text-[16px]'
              : 'text-gray-500 hover:text-gray-700 text-sm'
          }`}
        >
          Unload Medical Items
        </button>
      </div>
    </div>
  )
}