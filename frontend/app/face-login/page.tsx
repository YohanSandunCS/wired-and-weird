'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import useAppStore from '@/store/appStore'
import { speakSuccess } from '@/hooks/useVoiceAssistant'

// Type for Web Speech API
interface SpeechRecognitionEvent extends Event {
  results: {
    [index: number]: {
      [index: number]: {
        transcript: string
      }
      isFinal: boolean
    }
    length: number
  }
  resultIndex: number
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  start: () => void
  stop: () => void
  onresult: (event: SpeechRecognitionEvent) => void
  onerror: (event: any) => void
  onend: () => void
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition
    webkitSpeechRecognition: new () => SpeechRecognition
  }
}

export default function FaceLoginPage() {
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null)
  const [isScanning, setIsScanning] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'error' | 'success' | 'info'>('info')
  const [voiceTranscript, setVoiceTranscript] = useState('')
  
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  
  const router = useRouter()
  const { isAuthenticated, setAuthenticated, login, teamSession } = useAppStore()

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated && teamSession.loggedIn) {
      router.push('/console')
    }
  }, [isAuthenticated, teamSession.loggedIn, router])

  // Initialize camera on mount
  useEffect(() => {
    initializeCamera()
    return () => {
      cleanup()
    }
  }, [])

  const cleanup = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop())
    }
    if (recognitionRef.current) {
      recognitionRef.current.stop()
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
      }
      
      setMessage('Camera ready. Click "Scan Face" to authenticate.')
      setMessageType('info')
    } catch (error) {
      console.error('Camera error:', error)
      setMessage('Failed to access camera. Please grant camera permissions.')
      setMessageType('error')
    }
  }

  const captureFrame = (): string | null => {
    if (!videoRef.current || !canvasRef.current) {
      return null
    }

    const video = videoRef.current
    const canvas = canvasRef.current
    const context = canvas.getContext('2d')

    if (!context) {
      return null
    }

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight

    // Draw video frame to canvas
    context.drawImage(video, 0, 0, canvas.width, canvas.height)

    // Convert to base64 (JPEG format)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8)
    
    // Extract base64 string (remove data:image/jpeg;base64, prefix)
    const base64 = dataUrl.split(',')[1]
    
    return base64
  }

  const handleFaceScan = async () => {
    if (!cameraStream) {
      setMessage('Camera not initialized')
      setMessageType('error')
      return
    }

    setIsScanning(true)
    setMessage('Scanning face...')
    setMessageType('info')

    try {
      const base64Image = captureFrame()
      
      if (!base64Image) {
        throw new Error('Failed to capture image')
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
        setMessage(`Welcome ${data.user}! Redirecting...`)
        setMessageType('success')
        
        // Speak success message
        speakSuccess(`Access granted. Welcome ${data.user}.`)
        
        // Update authentication state AND team session
        setAuthenticated(true)
        // Use the username from backend as team code for face-authenticated users
        login(data.user || 'ADMIN')
        
        // Redirect to console after brief delay
        setTimeout(() => {
          router.push('/console')
        }, 1000)
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

  const startVoiceLogin = () => {
    // Check if browser supports Web Speech API
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition

    if (!SpeechRecognitionAPI) {
      setMessage('Voice recognition not supported in this browser')
      setMessageType('error')
      return
    }

    // Initialize recognition if not already done
    if (!recognitionRef.current) {
      const recognition = new SpeechRecognitionAPI()
      recognition.continuous = false
      recognition.interimResults = true
      recognition.lang = 'en-US'

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let transcript = ''
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript
        }
        
        setVoiceTranscript(transcript.toLowerCase())
        
        // Check for trigger phrases
        const triggerPhrases = ['login', 'authenticate me', 'start login']
        const matchedPhrase = triggerPhrases.some(phrase => 
          transcript.toLowerCase().includes(phrase)
        )
        
        if (matchedPhrase && event.results[event.results.length - 1].isFinal) {
          setMessage('Voice command recognized! Starting face scan...')
          setMessageType('success')
          recognition.stop()
          setIsListening(false)
          
          // Trigger face scan automatically
          setTimeout(() => {
            handleFaceScan()
          }, 500)
        }
      }

      recognition.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error)
        setMessage(`Voice error: ${event.error}`)
        setMessageType('error')
        setIsListening(false)
      }

      recognition.onend = () => {
        setIsListening(false)
        if (voiceTranscript && !triggerPhraseMatched(voiceTranscript)) {
          setMessage('No trigger phrase detected. Try saying "login" or "authenticate me".')
          setMessageType('info')
        }
      }

      recognitionRef.current = recognition
    }

    // Start listening
    try {
      setIsListening(true)
      setVoiceTranscript('')
      setMessage('Listening... Say "login" or "authenticate me"')
      setMessageType('info')
      recognitionRef.current.start()
    } catch (error) {
      console.error('Failed to start voice recognition:', error)
      setMessage('Failed to start voice recognition')
      setMessageType('error')
      setIsListening(false)
    }
  }

  const stopVoiceLogin = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
    }
    setIsListening(false)
    setMessage('Voice login stopped')
    setMessageType('info')
  }

  const triggerPhraseMatched = (transcript: string): boolean => {
    const triggerPhrases = ['login', 'authenticate me', 'start login']
    return triggerPhrases.some(phrase => transcript.includes(phrase))
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4 py-8">
      <div className="max-w-2xl w-full bg-white rounded-2xl shadow-xl p-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Face Recognition Login
          </h1>
          <p className="text-gray-600">
            Position your face in the camera and click scan
          </p>
        </div>

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
          {!cameraStream && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
              <p className="text-white">Initializing camera...</p>
            </div>
          )}
        </div>

        {/* Hidden canvas for capturing frames */}
        <canvas ref={canvasRef} style={{ display: 'none' }} />

        {/* Status Message */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg ${
            messageType === 'error' ? 'bg-red-50 text-red-700 border border-red-200' :
            messageType === 'success' ? 'bg-green-50 text-green-700 border border-green-200' :
            'bg-blue-50 text-blue-700 border border-blue-200'
          }`}>
            <p className="text-sm font-medium">{message}</p>
            {voiceTranscript && (
              <p className="text-xs mt-1 opacity-75">Heard: &quot;{voiceTranscript}&quot;</p>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <button
            onClick={handleFaceScan}
            disabled={!cameraStream || isScanning}
            className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors duration-200 flex items-center justify-center"
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

          <button
            onClick={isListening ? stopVoiceLogin : startVoiceLogin}
            disabled={!cameraStream || isScanning}
            className={`w-full py-3 px-6 rounded-lg font-semibold transition-colors duration-200 flex items-center justify-center ${
              isListening 
                ? 'bg-red-600 hover:bg-red-700 text-white' 
                : 'bg-indigo-600 hover:bg-indigo-700 text-white disabled:bg-gray-400'
            } disabled:cursor-not-allowed`}
          >
            {isListening ? (
              <>
                <svg className="w-5 h-5 mr-2 animate-pulse" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                  <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                </svg>
                Stop Listening
              </>
            ) : (
              <>
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                  <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                </svg>
                Voice Login
              </>
            )}
          </button>
        </div>

        {/* Instructions */}
        <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600">
          <h3 className="font-semibold text-gray-900 mb-2">Instructions:</h3>
          <ul className="space-y-1 list-disc list-inside">
            <li>You must be enrolled first before logging in</li>
            <li>Click &quot;Scan Face&quot; to authenticate with face recognition</li>
            <li>Click &quot;Voice Login&quot; and say &quot;login&quot; or &quot;authenticate me&quot;</li>
            <li>Ensure your face is well-lit and clearly visible</li>
            <li>Use the same lighting/position as during enrollment for best results</li>
            <li>System compares your face with enrolled users</li>
          </ul>
        </div>

        {/* Enrollment Link */}
        <div className="mt-6 text-center border-t pt-4">
          <p className="text-sm text-gray-600 mb-2">
            Not enrolled yet?
          </p>
          <button
            onClick={() => router.push('/enroll')}
            className="text-purple-600 hover:text-purple-800 text-sm font-medium"
          >
            → Register your face
          </button>
        </div>

        {/* Back to Home Link - Commented out since traditional login is disabled
        <div className="mt-6 text-center">
          <button
            onClick={() => router.push('/')}
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            ← Back to traditional login
          </button>
        </div>
        */}
      </div>
    </div>
  )
}
