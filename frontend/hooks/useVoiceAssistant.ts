import { useEffect, useRef, useState, useCallback } from 'react'

// Type definitions for Web Speech API
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

interface VoiceAssistantOptions {
  onEnrollCommand?: () => void
  onLoginCommand?: () => void
  onSuccess?: () => void
  autoStart?: boolean
}

interface VoiceAssistantReturn {
  isListening: boolean
  transcript: string
  isAvailable: boolean
  startListening: () => void
  stopListening: () => void
  speak: (text: string, options?: { onEnd?: () => void }) => void
  lastCommand: string
}

export function useVoiceAssistant(options: VoiceAssistantOptions = {}): VoiceAssistantReturn {
  const {
    onEnrollCommand,
    onLoginCommand,
    onSuccess,
    autoStart = false,
  } = options

  const [isListening, setIsListening] = useState(false)
  const [transcript, setTranscript] = useState('')
  const [lastCommand, setLastCommand] = useState('')
  const [isAvailable, setIsAvailable] = useState(false)

  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const synthRef = useRef<SpeechSynthesis | null>(null)

  // Initialize speech recognition
  useEffect(() => {
    if (typeof window === 'undefined') return

    // Check if speech recognition is available
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognitionAPI) {
      console.warn('Speech recognition not supported in this browser')
      return
    }

    setIsAvailable(true)
    synthRef.current = window.speechSynthesis

    const recognition = new SpeechRecognitionAPI()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimTranscript = ''
      let finalTranscript = ''

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcriptText = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          finalTranscript += transcriptText + ' '
        } else {
          interimTranscript += transcriptText
        }
      }

      setTranscript(interimTranscript || finalTranscript)

      // Process final transcript for commands
      if (finalTranscript) {
        processCommand(finalTranscript.toLowerCase().trim())
      }
    }

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error)
      if (event.error === 'not-allowed') {
        setIsListening(false)
      }
    }

    recognition.onend = () => {
      // Auto-restart if still supposed to be listening
      if (isListening) {
        try {
          recognition.start()
        } catch (e) {
          console.error('Failed to restart recognition:', e)
          setIsListening(false)
        }
      }
    }

    recognitionRef.current = recognition

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }
    }
  }, [isListening])

  // Process voice commands
  const processCommand = useCallback((command: string) => {
    console.log('Processing command:', command)
    
    // Enrollment command patterns
    const enrollPatterns = [
      'enroll me',
      'start enrollment',
      'go to enrollment',
      'register me',
      'sign me up'
    ]
    
    // Login command patterns
    const loginPatterns = [
      'login',
      'log in',
      'authenticate me',
      'start face login',
      'sign in',
      'authenticate'
    ]

    // Check for enrollment commands
    if (enrollPatterns.some(pattern => command.includes(pattern))) {
      setLastCommand('enrollment')
      
      // Navigate immediately
      if (onEnrollCommand) {
        onEnrollCommand()
      }
      
      // Then provide voice feedback
      setTimeout(() => {
        speak('Opening camera', {
          onEnd: () => {
            setTimeout(() => {
              speak('Please focus on middle area of the screen')
            }, 500)
          }
        })
      }, 100)
      
      return
    }

    // Check for login commands
    if (loginPatterns.some(pattern => command.includes(pattern))) {
      setLastCommand('login')
      
      // Navigate immediately
      if (onLoginCommand) {
        onLoginCommand()
      }
      
      // Then provide voice feedback
      setTimeout(() => {
        speak('Starting authentication')
      }, 100)
      
      return
    }
  }, [onEnrollCommand, onLoginCommand])

  // Speak function using Speech Synthesis
  const speak = useCallback((text: string, options: { onEnd?: () => void } = {}) => {
    if (!synthRef.current) {
      console.warn('Speech synthesis not available')
      return
    }

    // Cancel any ongoing speech
    synthRef.current.cancel()

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'en-US'
    utterance.rate = 1.0
    utterance.pitch = 1.0
    utterance.volume = 1.0

    if (options.onEnd) {
      utterance.onend = options.onEnd
    }

    synthRef.current.speak(utterance)
  }, [])

  // Start listening function
  const startListening = useCallback(() => {
    if (!recognitionRef.current || isListening) return

    try {
      setIsListening(true)
      recognitionRef.current.start()
      speak('Voice assistant activated. Say enroll me or login')
    } catch (error) {
      console.error('Failed to start speech recognition:', error)
      setIsListening(false)
    }
  }, [isListening, speak])

  // Stop listening function
  const stopListening = useCallback(() => {
    if (!recognitionRef.current || !isListening) return

    setIsListening(false)
    recognitionRef.current.stop()
    setTranscript('')
  }, [isListening])

  // Trigger success message
  useEffect(() => {
    if (onSuccess) {
      // This would be called externally when authentication succeeds
    }
  }, [onSuccess])

  // Auto-start if requested
  useEffect(() => {
    if (autoStart && isAvailable && !isListening) {
      // Delay auto-start to ensure page is ready
      const timer = setTimeout(() => {
        startListening()
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [autoStart, isAvailable, isListening, startListening])

  return {
    isListening,
    transcript,
    isAvailable,
    startListening,
    stopListening,
    speak,
    lastCommand,
  }
}

// Utility function to speak success message (can be called externally)
export function speakSuccess(text: string = 'Access granted. Welcome.') {
  if (typeof window !== 'undefined' && window.speechSynthesis) {
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'en-US'
    utterance.rate = 1.0
    window.speechSynthesis.speak(utterance)
  }
}
