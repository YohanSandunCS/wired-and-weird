'use client'

import medicalItems from '@/data/medical-items.json'
import { useMemo, useRef, useState, useEffect } from 'react'
import jsQR from 'jsqr'
import { BrowserMultiFormatReader, BarcodeFormat, DecodeHintType, Result, NotFoundException } from '@zxing/library'

type MedicalItem = {
  patientName: string
  fodselsnummer: string
  accessionNo: string
  sampleId: string
  testType: string
  container: string
  wardUnit: string
  destination: string
  priority: string
  collectionTime: string
  qr: string
  weightGrams: number
}

type LogLevel = 'info' | 'warn' | 'error' | 'success'
type LogEntry = { id: number; ts: number; level: LogLevel; message: string }

export default function RobotMedicalItemLoadUnload({ isLoadMode = true }: { isLoadMode?: boolean }) {
  // Memoize to avoid re-processing on re-render
  const allItems: MedicalItem[] = useMemo(() => medicalItems as MedicalItem[], [])
  const [loadedItems, setLoadedItems] = useState<MedicalItem[]>([])
  const [lastScanned, setLastScanned] = useState<string | null>(null)
  const [scanError, setScanError] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [hasStream, setHasStream] = useState(false)
  const streamRef = useRef<MediaStream | null>(null)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const logsCounterRef = useRef(0)
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const frameCounterRef = useRef(0)
  const skippedCounterRef = useRef(0)
  const SCAN_INTERVAL_MS = 200
  const LOG_EVERY_FRAMES = 5 // throttle "no code" logs
  const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null)
  const heartbeatRef = useRef<number | null>(null)
  const usingZxingRef = useRef(false)
  const [showLogs, setShowLogs] = useState(false)
  const [lastAddedQr, setLastAddedQr] = useState<string | null>(null)
  const [flashQr, setFlashQr] = useState<string | null>(null)
  const flashLastDetectedAtRef = useRef<number | null>(null)
  const flashCleanupIntervalRef = useRef<number | null>(null)
  const scanningStartedRef = useRef(false)
  // Title/switch moved to parent page; local mode state no longer used.
  const [deliveredQrs, setDeliveredQrs] = useState<string[]>([])
  const [tempC, setTempC] = useState<number>(14)
  const [tempHistory, setTempHistory] = useState<number[]>([])
  const tempIntervalRef = useRef<number | null>(null)
  const dangerZoneIntervalRef = useRef<number | null>(null)

  // Helper first to avoid temporal dead zone
  function randInRange(min: number, max: number) {
    return Math.random() * (max - min) + min
  }

  // Regenerate thermometer/graph data on mode change
  useEffect(() => {
    // --- Helper for danger zone logic ---
    const enterDangerZone = () => {
      const goHigh = Math.random() > 0.5
      const dangerTarget = goHigh ? randInRange(7, 9) : randInRange(1, 3)
      
      // Temporarily override the main interval to move towards the danger temp
      setTempC(prev => {
        const delta = dangerTarget - prev
        const step = delta * 0.2 // Move 20% of the way there
        return parseFloat((prev + step).toFixed(1))
      })
      
      // Schedule the next danger event
      const nextDangerInterval = randInRange(12000, 24000)
      if (dangerZoneIntervalRef.current) clearTimeout(dangerZoneIntervalRef.current)
      dangerZoneIntervalRef.current = window.setTimeout(enterDangerZone, nextDangerInterval)
    }

    // --- Main Effect Logic ---
    if (tempIntervalRef.current) window.clearInterval(tempIntervalRef.current)
    if (dangerZoneIntervalRef.current) clearTimeout(dangerZoneIntervalRef.current)
    tempIntervalRef.current = null
    dangerZoneIntervalRef.current = null

    if (isLoadMode) {
      // Live thermometer: random within 2-8 with gentle transitions
      tempIntervalRef.current = window.setInterval(() => {
        setTempC(prev => {
          const target = randInRange(2, 8)
          const delta = target - prev
          const step = Math.max(Math.min(delta, 0.5), -0.5) // Slower transitions
          const next = Math.max(2, Math.min(8, prev + step))
          return parseFloat(next.toFixed(1))
        })
      }, 1500)

      // Start the first danger zone event after a delay
      const firstDangerInterval = randInRange(12000, 24000)
      dangerZoneIntervalRef.current = window.setTimeout(enterDangerZone, firstDangerInterval)

    } else {
      // Unload: precomputed 10-minute history (one value per 10s => 60 points)
      const points: number[] = []
      let current = randInRange(2, 8)
      for (let i = 0; i < 60; i++) {
        const target = randInRange(2, 8)
        const delta = target - current
        const step = Math.max(Math.min(delta, 0.4), -0.4)
        current = Math.max(2, Math.min(8, current + step))
        points.push(parseFloat(current.toFixed(1)))
      }
      // Defer state updates to avoid synchronous setState in effect
      setTimeout(() => {
        setTempHistory(points)
        setTempC(points[points.length - 1])
      }, 0)
    }
    return () => {
      if (tempIntervalRef.current) {
        window.clearInterval(tempIntervalRef.current)
        tempIntervalRef.current = null
      }
      if (dangerZoneIntervalRef.current) {
        clearTimeout(dangerZoneIntervalRef.current)
        dangerZoneIntervalRef.current = null
      }
    }
  }, [isLoadMode])

  

  function handleDeleteItem(qr: string) {
    if (!isLoadMode) return
    setLoadedItems(prev => prev.filter(p => p.qr !== qr))
    if (lastAddedQr === qr) setLastAddedQr(null)
    if (flashQr === qr) setFlashQr(null)
    pushLog('Item removed (qr=' + qr + ')', 'warn')
  }

  function markDelivered(qr: string, sampleId: string) {
    setDeliveredQrs(prev => {
      if (prev.includes(qr)) {
        pushLog('Already delivered: ' + sampleId, 'info')
        return prev
      }
      pushLog('Item delivered: ' + sampleId, 'success')
      return [...prev, qr]
    })
  }

  // Clear flash after short duration
  useEffect(() => {
    if (flashQr) {
      // (Timer removed; we now clear based on stale time in interval)
    }
  }, [flashQr])

  // Start interval to clear flash when stale
  useEffect(() => {
    if (isLoading && !flashCleanupIntervalRef.current) {
      flashCleanupIntervalRef.current = window.setInterval(() => {
        if (flashQr && flashLastDetectedAtRef.current) {
          const age = Date.now() - flashLastDetectedAtRef.current
          if (age > 400) { // > 400ms since last duplicate detection
            setFlashQr(null)
            flashLastDetectedAtRef.current = null
          }
        }
      }, 150)
    }
    if (!isLoading && flashCleanupIntervalRef.current) {
      window.clearInterval(flashCleanupIntervalRef.current)
      flashCleanupIntervalRef.current = null
    }
    return () => {
      if (flashCleanupIntervalRef.current) {
        window.clearInterval(flashCleanupIntervalRef.current)
        flashCleanupIntervalRef.current = null
      }
    }
  }, [isLoading, flashQr])

  function pushLog(message: string, level: LogLevel) {
    const id = ++logsCounterRef.current
    setLogs(prev => {
      const next = [...prev, { id, ts: Date.now(), level, message }]
      if (next.length > 200) next.splice(0, next.length - 200) // cap size
      return next
    })
  }

  // Cleanup stream on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
        streamRef.current = null
      }
    }
  }, [])

  async function handleStart() {
    if (isLoading) return
    setIsLoading(true)
    pushLog('Loading started. Awaiting QR code...', 'info')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: { ideal: 'environment' }
        }
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.onloadedmetadata = () => {
          const vw = videoRef.current?.videoWidth || 0
          const vh = videoRef.current?.videoHeight || 0
          pushLog(`Video stream ready (${vw}x${vh}). Starting scan loop.`, 'info')
          if (videoRef.current && videoRef.current.paused) {
            videoRef.current.play().catch(err => console.warn('Video play failed', err))
          }
          // Remove handler to avoid repeated triggers
          if (videoRef.current) videoRef.current.onloadedmetadata = null
          startScanningLoop()
        }
      }
      setHasStream(true)
    } catch (err) {
      console.error('Failed to start camera stream:', err)
      pushLog('Camera start failed: ' + (err instanceof Error ? err.message : 'Unknown error'), 'error')
      setIsLoading(false)
    }
  }

  function handleStop() {
    if (!isLoading) return
    setIsLoading(false)
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setHasStream(false)
    stopScanningLoop()
    pushLog('Loading stopped.', 'info')
  }

  // Scanning logic
  const scanCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const scanCtxRef = useRef<CanvasRenderingContext2D | null>(null)
  const scanIntervalRef = useRef<number | null>(null)

  function ensureCanvas() {
    if (!scanCanvasRef.current) {
      const c = document.createElement('canvas')
      scanCanvasRef.current = c
      scanCtxRef.current = c.getContext('2d', { willReadFrequently: true })
    }
  }

  function startScanningLoop() {
    if (scanningStartedRef.current) {
      pushLog('Scan loop already active; skipping re-init.', 'info')
      return
    }
    scanningStartedRef.current = true
    // Attempt ZXing first
    try {
      const hints = new Map()
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.QR_CODE])
      hints.set(DecodeHintType.TRY_HARDER, true)
      const reader = new BrowserMultiFormatReader(hints)
      codeReaderRef.current = reader
      usingZxingRef.current = true
      pushLog('ZXing initialized. Starting continuous decode.', 'info')
      // Prefer the currently selected deviceId to avoid re-selection flicker
      let deviceId: string | null = null
      try {
        const track = streamRef.current?.getVideoTracks()[0]
        const settings = track?.getSettings()
        if (settings && settings.deviceId) deviceId = settings.deviceId as string
      } catch {}
      reader.decodeFromVideoDevice(deviceId, videoRef.current!, (result: Result | undefined, err: unknown) => {
        if (result) {
          handleZxingResult(result)
        } else if (err && !(err instanceof NotFoundException)) {
          const msg = err instanceof Error ? err.message : 'Unknown'
          pushLog('ZXing error: ' + msg, 'warn')
        }
      })
      startHeartbeat()
      return
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown'
      pushLog('ZXing init failed, falling back to jsQR: ' + msg, 'error')
      usingZxingRef.current = false
    }
    // Fallback jsQR interval scanning
    ensureCanvas()
    if (scanIntervalRef.current) return
    pushLog('Fallback jsQR scan loop started.', 'info')
    pushLog(`Scan interval: ${SCAN_INTERVAL_MS}ms; logging every ${LOG_EVERY_FRAMES} frames without code.`, 'info')
    scanIntervalRef.current = window.setInterval(() => {
      tryScanFrame()
    }, SCAN_INTERVAL_MS)
    startHeartbeat()
  }

  function stopScanningLoop() {
    if (scanIntervalRef.current) {
      window.clearInterval(scanIntervalRef.current)
      scanIntervalRef.current = null
    }
    if (codeReaderRef.current) {
      try { codeReaderRef.current.reset() } catch {}
      codeReaderRef.current = null
    }
    if (heartbeatRef.current) {
      window.clearInterval(heartbeatRef.current)
      heartbeatRef.current = null
    }
    scanningStartedRef.current = false
  }

  function startHeartbeat() {
    if (heartbeatRef.current) return
    heartbeatRef.current = window.setInterval(() => {
      pushLog('Heartbeat: scanning active.', 'info')
    }, 5000)
  }

  function handleZxingResult(result: Result) {
    const raw = result.getText().trim()
    setLastScanned(raw)
    setScanError(null)
    pushLog(`ZXing QR detected: ${raw}`, 'success')
    drawZxingOverlay(result)
    const match = allItems.find(mi => mi.qr === raw)
    if (!match) {
      pushLog((isLoadMode ? 'QR not recognized in inventory: ' : 'Cannot deliver (not loaded): ') + raw, 'warn')
      return
    }
    if (isLoadMode) {
      setLoadedItems(prev => {
        const already = prev.some(p => p.qr === match.qr)
        if (already) {
          pushLog('QR already loaded: ' + raw, 'info')
          setLastAddedQr(match.qr)
          setFlashQr(match.qr)
          flashLastDetectedAtRef.current = Date.now()
          return prev
        }
        pushLog('Item loaded: ' + match.sampleId, 'success')
        const next = [...prev, match]
        setLastAddedQr(match.qr)
        setFlashQr(null)
        flashLastDetectedAtRef.current = null
        return next
      })
    } else {
      // Unload mode: only mark delivered if it exists among loaded items
      const exists = loadedItems.some(p => p.qr === match.qr)
      if (!exists) {
        pushLog('Cannot deliver (item not onboard): ' + raw, 'warn')
        return
      }
      markDelivered(match.qr, match.sampleId)
    }
  }

  function drawZxingOverlay(result: Result) {
    const points = result.getResultPoints()
    const video = videoRef.current
    const oCanvas = overlayCanvasRef.current
    if (!points || points.length === 0 || !video || !oCanvas) return
    const w = video.videoWidth
    const h = video.videoHeight
    oCanvas.width = w
    oCanvas.height = h
    const octx = oCanvas.getContext('2d')
    if (!octx) return
    octx.clearRect(0, 0, w, h)
    octx.strokeStyle = '#22c55e'
    octx.lineWidth = 3
    octx.beginPath()
    points.forEach((p, i) => {
      const x = p.getX(); const y = p.getY()
      if (i === 0) octx.moveTo(x, y)
      else octx.lineTo(x, y)
    })
    octx.closePath()
    octx.stroke()
    points.forEach(p => {
      octx.fillStyle = '#22c55e'
      octx.beginPath()
      octx.arc(p.getX(), p.getY(), 4, 0, Math.PI * 2)
      octx.fill()
    })
  }

  function tryScanFrame() {
    if (!videoRef.current || !hasStream || !isLoading) return
    const video = videoRef.current
    if (video.readyState !== HTMLMediaElement.HAVE_ENOUGH_DATA) {
      // Throttle skipped logs to avoid spam
      skippedCounterRef.current++
      if (skippedCounterRef.current % LOG_EVERY_FRAMES === 0) {
        pushLog(`Frame skipped (not ready). Total skipped: ${skippedCounterRef.current}`, 'info')
      }
      return
    }
    ensureCanvas()
    const canvas = scanCanvasRef.current!
    const ctx = scanCtxRef.current!
    const w = video.videoWidth || 256
    const h = video.videoHeight || 144
    canvas.width = w
    canvas.height = h
    ctx.drawImage(video, 0, 0, w, h)
    const imageData = ctx.getImageData(0, 0, w, h)
    try {
      const code = jsQR(imageData.data, imageData.width, imageData.height, { inversionAttempts: 'dontInvert' })
      const decodeMs = 0
      if (code && code.data) {
        const raw = code.data.trim()
        setLastScanned(raw)
        setScanError(null)
        pushLog(`QR detected (frame ${frameCounterRef.current + 1}) in ${decodeMs}ms: ${raw}`, 'success')
        // Draw bounding box overlay
        const oCanvas = overlayCanvasRef.current
        if (oCanvas) {
          oCanvas.width = w
          oCanvas.height = h
          const octx = oCanvas.getContext('2d')
          if (octx) {
            octx.clearRect(0, 0, w, h)
            const loc = code.location
            octx.strokeStyle = '#22c55e'
            octx.lineWidth = 3
            octx.beginPath()
            octx.moveTo(loc.topLeftCorner.x, loc.topLeftCorner.y)
            octx.lineTo(loc.topRightCorner.x, loc.topRightCorner.y)
            octx.lineTo(loc.bottomRightCorner.x, loc.bottomRightCorner.y)
            octx.lineTo(loc.bottomLeftCorner.x, loc.bottomLeftCorner.y)
            octx.closePath()
            octx.stroke()
          }
        }
        // Match against items
        const match = allItems.find(mi => mi.qr === raw)
        if (!match) {
          pushLog((isLoadMode ? 'QR not recognized in inventory: ' : 'Cannot deliver (not loaded): ') + raw, 'warn')
        } else if (isLoadMode) {
          setLoadedItems(prev => {
            const already = prev.some(p => p.qr === match.qr)
            if (already) {
              pushLog('QR already loaded: ' + raw, 'info')
              setLastAddedQr(match.qr)
              setFlashQr(match.qr)
              flashLastDetectedAtRef.current = Date.now()
              return prev
            }
            pushLog('Item loaded: ' + match.sampleId, 'success')
            const next = [...prev, match]
            setLastAddedQr(match.qr)
            setFlashQr(null)
            flashLastDetectedAtRef.current = null
            return next
          })
        } else {
          const exists = loadedItems.some(p => p.qr === match.qr)
          if (!exists) {
            pushLog('Cannot deliver (item not onboard): ' + raw, 'warn')
          } else {
            markDelivered(match.qr, match.sampleId)
          }
        }
        frameCounterRef.current++
      } else {
        frameCounterRef.current++
        if (frameCounterRef.current % LOG_EVERY_FRAMES === 0) {
          pushLog(`Attempt ${frameCounterRef.current}: no QR (decode ${decodeMs}ms)`, 'info')
        }
        // Clear overlay if present
        const oCanvas = overlayCanvasRef.current
        if (oCanvas) {
          const octx = oCanvas.getContext('2d')
          const w2 = oCanvas.width
          const h2 = oCanvas.height
          octx?.clearRect(0, 0, w2, h2)
        }
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'QR decode error'
      setScanError(msg)
      pushLog('Decode error: ' + msg, 'error')
    }
  }

  const totalWeight = useMemo(() => loadedItems.reduce((sum, item) => sum + item.weightGrams, 0), [loadedItems])

  return (
    <div className="bg-white rounded-lg shadow p-6">
      {/* Top section: Controls/Video on left, Thermo on right */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Left: Loading Controls */}
        <div className="flex flex-col sm:flex-row gap-4 items-start">
          <div className="relative w-[256px] h-[144px] bg-gray-200 border border-gray-300 rounded overflow-hidden">
            <video
              ref={videoRef}
              className={`w-full h-full object-cover ${hasStream ? 'block' : 'hidden'}`}
              width={256}
              height={144}
              muted
              playsInline
            />
            <canvas
              ref={overlayCanvasRef}
              className={`absolute inset-0 w-full h-full pointer-events-none ${hasStream ? 'block' : 'hidden'}`}
            />
            {!hasStream && (
              <div className="absolute inset-0 flex items-center justify-center text-gray-500">
                No video feed
              </div>
            )}
          </div>
          <div className="flex flex-row sm:flex-col gap-3">
            <button
              type="button"
              onClick={handleStart}
              disabled={isLoading}
              className="px-4 py-2 rounded-md text-white font-semibold bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 transition"
            >
              Start Loading
            </button>
            <button
              type="button"
              onClick={handleStop}
              disabled={!isLoading}
              className="px-4 py-2 rounded-md text-white font-semibold bg-red-600 hover:bg-red-700 disabled:bg-gray-400 transition"
            >
              Stop Loading
            </button>
          </div>
        </div>
        {/* Right: Thermometer/Graph */}
        <ThermoView isLoadMode={isLoadMode} tempC={tempC} history={tempHistory} totalWeight={totalWeight} />
      </div>

      {/* Main content below */}
      <StatusBar lastScanned={lastScanned} loadedCount={loadedItems.length} error={scanError} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {loadedItems.length === 0 && (
          <div className="text-gray-500 italic py-4 col-span-full">
            No items loaded yet. Start scanning to add items.
          </div>
        )}
        {loadedItems.map(item => (
          <Card
            key={item.sampleId}
            item={item}
            lastAddedQr={lastAddedQr}
            flashQr={flashQr}
            delivered={deliveredQrs.includes(item.qr)}
            isLoadMode={isLoadMode}
            onDelete={() => handleDeleteItem(item.qr)}
          />
        ))}
      </div>
      <p className="text-xs text-gray-500 mt-4">
        Loaded items: {loadedItems.length} / {allItems.length}. Unique matches only.
      </p>
      
      <LogPanel logs={logs} showLogs={showLogs} onToggle={() => setShowLogs((s: boolean) => !s)} />
    </div>
  )
}

