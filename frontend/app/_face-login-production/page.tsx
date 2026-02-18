'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import useAppStore from '@/store/appStore'
import { FaceDetection } from '@mediapipe/face_detection'
import { Camera } from '@mediapipe/camera_utils'

// MediaPipe Face Detection with bounding box overlay
export default function FaceLoginProductionPage() {
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null)
  const [isScanning, setIsScanning] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'error' | 'success' | 'info'>('info')
  const [faceDetected, setFaceDetected] = useState(false)
  const [faceBox, setFaceBox] = useState<{ x: number; y: number; width: number; height: number } | null>(null)
  
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null)
  const faceDetectionRef = useRef<FaceDetection | null>(null)
  const cameraRef = useRef<Camera | null>(null)
  
  const router = useRouter()
  const { isAuthenticated, setAuthenticated, login, teamSession } = useAppStore()

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && teamSession.loggedIn) {
      router.push('/console')
    }
  }, [isAuthenticated, teamSession.loggedIn, router])

  // Initialize MediaPipe Face Detection
  useEffect(() => {
    const initFaceDetection = async () => {
      try {
        // Initialize MediaPipe Face Detection
        const faceDetection = new FaceDetection({
          locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${file}`
          }
        })

        faceDetection.setOptions({
          model: 'short',  // short range model (faster, for faces within 2 meters)
          minDetectionConfidence: 0.5
        })

        faceDetection.onResults((results) => {
          if (overlayCanvasRef.current && videoRef.current) {
            const canvas = overlayCanvasRef.current
            const ctx = canvas.getContext('2d')
            if (!ctx) return

            // Clear canvas
            ctx.clearRect(0, 0, canvas.width, canvas.height)

            // Check if face detected
            if (results.detections && results.detections.length > 0) {
              const detection = results.detections[0]
              const bbox = detection.boundingBox

              if (bbox) {
                // Calculate bounding box coordinates
                const x = bbox.xCenter * canvas.width - (bbox.width * canvas.width) / 2
                const y = bbox.yCenter * canvas.height - (bbox.height * canvas.height) / 2
                const width = bbox.width * canvas.width
                const height = bbox.height * canvas.height

                // Store face box for cropping
                setFaceBox({ x, y, width, height })
                setFaceDetected(true)

                // Draw green bounding box
                ctx.strokeStyle = '#00ff00'
                ctx.lineWidth = 3
                ctx.strokeRect(x, y, width, height)

                // Draw corner markers
                const cornerSize = 20
                ctx.fillStyle = '#00ff00'
                
                // Top-left corner
                ctx.fillRect(x, y, cornerSize, 3)
                ctx.fillRect(x, y, 3, cornerSize)
                
                // Top-right corner
                ctx.fillRect(x + width - cornerSize, y, cornerSize, 3)
                ctx.fillRect(x + width - 3, y, 3, cornerSize)
                
                // Bottom-left corner
                ctx.fillRect(x, y + height - 3, cornerSize, 3)
                ctx.fillRect(x, y + height - cornerSize, 3, cornerSize)
                
                // Bottom-right corner
                ctx.fillRect(x + width - cornerSize, y + height - 3, cornerSize, 3)
                ctx.fillRect(x + width - 3, y + height - cornerSize, 3, cornerSize)

                // Draw confidence score
                ctx.fillStyle = '#00ff00'
                ctx.font = '16px Arial'
                ctx.fillText(
                  `Confidence: ${(detection.score[0] * 100).toFixed(0)}%`,
                  x,
                  y - 10
                )
              }
            } else {
              setFaceDetected(false)
              setFaceBox(null)
            }
          }
        })

        faceDetectionRef.current = faceDetection

        // Initialize camera
        await initializeCamera(faceDetection)
        
        setMessage('Camera ready. Position your face and click "Scan Face".')
        setMessageType('info')
      } catch (error) {
        console.error('Face detection error:', error)
        setMessage('Failed to initialize face detection. Please refresh the page.')
        setMessageType('error')
      }
    }

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

        // Wait for video to load
        videoRef.current.onloadedmetadata = () => {
          if (videoRef.current && overlayCanvasRef.current) {
            // Set overlay canvas size to match video
            overlayCanvasRef.current.width = videoRef.current.videoWidth
            overlayCanvasRef.current.height = videoRef.current.videoHeight

            // Initialize MediaPipe Camera
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
      setMessage('Failed to access camera. Please grant camera permissions.')
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

    // Add padding around face (20% on each side)
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

    // Set canvas size to cropped face size
    canvas.width = paddedWidth
    canvas.height = paddedHeight

    // Draw cropped face region
    context.drawImage(
      video,
      paddedX, paddedY, paddedWidth, paddedHeight,
      0, 0, paddedWidth, paddedHeight
    )

    // Convert to base64 JPEG
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9)
    const base64 = dataUrl.split(',')[1]
    
    return base64
  }

  const handleFaceScan = async () => {
    if (!cameraStream) {
      setMessage('Camera not initialized')
      setMessageType('error')
      return
    }

    if (!faceDetected || !faceBox) {
      setMessage('No face detected. Please position your face in frame.')
      setMessageType('error')
      return
    }

    setIsScanning(true)
    setMessage('Scanning face and extracting features...')
    setMessageType('info')

    try {
      const base64Image = cropFaceFromVideo()
      
      if (!base64Image) {
        throw new Error('Failed to capture face image')
      }

      // Send to backend
      const response = await fetch('http://localhost:8000/auth/face-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image: base64Image
        })
      })

      const data = await response.json()

      if (data.success) {
        const confidenceMsg = data.confidence ? ` (${data.confidence}% confidence)` : ''
        setMessage(`${data.user}! Redirecting...${confidenceMsg}`)
        setMessageType('success')
        
        // Update authentication state AND team session
        setAuthenticated(true)
        login(data.user || 'ADMIN')
        
        // Redirect to console after brief delay
        setTimeout(() => {
          router.push('/console')
        }, 1500)
      } else {
        setMessage(data.message || 'Face not recognized')
        setMessageType('error')
      }
    } catch (error) {
      console.error('Face scan error:', error)
      setMessage('Failed to authenticate. Please try again.')
      setMessageType('error')
    } finally {
      setIsScanning(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4 py-8">
      <div className="max-w-2xl w-full bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Face Recognition Login
          </h1>
          <p className="text-gray-600">
            Position your face in the camera - detection is automatic
          </p>
        </div>

        {/* Camera Feed with Overlay */}
        <div className="relative mb-6 bg-black rounded-lg overflow-hidden">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-auto"
            style={{ maxHeight: '500px' }}
          />
          
          {/* Face detection overlay canvas */}
          <canvas
            ref={overlayCanvasRef}
            className="absolute top-0 left-0 w-full h-full"
            style={{ pointerEvents: 'none' }}
          />
          
          {!cameraStream && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
              <div className="text-center">
                <svg className="animate-spin h-12 w-12 text-white mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <p className="text-white">Initializing camera and face detection...</p>
              </div>
            </div>
          )}

          {/* Face detection status indicator */}
          {cameraStream && (
            <div className={`absolute top-4 right-4 px-3 py-1 rounded-full text-sm font-medium ${
              faceDetected 
                ? 'bg-green-500 text-white' 
                : 'bg-red-500 text-white'
            }`}>
              {faceDetected ? '✓ Face Detected' : '✗ No Face'}
            </div>
          )}
        </div>

        {/* Hidden canvas for face cropping */}
        <canvas ref={canvasRef} style={{ display: 'none' }} />

        {/* Status Message */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg ${
            messageType === 'error' ? 'bg-red-50 text-red-700 border border-red-200' :
            messageType === 'success' ? 'bg-green-50 text-green-700 border border-green-200' :
            'bg-blue-50 text-blue-700 border border-blue-200'
          }`}>
            <p className="text-sm font-medium">{message}</p>
          </div>
        )}

        {/* Action Button */}
        <button
          onClick={handleFaceScan}
          disabled={!cameraStream || isScanning || !faceDetected}
          className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors duration-200 flex items-center justify-center mb-6"
        >
          {isScanning ? (
            <>
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Scanning...
            </>
          ) : (
            <>
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              Scan Face
            </>
          )}
        </button>

        {/* Instructions */}
        <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600">
          <h3 className="font-semibold text-gray-900 mb-2">Instructions:</h3>
          <ul className="space-y-1 list-disc list-inside">
            <li>Green box indicates face detected successfully</li>
            <li>Ensure your face is well-lit and clearly visible</li>
            <li>Look directly at the camera</li>
            <li>Only one face should be in frame</li>
            <li>Button enables only when face is detected</li>
            <li>System extracts 128-dimensional face features</li>
          </ul>
        </div>

        {/* Enrollment Link */}
        <div className="mt-6 text-center border-t pt-4">
          <p className="text-sm text-gray-600 mb-2">
            Not enrolled yet?
          </p>
          <button
            onClick={() => router.push('/enroll-production')}
            className="text-purple-600 hover:text-purple-800 text-sm font-medium"
          >
            → Register your face
          </button>
        </div>
      </div>
    </div>
  )
}
