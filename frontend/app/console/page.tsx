'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
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

  // Redirect if not logged in
  useEffect(() => {
    if (!teamSession.loggedIn) {
      router.push('/')
    }
  }, [teamSession.loggedIn, router])

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
          </div>
        </div>

        {/* Medical Item Panels: Full-width below */}
        <div className="mt-6">
          <div className="bg-white shadow-sm rounded-lg p-6">
            <ConsoleLoadHeader isLoadMode={isLoadMode} onToggle={() => setIsLoadMode(prev => !prev)} />
            <RobotMedicalItemLoadUnload isLoadMode={isLoadMode} />
          </div>
        </div>
      </main>
    </div>
  )
}


function ConsoleLoadHeader({ isLoadMode, onToggle }: { isLoadMode: boolean; onToggle: () => void }) {
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