function ThermoView({ isLoadMode, tempC, history, totalWeight }: { isLoadMode: boolean; tempC: number; history: number[]; totalWeight: number }) {
  // Calculates a color from green to red based on temperature deviation from the ideal range.
  function getTempColor(temp: number): string {
    const ideal = 5
    const safeMin = 2, safeMax = 8
    const dangerMin = 0, dangerMax = 10

    // Clamp temp within the danger zone for color calculation
    const clampedTemp = Math.max(dangerMin, Math.min(dangerMax, temp))

    let hue: number
    if (clampedTemp >= safeMin && clampedTemp <= safeMax) {
      // Inside safe zone (2-8C): Transition from yellow (60) to green (120) and back to yellow.
      const range = (safeMax - safeMin) / 2
      const distFromIdeal = Math.abs(clampedTemp - ideal)
      // 120 (green) at ideal, 60 (yellow) at edges of safe zone
      hue = 120 - (distFromIdeal / range) * 60
    } else if (clampedTemp < safeMin) {
      // Below safe zone (0-2C): Transition from yellow (60) to red (0).
      const range = safeMin - dangerMin
      const distFromSafe = safeMin - clampedTemp
      hue = 60 - (distFromSafe / range) * 60
    } else { // temp > safeMax
      // Above safe zone (8-10C): Transition from yellow (60) to red (0).
      const range = dangerMax - safeMax
      const distFromSafe = clampedTemp - safeMax
      hue = 60 - (distFromSafe / range) * 60
    }

    hue = Math.max(0, Math.min(120, hue))
    return `hsl(${hue}, 90%, 50%)`
  }

  function getWeightColor(weight: number): string {
    const maxWeight = 500
    const t = Math.min(1, weight / maxWeight)
    const hue = 210 - t * 60 // Blue (210) to purple (150)
    return `hsl(${hue}, 80%, 60%)`
  }

  if (isLoadMode) {
    const tempMinAxis = 0, tempMaxAxis = 10
    const weightMinAxis = 0, weightMaxAxis = 500
    const w = 220, h = 120 // Reduced width from 480 to 220
    const graphAreaY = 16
    const graphAreaHeight = h - 32

    // Temperature bar logic
    const tempT = Math.max(0, Math.min(1, (tempC - tempMinAxis) / (tempMaxAxis - tempMinAxis)))
    const tempMaskHeight = (1 - tempT) * graphAreaHeight

    // Weight bar logic
    const weightT = Math.max(0, Math.min(1, totalWeight / weightMaxAxis))
    const weightMaskHeight = (1 - weightT) * graphAreaHeight

    return (
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-600">Payload Temperature</span>
          <span className="text-sm text-gray-600">Total Weight</span>
        </div>
        <div className="bg-gray-100 rounded p-2 flex gap-4" style={{ gap: '92px', paddingLeft: '24px', paddingRight: '24px' }}>
          {/* Temperature Bar */}
          <div className="relative block" style={{ width: w, height: h }}>
            {/* 1. The full-height colored bar (bottom layer) */}
            <div
              className="absolute"
              style={{
                left: 32,
                right: 0, // Adjusted for new width
                top: graphAreaY,
                height: graphAreaHeight,
                backgroundColor: getTempColor(tempC),
                borderRadius: '4px',
                transition: 'background-color 0.5s ease',
              }}
            >
              {/* 3a. The white label, stationary inside the colored bar */}
              <div className="relative w-full h-full flex items-center justify-center">
                <span className="text-3xl font-bold text-white">{tempC.toFixed(1)}°C</span>
              </div>
            </div>

            {/* 2. The "mask" that covers the bar from the top (middle layer) */}
            <div
              className="absolute overflow-hidden"
              style={{
                left: 32,
                right: 0, // Adjusted for new width
                top: graphAreaY,
                height: `${tempMaskHeight}px`,
                backgroundColor: '#f3f4f6', // Same as SVG background
                transition: 'height 0.5s ease',
                borderTopLeftRadius: '4px',
                borderTopRightRadius: '4px',
              }}
            >
              {/* 3b. The gray label, stationary inside the mask */}
              <div className="relative w-full h-full flex justify-center">
                <span className="absolute text-3xl font-bold text-gray-400" style={{ top: '25px' }}>
                  {tempC.toFixed(1)}°C
                </span>
              </div>
            </div>

            {/* 4. SVG for axes and labels (top layer) */}
            <svg width={w} height={h} className="absolute inset-0 pointer-events-none">
              {/* Y-Axis Labels */}
              <text x={24} y={20} textAnchor="end" className="text-xs fill-gray-500">
                {tempMaxAxis}°C
              </text>
              <text x={24} y={h - 16} textAnchor="end" className="text-xs fill-gray-500">
                {tempMinAxis}°C
              </text>
              {/* Axis Lines */}
              <line x1={32} y1={16} x2={32} y2={h - 16} stroke="#cccccc" strokeWidth={2} />
            </svg>
          </div>
          {/* Weight Bar */}
          <div className="relative block" style={{ width: w, height: h }}>
            {/* 1. The full-height colored bar (bottom layer) */}
            <div
              className="absolute"
              style={{
                left: 0,
                right: 32,
                top: graphAreaY,
                height: graphAreaHeight,
                backgroundColor: getWeightColor(totalWeight),
                borderRadius: '4px',
                transition: 'background-color 0.5s ease',
              }}
            >
              {/* 3a. The white label, stationary inside the colored bar */}
              <div className="relative w-full h-full flex items-center justify-center">
                <span className="text-3xl font-bold text-white">{totalWeight.toFixed(0)}g</span>
              </div>
            </div>

            {/* 2. The "mask" that covers the bar from the top (middle layer) */}
            <div
              className="absolute overflow-hidden"
              style={{
                left: 0,
                right: 32,
                top: graphAreaY,
                height: `${weightMaskHeight}px`,
                backgroundColor: '#f3f4f6', // Same as SVG background
                transition: 'height 0.5s ease',
                borderTopLeftRadius: '4px',
                borderTopRightRadius: '4px',
              }}
            >
              {/* 3b. The gray label, stationary inside the mask */}
              <div className="relative w-full h-full flex justify-center">
                <span className="absolute text-3xl font-bold text-gray-400" style={{ top: '25px' }}>
                  {totalWeight.toFixed(0)}g
                </span>
              </div>
            </div>

            {/* 4. SVG for axes and labels (top layer) */}
            <svg width={w} height={h} className="absolute inset-0 pointer-events-none">
              {/* Y-Axis Labels */}
              <text x={w - 12} y={20} textAnchor="end" className="text-xs fill-gray-500">
                {weightMaxAxis}g
              </text>
              <text x={w - 12} y={h - 16} textAnchor="end" className="text-xs fill-gray-500">
                {weightMinAxis}g
              </text>
              {/* Axis Lines */}
              <line x1={w - 48} y1={16} x2={w - 48} y2={h - 16} stroke="#cccccc" strokeWidth={2} />
            </svg>
          </div>
        </div>
      </div>
    )
  }
  // Unload: simple SVG line chart over 10 minutes (60 points, 10s step)
  const width = 468
  const height = 140
  const padding = 32
  const minAxis = 0, maxAxis = 10 // Adjusted for 2-8C range
  const xScale = (i: number) => padding + (i / Math.max(1, history.length - 1)) * (width - padding * 2)
  const yScale = (v: number) => {
    const t = (v - minAxis) / (maxAxis - minAxis)
    return padding + (1 - t) * (height - padding * 2)
  }
  const pathD = history.map((v, i) => `${i === 0 ? 'M' : 'L'}${xScale(i)},${yScale(v)}`).join(' ')
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-gray-600">Recorded Payload Temperature</span>
        <span className="text-sm font-semibold text-gray-900">Last: {tempC.toFixed(1)}°C</span>
      </div>
      <div className="bg-gray-100 rounded p-2 overflow-x-auto">
        <svg width={width} height={height} className="block">
          <rect x={0} y={0} width={width} height={height} fill="#f3f4f6" rx={8} />
          {/* Y-Axis Labels */}
          <text x={padding - 4} y={padding} textAnchor="end" dominantBaseline="middle" className="text-xs fill-gray-500">{maxAxis}°C</text>
          <text x={padding - 4} y={height - padding} textAnchor="end" dominantBaseline="middle" className="text-xs fill-gray-500">{minAxis}°C</text>
          {/* Axis Lines */}
          <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#888888" strokeWidth={2} />
          <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="#888888" strokeWidth={2} />
          <path d={pathD} stroke="#3b82f6" strokeWidth={2} fill="none" />
          {/* X-Axis Labels */}
          <text x={padding} y={height - padding + 14} textAnchor="middle" className="text-xs fill-gray-500">0 min</text>
          <text x={width - padding} y={height - padding + 14} textAnchor="middle" className="text-xs fill-gray-500">10 min</text>
        </svg>
      </div>
    </div>
  )
}

