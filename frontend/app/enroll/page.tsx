'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { speakSuccess } from '@/hooks/useVoiceAssistant'

export default function EnrollPage() {
  const [userId, setUserId] = useState('')
  const [name, setName] = useState('')
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null)
  const [isEnrolling, setIsEnrolling] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'error' | 'success' | 'info'>('info')
  const [enrolledUsers, setEnrolledUsers] = useState<Array<{user_id: string, name: string}>>([])
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null)
  const [countdown, setCountdown] = useState<number>(0)
  const [readyToCapture, setReadyToCapture] = useState(false)
  
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const autoEnrollTimerRef = useRef<NodeJS.Timeout | null>(null)
  const router = useRouter()

  // Fetch enrolled users on mount
  useEffect(() => {
    fetchEnrolledUsers()
    initializeCamera()
    return () => {
      cleanup()
    }
  }, [])

  const cleanup = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop())
    }
    if (autoEnrollTimerRef.current) {
      clearInterval(autoEnrollTimerRef.current)
    }
  }

  const fetchEnrolledUsers = async () => {
    try {
      const response = await fetch('http://localhost:8000/auth/users')
      if (response.ok) {
        const data = await response.json()
        setEnrolledUsers(data.users || [])
      }
    } catch (error) {
      console.error('Failed to fetch enrolled users:', error)
    }
  }

  const initializeCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        } 
      })
      
      setCameraStream(stream)
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        
        // Wait for video to be ready
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play()
          
          setMessage('Camera ready. Fill in your details below.')
          setMessageType('info')
          
          // Voice guidance
          speakSuccess('Camera ready. Focus on middle area of the camera')
        }
      }
      
    } catch (error) {
      console.error('Camera error:', error)
      setMessage('Failed to access camera. Please grant camera permissions.')
      setMessageType('error')
    }
  }

  const captureFrame = (): string | null => {
    if (!videoRef.current || !canvasRef.current) {
      console.error('Video or canvas ref not available')
      return null
    }

    const video = videoRef.current
    const canvas = canvasRef.current
    const context = canvas.getContext('2d')

    if (!context) {
      console.error('Canvas context not available')
      return null
    }

    // Check if video is ready and has valid dimensions
    if (video.readyState < 2 || video.videoWidth === 0) {
      console.error('Video not ready or has invalid dimensions')
      setMessage('Video not ready. Please wait...')
      setMessageType('error')
      return null
    }

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    context.drawImage(video, 0, 0, canvas.width, canvas.height)

    const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
    const base64 = dataUrl.split(',')[1]
    
    return base64
  }

  const startAutoEnroll = () => {
    if (!userId.trim() || !name.trim()) {
      setMessage('Please enter both User ID and Name first')
      setMessageType('error')
      return
    }

    // Check if video stream is available via videoRef
    if (!videoRef.current || !videoRef.current.srcObject) {
      setMessage('Camera not ready. Please wait or refresh the page.')
      setMessageType('error')
      return
    }

    // Check if video is actually playing
    if (videoRef.current.readyState < 2) {
      setMessage('Video not ready yet. Please wait a moment...')
      setMessageType('error')
      return
    }

    setReadyToCapture(true)
    speakSuccess('Get ready. Taking picture in 3 seconds')
    
    let count = 3
    setCountdown(count)
    setMessage(`Position your face. Capturing in ${count}...`)
    
    const countdownInterval = setInterval(() => {
      count--
      setCountdown(count)
      
      if (count === 0) {
        clearInterval(countdownInterval)
        setMessage('Capturing...')
        setTimeout(() => {
          captureAndEnroll()
        }, 500)
      } else {
        setMessage(`Position your face. Capturing in ${count}...`)
      }
    }, 1000)
    
    autoEnrollTimerRef.current = countdownInterval
  }

  const captureAndEnroll = async () => {
    setIsEnrolling(true)
    setMessage('Capturing and enrolling face...')
    setMessageType('info')

    try {
      const base64Image = captureFrame()
      
      if (!base64Image) {
        throw new Error('Failed to capture image')
      }

      const response = await fetch('http://localhost:8000/auth/enroll', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: userId.trim(),
          name: name.trim(),
          image: base64Image
        })
      })

      const data = await response.json()

      if (data.success) {
        setMessage(data.message || 'Enrollment successful! You can now login.')
        setMessageType('success')
        
        // Voice confirmation
        speakSuccess('Enrollment successful. You can now login.')
        
        // Clear form
        setUserId('')
        setName('')
        setReadyToCapture(false)
        setCountdown(0)
        
        // Refresh user list
        fetchEnrolledUsers()
        
        // Redirect to login after delay
        setTimeout(() => {
          router.push('/')
        }, 2000)
      } else {
        setMessage(data.message || 'Enrollment failed')
        setMessageType('error')
      }
    } catch (error) {
      console.error('Enrollment error:', error)
      setMessage('Failed to enroll. Please try again.')
      setMessageType('error')
    } finally {
      setIsEnrolling(false)
    }
  }

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (!confirm(`Are you sure you want to delete ${userName}?`)) {
      return
    }

    setDeletingUserId(userId)
    setMessage(`Deleting ${userName}...`)
    setMessageType('info')

    try {
      const response = await fetch(`http://localhost:8000/auth/users/${encodeURIComponent(userId)}`, {
        method: 'DELETE'
      })

      const data = await response.json()

      if (data.success) {
        setMessage(data.message || 'User deleted successfully')
        setMessageType('success')
        
        // Refresh user list
        fetchEnrolledUsers()
        
        // Clear message after delay
        setTimeout(() => {
          setMessage('')
        }, 3000)
      } else {
        setMessage(data.message || 'Failed to delete user')
        setMessageType('error')
      }
    } catch (error) {
      console.error('Delete error:', error)
      setMessage('Failed to delete user. Please try again.')
      setMessageType('error')
    } finally {
      setDeletingUserId(null)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-indigo-100 flex items-center justify-center px-4 py-8">
      <div className="max-w-4xl w-full">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              User Enrollment
            </h1>
            <p className="text-gray-600">
              Register your face for authentication
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Left Column - Camera and Form */}
            <div>
              {/* Camera Feed */}
              <div className="relative mb-6 bg-black rounded-lg overflow-hidden">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-auto"
                  style={{ maxHeight: '350px' }}
                />
                {!cameraStream && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
                    <p className="text-white">Initializing camera...</p>
                  </div>
                )}
              </div>

              <canvas ref={canvasRef} style={{ display: 'none' }} />

              {/* Form */}
              <div className="space-y-4">
                <div>
                  <label htmlFor="userId" className="block text-sm font-medium text-gray-700 mb-2">
                    User ID / Email
                  </label>
                  <input
                    type="text"
                    id="userId"
                    value={userId}
                    onChange={(e) => setUserId(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    placeholder="e.g., john.doe@example.com"
                    disabled={isEnrolling}
                  />
                </div>

                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                    Full Name
                  </label>
                  <input
                    type="text"
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                    placeholder="e.g., John Doe"
                    disabled={isEnrolling}
                  />
                </div>

                {/* Status Message */}
                {message && (
                  <div className={`p-4 rounded-lg ${
                    messageType === 'error' ? 'bg-red-50 text-red-700 border border-red-200' :
                    messageType === 'success' ? 'bg-green-50 text-green-700 border border-green-200' :
                    'bg-blue-50 text-blue-700 border border-blue-200'
                  }`}>
                    <p className="text-sm font-medium">{message}</p>
                  </div>
                )}

                <button
                  onClick={startAutoEnroll}
                  disabled={!cameraStream || isEnrolling || !userId.trim() || !name.trim() || readyToCapture}
                  className="w-full bg-purple-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors duration-200 flex items-center justify-center"
                >
                  {countdown > 0 ? (
                    <>
                      <span className="text-3xl font-bold mr-2">{countdown}</span>
                      <span>Get ready...</span>
                    </>
                  ) : isEnrolling ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Enrolling...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                      </svg>
                      Capture & Enroll
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Right Column - Enrolled Users */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Enrolled Users ({enrolledUsers.length})
              </h2>
              
              {enrolledUsers.length === 0 ? (
                <div className="bg-gray-50 rounded-lg p-8 text-center">
                  <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  <p className="text-gray-600">No users enrolled yet</p>
                  <p className="text-sm text-gray-500 mt-2">Be the first to register!</p>
                </div>
              ) : (
                <div className="bg-gray-50 rounded-lg p-4 max-h-[500px] overflow-y-auto">
                  <div className="space-y-2">
                    {enrolledUsers.map((user) => (
                      <div key={user.user_id} className="bg-white rounded-lg p-3 shadow-sm">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center flex-1">
                            <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center mr-3">
                              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                            </div>
                            <div className="flex-1">
                              <p className="font-medium text-gray-900">{user.name}</p>
                              <p className="text-sm text-gray-500">{user.user_id}</p>
                            </div>
                          </div>
                          <button
                            onClick={() => handleDeleteUser(user.user_id, user.name)}
                            disabled={deletingUserId === user.user_id}
                            className="ml-3 p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Delete user"
                          >
                            {deletingUserId === user.user_id ? (
                              <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                            ) : (
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            )}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-6 bg-purple-50 rounded-lg p-4 text-sm text-purple-800">
                <p className="font-medium mb-1">Enrollment Tips:</p>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li>Use a valid email or employee ID as User ID</li>
                  <li>Ensure your face is well-lit and clearly visible</li>
                  <li>Look directly at the camera with neutral expression</li>
                  <li>Remove glasses or hats if possible</li>
                  <li>Use same lighting/position when logging in for best match</li>
                  <li>You can only enroll once per User ID</li>
                  <li>Click the trash icon to delete an enrolled user</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <div className="mt-8 text-center border-t pt-6">
            <button
              onClick={() => router.push('/')}
              className="text-purple-600 hover:text-purple-800 text-sm font-medium"
            >
              ← Back to Login
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
