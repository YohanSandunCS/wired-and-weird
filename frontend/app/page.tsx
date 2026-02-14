'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import useAppStore from '@/store/appStore'

export default function LoginPage() {
  const [teamCode, setTeamCode] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  
  const router = useRouter()
  const { teamSession, login } = useAppStore()

  // Redirect if already logged in
  useEffect(() => {
    if (teamSession.loggedIn) {
      router.push('/console')
    }
  }, [teamSession.loggedIn, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    // Validate both fields are non-empty
    if (!teamCode.trim() || !pin.trim()) {
      setError('Both team code and PIN are required')
      setIsLoading(false)
      return
    }

    // Validate PIN must be "0000"
    if (pin.trim() !== '0000') {
      setError('Invalid PIN. Please enter the correct PIN.')
      setIsLoading(false)
      return
    }

    try {
      // Simulate login delay
      await new Promise(resolve => setTimeout(resolve, 500))
      
      // Simulate login (no server request)
      login(teamCode.trim())
      
      // Redirect to console
      router.push('/console')
    } catch (error) {
      setError('Login failed. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Medi Runner - Wired and Weired
          </h1>
          <p className="text-gray-600">
            Enter your team credentials to access the console
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="teamCode" className="block text-sm font-medium text-gray-700 mb-2">
              Team Code
            </label>
            <input
              type="text"
              id="teamCode"
              value={teamCode}
              onChange={(e) => setTeamCode(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter your team code"
              disabled={isLoading}
            />
          </div>

          <div>
            <label htmlFor="pin" className="block text-sm font-medium text-gray-700 mb-2">
              PIN
            </label>
            <input
              type="password"
              id="pin"
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter your PIN"
              disabled={isLoading}
            />
          </div>

          {error && (
            <div className="text-red-600 text-sm text-center">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  )
}