function Card({ item, lastAddedQr, flashQr, delivered, isLoadMode, onDelete }: { item: MedicalItem; lastAddedQr: string | null; flashQr: string | null; delivered: boolean; isLoadMode: boolean; onDelete: () => void }) {
  const isLast = item.qr === lastAddedQr
  const isFlash = item.qr === flashQr
  let classes = 'group rounded-md border p-4 shadow-sm bg-white transition-all '
  if (isLoadMode) {
    if (isFlash) {
      classes += 'border-blue-500 ring-2 ring-blue-400 animate-flash-fast '
    } else if (isLast) {
      classes += 'border-blue-400 ring-1 ring-blue-200 '
    } else {
      classes += 'border-gray-200 '
    }
  } else {
    if (delivered) {
      classes += 'border-green-500 ring-1 ring-green-300 '
    } else {
      classes += 'border-gray-200 '
    }
  }
  return (
    <div className={classes}>        
      <div className="flex justify-between items-start mb-2">
        <h3 className="text-sm font-semibold text-gray-900 leading-snug pr-2">
          {item.patientName}
        </h3>
        <span className={priorityBadge(item.priority)}>{item.priority}</span>
      </div>
      <dl className="space-y-1 text-xs">
        <Row label="Fødselsnr" value={item.fodselsnummer} />
        <Row label="Sample" value={item.sampleId} />
        <Row label="Test" value={item.testType} />
        <Row label="Container" value={item.container} />
        <Row label="Weight" value={`${item.weightGrams} g`} />
        <Row label="Destination" value={item.destination} />
      </dl>
      <div className="mt-3 flex justify-end">
        {isLoadMode ? (
          <button
            type="button"
            onClick={onDelete}
            className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition"
            aria-label="Remove item"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6" />
              <path d="M14 11v6" />
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
            </svg>
          </button>
        ) : delivered ? (
          <div className="flex items-center text-green-600 text-xs font-medium">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
            Delivered
          </div>
        ) : (
          <div className="h-5" />
        )}
      </div>
    </div>
  )
}

