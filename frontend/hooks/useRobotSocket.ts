'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { PingMessage, PongMessage, LogEntry, TelemetryMessage, VisionFrameMessage, PanoramicImageMessage } from '@/types/messages'
import useAppStore from '@/store/appStore'

// Singleton WebSocket manager to persist across page navigation
let globalSocket: WebSocket | null = null
let globalRobotId: string | null = null

interface UseRobotSocketReturn {
  isConnected: boolean
  logs: LogEntry[]
  lastMessage: any
  latestVisionFrame: VisionFrameMessage | null
  latestPanoramicImage: PanoramicImageMessage | null
  connect: () => void
  disconnect: () => void
  send: (data: any) => void
  ping: () => void
  clearLogs: () => void
  clearPanoramicImage: () => void
}

export const useRobotSocket = (robotId: string | null): UseRobotSocketReturn => {
  const socketRef = useRef<WebSocket | null>(globalSocket)
  const [isConnected, setIsConnected] = useState(false)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [lastMessage, setLastMessage] = useState<any>(null)
  const [latestVisionFrame, setLatestVisionFrame] = useState<VisionFrameMessage | null>(null)
  const [latestPanoramicImage, setLatestPanoramicImage] = useState<PanoramicImageMessage | null>(null)
  const pendingPingsRef = useRef<Map<number, number>>(new Map())
  
  const { updateRobotStatus, updateRobotBattery, setWsConnected } = useAppStore()

  // Store state setters in refs so they can be accessed from the global message handler
  const setLatestVisionFrameRef = useRef(setLatestVisionFrame)
  const setLatestPanoramicImageRef = useRef(setLatestPanoramicImage)
  const setLastMessageRef = useRef(setLastMessage)
  const addLogRef = useRef<(message: string, type?: LogEntry['type']) => void>(() => {})

  useEffect(() => {
    setLatestVisionFrameRef.current = setLatestVisionFrame
    setLatestPanoramicImageRef.current = setLatestPanoramicImage
    setLastMessageRef.current = setLastMessage
  })

  const addLog = useCallback((message: string, type: LogEntry['type'] = 'info') => {
    const logEntry: LogEntry = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      message,
      type,
    }
    setLogs(prev => [...prev, logEntry].slice(-50)) // Keep only last 50 logs
  }, [])

  useEffect(() => {
    addLogRef.current = addLog
  }, [addLog])

  // Setup message handler for global socket
  useEffect(() => {
    if (!globalSocket || !robotId) return

    const handleMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data)
        setLastMessageRef.current(data)
        
        if (data.type === 'pong' && data.robotId === robotId) {
          // Robot is online - it responded to ping
          updateRobotStatus(robotId, true)
          const sentTime = pendingPingsRef.current.get(data.timestamp)
          if (sentTime) {
            const roundTripTime = Date.now() - sentTime
            addLogRef.current?.(`Ping: ${roundTripTime}ms`, 'success')
            pendingPingsRef.current.delete(data.timestamp)
          } else {
            addLogRef.current?.('Received pong response', 'info')
          }
        } else if (data.type === 'telemetry' && data.robotId === robotId) {
          // Handle telemetry data - robot is online
          updateRobotStatus(robotId, true)
          if (data.payload?.battery !== undefined) {
            updateRobotBattery(robotId, data.payload.battery)
            addLogRef.current?.(`Battery: ${data.payload.battery}%`, 'info')
          }
        } else if (data.type === 'vision_frame' && data.robotId === robotId) {
          // Handle vision frame - robot is online (no logging to reduce spam)
          updateRobotStatus(robotId, true)
          setLatestVisionFrameRef.current(data)
        } else if (data.type === 'panoramic_image' && data.robotId === robotId) {
          // Handle panoramic image
          setLatestPanoramicImageRef.current(data)
          addLogRef.current?.('Panoramic image received', 'success')
        } else if (data.type === 'error' && data.robotId === robotId) {
          // Robot is offline - error response received
          updateRobotStatus(robotId, false)
          addLogRef.current?.(`Robot error: ${data.payload?.message || 'Unknown error'}`, 'error')
        } else {
          addLogRef.current?.(`Received: ${JSON.stringify(data)}`, 'info')
        }
      } catch (error) {
        addLogRef.current?.(`Received: ${event.data}`, 'info')
      }
    }

    globalSocket.addEventListener('message', handleMessage)
    
    return () => {
      globalSocket?.removeEventListener('message', handleMessage)
    }
  }, [robotId, updateRobotStatus, updateRobotBattery])

  const connect = useCallback(() => {
    if (!robotId) {
      addLog('No robot selected', 'error')
      return
    }

    // If already connected to the same robot, reuse the connection
    if (globalSocket?.readyState === WebSocket.OPEN && globalRobotId === robotId) {
      socketRef.current = globalSocket
      setIsConnected(true)
      addLog('Using existing connection', 'info')
      return
    }

    // Close existing connection if connecting to a different robot
    if (globalSocket && globalRobotId !== robotId) {
      globalSocket.close()
      globalSocket = null
    }

    try {
      const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:5000/ws'
      const url = `${wsUrl}?robotId=${robotId}`
      
      addLog(`Connecting to ${url}...`, 'info')
      globalSocket = new WebSocket(url)
      globalRobotId = robotId
      socketRef.current = globalSocket

      globalSocket.onopen = () => {
        setIsConnected(true)
        setWsConnected(true)
        addLog('WebSocket connected', 'success')
        // Don't set robot online yet - wait for pong response
        if (robotId) {
          updateRobotStatus(robotId, false)
        }
      }

      globalSocket.onclose = (event) => {
        setIsConnected(false)
        setWsConnected(false)
        setLatestVisionFrame(null)
        if (robotId) {
          updateRobotStatus(robotId, false)
        }
        if (event.wasClean) {
          addLog('WebSocket disconnected', 'info')
        } else {
          addLog(`WebSocket connection lost (code: ${event.code})`, 'error')
        }
        globalSocket = null
        globalRobotId = null
      }

      globalSocket.onerror = (error) => {
        addLog('WebSocket error occurred', 'error')
        setLatestVisionFrame(null)
        if (robotId) {
          updateRobotStatus(robotId, false)
        }
      }

      // Message handling is done via addEventListener in useEffect

    } catch (error) {
      addLog(`Connection failed: ${error}`, 'error')
    }
  }, [robotId, addLog, updateRobotStatus, setWsConnected])

  const disconnect = useCallback(() => {
    if (globalSocket) {
      globalSocket.close()
      globalSocket = null
      globalRobotId = null
    }
    if (socketRef.current) {
      socketRef.current = null
      setIsConnected(false)
      setWsConnected(false)
      setLatestVisionFrame(null)
      if (robotId) {
        updateRobotStatus(robotId, false)
      }
      // Clear all pending pings
      pendingPingsRef.current.clear()
      addLog('Disconnected', 'info')
    }
  }, [addLog, robotId, updateRobotStatus, setWsConnected])

  const send = useCallback((data: any) => {
    const socket = globalSocket || socketRef.current
    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(data))
      addLog(`Sent: ${JSON.stringify(data)}`, 'info')
    } else {
      addLog('Not connected - cannot send message', 'error')
    }
  }, [addLog])

  const ping = useCallback(() => {
    if (!robotId) {
      addLog('No robot selected', 'error')
      return
    }

    const socket = globalSocket || socketRef.current
    if (socket?.readyState === WebSocket.OPEN) {
      const timestamp = Date.now()
      const pingMessage: PingMessage = {
        type: 'ping',
        robotId,
        timestamp,
      }
      
      pendingPingsRef.current.set(timestamp, timestamp)
      send(pingMessage)
      
      // Clean up old pending pings after 10 seconds and mark robot offline
      setTimeout(() => {
        if (pendingPingsRef.current.has(timestamp)) {
          pendingPingsRef.current.delete(timestamp)
          addLog('Ping timeout - no response received', 'error')
          // Mark robot as offline due to timeout
          if (robotId) {
            updateRobotStatus(robotId, false)
          }
        }
      }, 10000)
    } else {
      addLog('Ping failed – backend not available', 'error')
    }
  }, [robotId, send, addLog, updateRobotStatus])

  const clearLogs = useCallback(() => {
    setLogs([])
  }, [])

  const clearPanoramicImage = useCallback(() => {
    setLatestPanoramicImage(null)
  }, [])

  // Sync state with global socket on mount
  useEffect(() => {
    if (globalSocket?.readyState === WebSocket.OPEN && globalRobotId === robotId) {
      socketRef.current = globalSocket
      setIsConnected(true)
      setWsConnected(true)
      
      // Ping the robot to update its online status
      if (robotId) {
        const timestamp = Date.now()
        const pingMessage: PingMessage = {
          type: 'ping',
          robotId,
          timestamp,
        }
        globalSocket.send(JSON.stringify(pingMessage))
      }
    }
  }, [robotId, setWsConnected])

  // Don't cleanup on unmount - keep connection persistent
  // Only disconnect when explicitly called or when changing robots

  return {
    isConnected,
    logs,
    lastMessage,
    latestVisionFrame,
    latestPanoramicImage,
    connect,
    disconnect,
    send,
    ping,
    clearLogs,
    clearPanoramicImage,
  }
}