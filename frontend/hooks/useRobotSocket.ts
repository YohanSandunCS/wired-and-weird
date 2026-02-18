'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { PingMessage, PongMessage, LogEntry, TelemetryMessage, VisionFrameMessage, PanoramicImageMessage } from '@/types/messages'
import useAppStore from '@/store/appStore'

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
  const socketRef = useRef<WebSocket | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [lastMessage, setLastMessage] = useState<any>(null)
  const [latestVisionFrame, setLatestVisionFrame] = useState<VisionFrameMessage | null>(null)
  const [latestPanoramicImage, setLatestPanoramicImage] = useState<PanoramicImageMessage | null>(null)
  const pendingPingsRef = useRef<Map<number, number>>(new Map())
  
  const { updateRobotStatus, updateRobotBattery } = useAppStore()

  const addLog = useCallback((message: string, type: LogEntry['type'] = 'info') => {
    const logEntry: LogEntry = {
      id: Date.now().toString(),
      timestamp: Date.now(),
      message,
      type,
    }
    setLogs(prev => [...prev, logEntry].slice(-50)) // Keep only last 50 logs
  }, [])

  const connect = useCallback(() => {
    if (!robotId) {
      addLog('No robot selected', 'error')
      return
    }

    if (socketRef.current?.readyState === WebSocket.OPEN) {
      addLog('Already connected', 'info')
      return
    }

    try {
      const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:5000/ws'
      const url = `${wsUrl}?robotId=${robotId}`
      
      addLog(`Connecting to ${url}...`, 'info')
      socketRef.current = new WebSocket(url)

      socketRef.current.onopen = () => {
        setIsConnected(true)
        addLog('WebSocket connected', 'success')
        // Don't set robot online yet - wait for pong response
        if (robotId) {
          updateRobotStatus(robotId, false)
        }
      }

      socketRef.current.onclose = (event) => {
        setIsConnected(false)
        setLatestVisionFrame(null)
        if (robotId) {
          updateRobotStatus(robotId, false)
        }
        if (event.wasClean) {
          addLog('WebSocket disconnected', 'info')
        } else {
          addLog(`WebSocket connection lost (code: ${event.code})`, 'error')
        }
      }

      socketRef.current.onerror = (error) => {
        addLog('WebSocket error occurred', 'error')
        setLatestVisionFrame(null)
        if (robotId) {
          updateRobotStatus(robotId, false)
        }
      }

      socketRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          setLastMessage(data)
          
          if (data.type === 'pong' && data.robotId === robotId) {
            // Robot is online - it responded to ping
            if (robotId) {
              updateRobotStatus(robotId, true)
            }
            const sentTime = pendingPingsRef.current.get(data.timestamp)
            if (sentTime) {
              const roundTripTime = Date.now() - sentTime
              addLog(`Ping: ${roundTripTime}ms`, 'success')
              pendingPingsRef.current.delete(data.timestamp)
            } else {
              addLog('Received pong response', 'info')
            }
          } else if (data.type === 'telemetry' && data.robotId === robotId) {
            // Handle telemetry data
            if (robotId && data.payload?.battery !== undefined) {
              updateRobotBattery(robotId, data.payload.battery)
              addLog(`Battery: ${data.payload.battery}%`, 'info')
            }
          } else if (data.type === 'vision_frame' && data.robotId === robotId) {
            // Handle vision frame (no logging to reduce spam)
            setLatestVisionFrame(data)
          } else if (data.type === 'panoramic_image' && data.robotId === robotId) {
            // Handle panoramic image
            setLatestPanoramicImage(data)
            addLog('Panoramic image received', 'success')
          } else if (data.type === 'error' && data.robotId === robotId) {
            // Robot is offline - error response received
            if (robotId) {
              updateRobotStatus(robotId, false)
            }
            addLog(`Robot error: ${data.payload?.message || 'Unknown error'}`, 'error')
          } else {
            addLog(`Received: ${JSON.stringify(data)}`, 'info')
          }
        } catch (error) {
          addLog(`Received: ${event.data}`, 'info')
        }
      }

    } catch (error) {
      addLog(`Connection failed: ${error}`, 'error')
    }
  }, [robotId, addLog, updateRobotStatus, updateRobotBattery])

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.close()
      socketRef.current = null
      setIsConnected(false)
      setLatestVisionFrame(null)
      if (robotId) {
        updateRobotStatus(robotId, false)
      }
      // Clear all pending pings
      pendingPingsRef.current.clear()
      addLog('Disconnected', 'info')
    }
  }, [robotId, addLog, updateRobotStatus])

  const send = useCallback((data: any) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(data))
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

    if (socketRef.current?.readyState === WebSocket.OPEN) {
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

  // Cleanup on unmount or robotId change
  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.close()
      }
    }
  }, [])

  // Disconnect when robotId changes
  useEffect(() => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      disconnect()
    }
  }, [robotId, disconnect])

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