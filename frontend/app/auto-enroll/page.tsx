'use client'

import { useEffect, useState } from 'react'
import useAppStore from '@/store/appStore'

export default function AutoEnrollPage() {
  const { addRobot, setActiveRobot, robots, teamSession } = useAppStore()
  const [status, setStatus] = useState('Checking backend...')
  const [backendRobots, setBackendRobots] = useState<string[]>([])

  const checkBackendRobots = async () => {
    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://127.0.0.1:8000'
      const response = await fetch(`${backendUrl}/status`)
      const data = await response.json()
      const robotIds = Object.keys(data.connections || {})
      setBackendRobots(robotIds)
      
      if (robotIds.length === 0) {
        setStatus('No robots connected to backend server')
        return
      }

      setStatus(`Found ${robotIds.length} robot(s) connected to backend: ${robotIds.join(', ')}`)
      
      // Auto-enroll robots that aren't already enrolled
      let enrolledCount = 0
      robotIds.forEach(robotId => {
        const alreadyEnrolled = robots.some(r => r.robotId === robotId)
        if (!alreadyEnrolled) {
          const success = addRobot(robotId, `Robot ${robotId}`)
          if (success) {
            enrolledCount++
          }
        }
      })

      if (enrolledCount > 0) {
        setStatus(prev => prev + `\n✅ Auto-enrolled ${enrolledCount} new robot(s)`)
        
        // Set first robot as active if none is active
        if (!robots.find(r => r.robotId === robotIds[0])) {
          setTimeout(() => {
            setActiveRobot(robotIds[0])
            setStatus(prev => prev + `\n✅ Set ${robotIds[0]} as active robot`)
          }, 100)
        }
      } else {
        setStatus(prev => prev + `\n✅ All backend robots already enrolled`)
      }

    } catch (error) {
      setStatus(`❌ Failed to connect to backend: ${error}`)
    }
  }

  useEffect(() => {
    if (teamSession.loggedIn) {
      checkBackendRobots()
    }
  }, [teamSession.loggedIn])

  if (!teamSession.loggedIn) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow">
          <h1 className="text-xl font-bold mb-4">Please Log In First</h1>
          <p>You need to log in before auto-enrolling robots.</p>
          <button
            onClick={() => window.location.href = '/'}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded"
          >
            Go to Login
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow p-6">
          <h1 className="text-2xl font-bold mb-6">Auto-Enroll Backend Robots</h1>
          
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold mb-2">Status:</h2>
              <pre className="bg-gray-100 p-4 rounded whitespace-pre-wrap">{status}</pre>
            </div>

            <button
              onClick={checkBackendRobots}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Refresh & Auto-Enroll
            </button>

            {backendRobots.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold mb-2">Robots Found on Backend:</h2>
                <ul className="list-disc list-inside space-y-1">
                  {backendRobots.map(robotId => {
                    const isEnrolled = robots.some(r => r.robotId === robotId)
                    return (
                      <li key={robotId} className="flex items-center justify-between">
                        <span>{robotId}</span>
                        <span className={`px-2 py-1 rounded text-sm ${
                          isEnrolled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {isEnrolled ? 'Enrolled' : 'Not Enrolled'}
                        </span>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}

            <div className="mt-6 pt-6 border-t">
              <p className="text-sm text-gray-600">
                After auto-enrollment, go to{' '}
                <a href="/console" className="text-blue-600 underline">Console</a>
                {' '}or{' '}
                <a href="/debug" className="text-blue-600 underline">Debug</a>
                {' '}to test robot connections.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}