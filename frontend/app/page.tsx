'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import useAppStore from '@/store/appStore'
import { useVoiceAssistant } from '@/hooks/useVoiceAssistant'

export default function LoginPage() {
  /* ===== TRADITIONAL LOGIN (COMMENTED OUT - Use Face Login Instead) =====
  const [teamCode, setTeamCode] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  
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
  ===== END TRADITIONAL LOGIN ===== */
  
  const router = useRouter()
  const { teamSession } = useAppStore()

  // Voice Assistant Integration
  const {
    isListening,
    transcript,
    isAvailable,
    startListening,
    stopListening,
    lastCommand,
  } = useVoiceAssistant({
    onEnrollCommand: () => {
      console.log('🎤 Voice: Navigating to enrollment page')
      router.push('/enroll')
    },
    onLoginCommand: () => {
      console.log('🎤 Voice: Navigating to face-login page')
      router.push('/face-login')
    },
    autoStart: false, // Manual start via button
  })

  // Redirect if already logged in
  useEffect(() => {
    if (teamSession.loggedIn) {
      router.push('/console')
    }
  }, [teamSession.loggedIn, router])

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-xl p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Medi Runner
          </h1>
          <p className="text-sm text-gray-500 mb-4">Wired and Weird</p>
          <p className="text-gray-600">
            Secure face recognition authentication
          </p>
        </div>

        {/* Voice Assistant Controls */}
        {isAvailable && (
          <div className="mb-6 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-4 border border-purple-200">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <svg 
                  className={`w-5 h-5 ${isListening ? 'text-red-500 animate-pulse' : 'text-gray-400'}`} 
                  fill="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                  <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
                </svg>
                <span className="font-semibold text-gray-700">
                  Voice Assistant
                </span>
                {isListening && (
                  <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full animate-pulse">
                    Listening...
                  </span>
                )}
              </div>
              <button
                onClick={isListening ? stopListening : startListening}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isListening
                    ? 'bg-red-500 text-white hover:bg-red-600'
                    : 'bg-purple-600 text-white hover:bg-purple-700'
                }`}
              >
                {isListening ? 'Stop' : 'Start Voice'}
              </button>
            </div>
            
            {/* Transcript Display */}
            {transcript && (
              <div className="bg-white rounded p-3 text-sm text-gray-700 border border-purple-100">
                <span className="text-purple-600 font-medium">You said:</span> {transcript}
              </div>
            )}
            
            {/* Command Detection Display */}
            {lastCommand && (
              <div className="bg-green-50 rounded p-3 text-sm text-green-800 border border-green-200">
                <span className="font-medium">✓ Command detected:</span> {lastCommand === 'enrollment' ? 'Opening enrollment...' : 'Starting login...'}
              </div>
            )}
            
            {/* Voice Command Help */}
            {!transcript && !lastCommand && (
              <div className="text-xs text-gray-600 space-y-1">
                <p className="font-medium text-purple-700">Try saying:</p>
                <ul className="list-disc list-inside ml-2 space-y-0.5">
                  <li>&quot;Enroll me&quot; or &quot;Start enrollment&quot;</li>
                  <li>&quot;Login&quot; or &quot;Authenticate me&quot;</li>
                </ul>
              </div>
            )}
          </div>
        )}

        {/* ===== TRADITIONAL LOGIN FORM (COMMENTED OUT) =====
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

        <div className="mt-6 text-center">
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">Or</span>
            </div>
          </div>
        ===== END TRADITIONAL LOGIN FORM ===== */}

        {/* Face Login - Primary Authentication Method */}
        <div className="space-y-4">
          <button
            onClick={() => router.push('/face-login')}
            className="w-full flex flex-col items-center justify-center py-6 px-4 border-2 border-blue-500 rounded-lg shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-200"
          >
            <svg className="w-12 h-12 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            <span className="text-lg">Login with Face Recognition</span>
          </button>
          
          <div className="bg-blue-50 rounded-lg p-4 text-sm text-blue-800">
            <p className="font-medium mb-1">How it works:</p>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>Click the button above to start</li>
              <li>Allow camera access when prompted</li>
              <li>Position your face clearly in the frame</li>
              <li>Click &quot;Scan Face&quot; to authenticate</li>
            </ul>
          </div>
        </div>

        {/* Enrollment Link */}
        <div className="mt-8 text-center border-t pt-6">
          <p className="text-sm text-gray-600 mb-3">
            New user? Register your face first
          </p>
          <button
            onClick={() => router.push('/enroll')}
            className="inline-flex items-center px-4 py-2 border border-purple-300 rounded-md shadow-sm text-sm font-medium text-purple-700 bg-white hover:bg-purple-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transition-colors duration-200"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
            Enroll New User
          </button>
        </div>
      </div>
    </div>
  )
}
