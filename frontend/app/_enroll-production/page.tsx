'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { FaceDetection } from '@mediapipe/face_detection'
import { Camera } from '@mediapipe/camera_utils'

export default function EnrollProductionPage() {
  const [userId, setUserId] = useState('')
  const [name, setName] = useState('')
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null)
  const [isEnrolling, setIsEnrolling] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'error' | 'success' | 'info'>('info')
  const [enrolledUsers, setEnrolledUsers] = useState<Array<{user_id: string, name: string}>>([])
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null)
  const [faceDetected, setFaceDetected] = useState(false)
  const [faceBox, setFaceBox] = useState<{ x: number; y: number; width: number; height: number } | null>(null)
  
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null)
  const faceDetectionRef = useRef<FaceDetection | null>(null)
  const cameraRef = useRef<Camera | null>(null)
  const router = useRouter()

  // Fetch enrolled users on mount
  useEffect(() => {
    fetchEnrolledUsers()
    initFaceDetection()
    
    return () => {
      cleanup()
    }
  }, [])

  const cleanup = () => {
    if (cameraRef.current) {
      cameraRef.current.stop()
    }
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop())
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

  const initFaceDetection = async () => {
    try {
      const faceDetection = new FaceDetection({
        locateFile: (file) => {
          return `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${file}`
        }
      })

      faceDetection.setOptions({
        model: 'short',
        minDetectionConfidence: 0.5
      })

      faceDetection.onResults((results) => {
        if (overlayCanvasRef.current && videoRef.current) {
          const canvas = overlayCanvasRef.current
          const ctx = canvas.getContext('2d')
          if (!ctx) return

          ctx.clearRect(0, 0, canvas.width, canvas.height)

          if (results.detections && results.detections.length === 1) {
            const detection = results.detections[0]
            const bbox = detection.boundingBox

            if (bbox) {
              const x = bbox.xCenter * canvas.width - (bbox.width * canvas.width) / 2
              const y = bbox.yCenter * canvas.height - (bbox.height * canvas.height) / 2
              const width = bbox.width * canvas.width
              const height = bbox.height * canvas.height

              setFaceBox({ x, y, width, height })
              setFaceDetected(true)

              // Draw green bounding box
              ctx.strokeStyle = '#00ff00'
              ctx.lineWidth = 3
              ctx.strokeRect(x, y, width, height)

              // Draw confidence
              ctx.fillStyle = '#00ff00'
              ctx.font = '16px Arial'
              ctx.fillText(
                `Confidence: ${(detection.score[0] * 100).toFixed(0)}%`,
                x,
                y - 10
              )
            }
          } else if (results.detections && results.detections.length > 1) {
            setFaceDetected(false)
            setFaceBox(null)
            // Draw warning for multiple faces
            ctx.fillStyle = '#ff0000'
            ctx.font = '20px Arial'
            ctx.fillText('Multiple faces detected!', 20, 40)
          } else {
            setFaceDetected(false)
            setFaceBox(null)
          }
        }
      })

      faceDetectionRef.current = faceDetection
      await initializeCamera(faceDetection)
      
      setMessage('Camera ready. Fill in details and ensure one face is detected.')
      setMessageType('info')
    } catch (error) {
      console.error('Face detection error:', error)
      setMessage('Failed to initialize face detection.')
      setMessageType('error')
    }
  }

  const initializeCamera = async (faceDetection: FaceDetection) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        } 
      })
      
      setCameraStream(stream)
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream

        videoRef.current.onloadedmetadata = () => {
          if (videoRef.current && overlayCanvasRef.current) {
            overlayCanvasRef.current.width = videoRef.current.videoWidth
            overlayCanvasRef.current.height = videoRef.current.videoHeight

            const camera = new Camera(videoRef.current, {
              onFrame: async () => {
                if (faceDetectionRef.current && videoRef.current) {
                  await faceDetectionRef.current.send({ image: videoRef.current })
                }
              },
              width: 1280,
              height: 720
            })
            
            camera.start()
            cameraRef.current = camera
          }
        }
      }
    } catch (error) {
      console.error('Camera error:', error)
      setMessage('Failed to access camera. Please grant permissions.')
      setMessageType('error')
    }
  }

  const cropFaceFromVideo = (): string | null => {
    if (!videoRef.current || !canvasRef.current || !faceBox) {
      return null
    }

    const video = videoRef.current
    const canvas = canvasRef.current
    const context = canvas.getContext('2d')
    if (!context) return null

    const padding = 0.2
    const paddedX = Math.max(0, faceBox.x - faceBox.width * padding)
    const paddedY = Math.max(0, faceBox.y - faceBox.height * padding)
    const paddedWidth = Math.min(
      video.videoWidth - paddedX,
      faceBox.width * (1 + 2 * padding)
    )
    const paddedHeight = Math.min(
      video.videoHeight - paddedY,
      faceBox.height * (1 + 2 * padding)
    )

    canvas.width = paddedWidth
    canvas.height = paddedHeight

    context.drawImage(
      video,
      paddedX, paddedY, paddedWidth, paddedHeight,
      0, 0, paddedWidth, paddedHeight
    )

    const dataUrl = canvas.toDataURL('image/jpeg', 0.9)
    return dataUrl.split(',')[1]
  }

  const handleEnroll = async () => {
    if (!userId.trim() || !name.trim()) {
      setMessage('Please enter both User ID and Name')
      setMessageType('error')
      return
    }

    if (!faceDetected || !faceBox) {
      setMessage('No face detected. Position your face clearly in frame.')
      setMessageType('error')
      return
    }

    setIsEnrolling(true)
    setMessage('Capturing face and extracting features...')
    setMessageType('info')

    try {
      const base64Image = cropFaceFromVideo()
      
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
        setMessage(data.message || 'Enrollment successful!')
        setMessageType('success')
        
        setUserId('')
        setName('')
        
        fetchEnrolledUsers()
        
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
    if (!confirm(`Delete ${userName}?`)) return

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
        fetchEnrolledUsers()
        setTimeout(() => setMessage(''), 3000)
      } else {
        setMessage(data.message || 'Failed to delete user')
        setMessageType('error')
      }
    } catch (error) {
      console.error('Delete error:', error)
      setMessage('Failed to delete user.')
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
              User Enrollment (Production)
            </h1>
            <p className="text-gray-600">
              Register with face recognition - 128-D embeddings
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
                  style={{ maxHeight: '400px' }}
                />
                
                <canvas
                  ref={overlayCanvasRef}
                  className="absolute top-0 left-0 w-full h-full"
                  style={{ pointerEvents: 'none' }}
                />
                
                {!cameraStream && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
                    <p className="text-white">Initializing...</p>
                  </div>
                )}

                {cameraStream && (
                  <div className={`absolute top-4 right-4 px-3 py-1 rounded-full text-sm font-medium ${
                    faceDetected ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                  }`}>
                    {faceDetected ? '✓ Face OK' : '✗ No Face'}
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="john.doe@example.com"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="John Doe"
                    disabled={isEnrolling}
                  />
                </div>

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
                  onClick={handleEnroll}
                  disabled={!cameraStream || isEnrolling || !userId.trim() || !name.trim() || !faceDetected}
                  className="w-full bg-purple-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  {isEnrolling ? 'Enrolling...' : 'Enroll Face'}
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
                  <p className="text-gray-600">No users enrolled yet</p>
                </div>
              ) : (
                <div className="bg-gray-50 rounded-lg p-4 max-h-[500px] overflow-y-auto">
                  <div className="space-y-2">
                    {enrolledUsers.map((user) => (
                      <div key={user.user_id} className="bg-white rounded-lg p-3 shadow-sm flex items-center justify-between">
                        <div className="flex items-center flex-1">
                          <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center mr-3">
                            <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{user.name}</p>
                            <p className="text-sm text-gray-500">{user.user_id}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteUser(user.user_id, user.name)}
                          disabled={deletingUserId === user.user_id}
                          className="ml-3 p-2 text-red-600 hover:bg-red-50 rounded-lg"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="mt-6 bg-purple-50 rounded-lg p-4">
                <p className="font-medium mb-1 text-sm">Production Features:</p>
                <ul className="list-disc list-inside space-y-1 text-xs text-purple-800">
                  <li>Real-time face detection with MediaPipe</li>
                  <li>Extracts 128-dimensional face embeddings</li>
                  <li>Stores only encodings (no images)</li>
                  <li>High accuracy matching (99%+)</li>
                  <li>Robust to lighting and pose changes</li>
                  <li>Only one face must be in frame</li>
                </ul>
              </div>
            </div>
          </div>

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