function StatusBar({ lastScanned, loadedCount, error }: { lastScanned: string | null; loadedCount: number; error: string | null }) {
  return (
    <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs">
      <div className="text-gray-600">
        Last scanned: {lastScanned ? <code className="text-blue-600">{lastScanned}</code> : '—'}
      </div>
      <div className="text-gray-600">Total loaded: <span className="font-semibold text-gray-800">{loadedCount}</span></div>
      {error && <div className="text-red-600">{error}</div>}
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-500 mr-2">{label}</span>
      <span
        className={"text-gray-800 truncate max-w-[55%] text-right " + (label === 'Destination' ? 'font-semibold' : 'font-medium')}
        title={value}
      >
        {value}
      </span>
    </div>
  )
}

// If collection time needed later, we can reintroduce formatTime utility.

function priorityBadge(priority: string) {
  const base = 'inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold'
  switch (priority.toUpperCase()) {
    case 'AKUTT':
      return base + ' bg-red-100 text-red-700'
    case 'HASTER':
      return base + ' bg-orange-100 text-orange-700'
    case 'RASK':
      return base + ' bg-yellow-100 text-yellow-700'
    case 'VANLIG':
    default:
      return base + ' bg-green-100 text-green-700'
  }
}

function LogPanel({ logs, showLogs, onToggle }: { logs: LogEntry[]; showLogs: boolean; onToggle: () => void }) {
  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold">Scanning Logs</h3>
        <button
          type="button"
          onClick={onToggle}
          className="text-xs px-2 py-1 rounded border border-gray-600 bg-gray-800 text-gray-200 hover:bg-gray-700 transition flex items-center gap-1"
          
        >
          <span className={`inline-block transform transition-transform ${showLogs ? 'rotate-90' : ''}`}>▶</span>
          {showLogs ? 'Collapse' : 'Expand'}
        </button>
      </div>
      {!showLogs && (
        <div className="text-[11px] text-gray-500 italic">{logs.length} log entries (collapsed)</div>
      )}
      {showLogs && (
        <div className="border border-gray-700 rounded bg-[#1e1e1e] h-48 overflow-auto text-[11px] leading-relaxed p-2 font-mono shadow-inner">
          {logs.length === 0 && <div className="text-gray-500">(No log entries yet)</div>}
          {[...logs].reverse().map(l => {
            const ts = new Date(l.ts).toLocaleTimeString()
            return (
              <div key={l.id} className={logColor(l.level) + ' whitespace-pre'}>
                <span className="text-gray-500">{ts}</span>
                <span className="text-gray-600 mx-1">|</span>
                <span>{l.message}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function logColor(level: LogLevel) {
  switch (level) {
    case 'error': return 'text-red-400'
    case 'warn': return 'text-yellow-300'
    case 'success': return 'text-green-400'
    case 'info':
    default: return 'text-gray-300'
  }
}