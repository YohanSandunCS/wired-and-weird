"use client";

import medicalItems from "@/data/medical-items.json";
import { useMemo, useRef, useState, useEffect } from "react";
import jsQR from "jsqr";
import {
  BrowserMultiFormatReader,
  BarcodeFormat,
  DecodeHintType,
  Result,
  NotFoundException,
} from "@zxing/library";

type MedicalItem = {
  patientName: string;
  fodselsnummer: string;
  accessionNo: string;
  sampleId: string;
  testType: string;
  container: string;
  wardUnit: string;
  destination: string;
  priority: string;
  collectionTime: string;
  qr: string;
  weightGrams: number;
};

type LogLevel = "info" | "warn" | "error" | "success";
type LogEntry = { id: number; ts: number; level: LogLevel; message: string };

export default function RobotMedicalItemLoadUnload({
  isLoadMode = true,
  onBusyChange,
}: {
  isLoadMode?: boolean;
  onBusyChange?: (busy: boolean) => void;
}) {
  // Memoize to avoid re-processing on re-render
  const allItems: MedicalItem[] = useMemo(
    () => medicalItems as MedicalItem[],
    [],
  );
  const [loadedItems, setLoadedItems] = useState<MedicalItem[]>([]);
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Notify parent of busy state changes
  useEffect(() => {
    onBusyChange?.(isLoading);
  }, [isLoading, onBusyChange]);

  const [hasStream, setHasStream] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const logsCounterRef = useRef(0);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameCounterRef = useRef(0);
  const skippedCounterRef = useRef(0);
  const SCAN_INTERVAL_MS = 200;
  const LOG_EVERY_FRAMES = 5; // throttle "no code" logs
  const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null);
  const heartbeatRef = useRef<number | null>(null);
  const usingZxingRef = useRef(false);
  const [showLogs, setShowLogs] = useState(false);
  const [lastAddedQr, setLastAddedQr] = useState<string | null>(null);
  const [flashQr, setFlashQr] = useState<string | null>(null);
  const flashLastDetectedAtRef = useRef<number | null>(null);
  const flashCleanupIntervalRef = useRef<number | null>(null);
  const scanningStartedRef = useRef(false);
  // Title/switch moved to parent page; local mode state no longer used.
  const [deliveredQrs, setDeliveredQrs] = useState<string[]>([]);
  const [tempC, setTempC] = useState<number>(14);
  const [tempHistory, setTempHistory] = useState<number[]>([]);
  const [weightHistory, setWeightHistory] = useState<number[]>([]);
  // Missing item "toast" state
  const [missingItemToast, setMissingItemToast] = useState<{
    qr: string;
  } | null>(null);
  const missingToastTimeoutRef = useRef<number | null>(null);

  const tempIntervalRef = useRef<number | null>(null);
  const dangerZoneIntervalRef = useRef<number | null>(null);

  const totalWeight = useMemo(() => {
    // Only count items that are loaded AND NOT delivered (if in unload mode)
    // Actually, physically:
    // - In Load Mode: loadedItems are on board.
    // - In Unload Mode: loadedItems are on board. When we "deliver" one, it leaves the robot.
    // So we should subtract delivered items from the weight.
    const deliveredSet = new Set(deliveredQrs);
    return loadedItems
      .filter((item) => !deliveredSet.has(item.qr))
      .reduce((sum, item) => sum + item.weightGrams, 0);
  }, [loadedItems, deliveredQrs]);
  const totalWeightRef = useRef(totalWeight);
  useEffect(() => {
    totalWeightRef.current = totalWeight;
  }, [totalWeight]);

  // Helper first to avoid temporal dead zone
  function randInRange(min: number, max: number) {
    return Math.random() * (max - min) + min;
  }

  // Regenerate thermometer/graph data on mode change
  useEffect(() => {
    // --- Helper for danger zone logic ---
    const enterDangerZone = () => {
      const goHigh = Math.random() > 0.5;
      const dangerTarget = goHigh ? randInRange(7, 9) : randInRange(1, 3);

      // Temporarily override the main interval to move towards the danger temp
      setTempC((prev) => {
        const delta = dangerTarget - prev;
        const step = delta * 0.2; // Move 20% of the way there
        const next = parseFloat((prev + step).toFixed(1));

        // Add to history during danger zone updates too?
        // The main interval handles regular history updates.
        // If we want high-res updates during danger zone we could add here,
        // but let's stick to the 1s interval for history consistency.
        return next;
      });

      // Schedule the next danger event
      const nextDangerInterval = randInRange(12000, 24000);
      if (dangerZoneIntervalRef.current)
        clearTimeout(dangerZoneIntervalRef.current);
      dangerZoneIntervalRef.current = window.setTimeout(
        enterDangerZone,
        nextDangerInterval,
      );
    };

    // --- Main Effect Logic ---
    if (tempIntervalRef.current) window.clearInterval(tempIntervalRef.current);
    if (dangerZoneIntervalRef.current)
      clearTimeout(dangerZoneIntervalRef.current);
    tempIntervalRef.current = null;
    dangerZoneIntervalRef.current = null;

    // Helper to start the temperature simulation
    const startSimulation = () => {
      tempIntervalRef.current = window.setInterval(() => {
        setTempC((prev) => {
          const target = randInRange(2, 8);
          const delta = target - prev;
          const step = Math.max(Math.min(delta, 0.5), -0.5); // Slower transitions
          const next = Math.max(2, Math.min(8, prev + step));
          const val = parseFloat(next.toFixed(1));

          setTempHistory((h) => {
            const newHistory = [...h, val];
            return newHistory.length > 600
              ? newHistory.slice(newHistory.length - 600)
              : newHistory;
          });

          return val;
        });

        // Also track weight history
        setWeightHistory((h) => {
          const val = totalWeightRef.current;
          const newHistory = [...h, val];
          return newHistory.length > 600
            ? newHistory.slice(newHistory.length - 600)
            : newHistory;
        });
      }, 1000);

      // Start the first danger zone event
      // Danger zone events only affect current temp reading but propagate to history naturally
      const firstDangerInterval = randInRange(12000, 24000);
      dangerZoneIntervalRef.current = window.setTimeout(
        enterDangerZone,
        firstDangerInterval,
      );
    };

    if (isLoadMode) {
      // Just start simulation
      startSimulation();
    } else {
      // In Unload mode:
      // If history is empty (e.g. loaded directly into Unload), generate a dummy history first.
      setTempHistory((prev) => {
        if (prev.length > 0) return prev;

        // Fallback: Generate 10 mins of dummy data if none exists
        const points: number[] = [];
        let current = randInRange(2, 8);
        for (let i = 0; i < 600; i++) {
          const target = randInRange(2, 8);
          const delta = target - current;
          const step = Math.max(Math.min(delta, 0.2), -0.2);
          current = Math.max(2, Math.min(8, current + step));
          points.push(parseFloat(current.toFixed(1)));
        }
        // Update current temp to match the end of history
        setTempC(points[points.length - 1]);
        return points;
      });

      setWeightHistory((prev) => {
        if (prev.length > 0) return prev;
        const w = totalWeightRef.current;
        return Array(600).fill(w);
      });

      // Then start simulation so the graph updates live
      startSimulation();
    }

    return () => {
      if (tempIntervalRef.current) {
        window.clearInterval(tempIntervalRef.current);
        tempIntervalRef.current = null;
      }
      if (dangerZoneIntervalRef.current) {
        clearTimeout(dangerZoneIntervalRef.current);
        dangerZoneIntervalRef.current = null;
      }
    };
  }, [isLoadMode]);

  function handleDeleteItem(qr: string) {
    if (!isLoadMode) return;
    setLoadedItems((prev) => prev.filter((p) => p.qr !== qr));
    if (lastAddedQr === qr) setLastAddedQr(null);
    if (flashQr === qr) setFlashQr(null);
    pushLog("Item removed (qr=" + qr + ")", "warn");
  }

  // Helper for showing missing item toast
  function showMissingItemToast(qr: string) {
    // If same item already shown, ignore to avoid spam
    if (missingItemToast?.qr === qr) return;

    // Force a re-render/reset of the toast if we switch items
    // by momentarily setting to null if needed?
    // Actually, React key change on the element is cleaner.

    setMissingItemToast({ qr });

    // Clear existing timeout
    if (missingToastTimeoutRef.current) {
      clearTimeout(missingToastTimeoutRef.current);
    }

    // Auto-hide after 5 seconds
    missingToastTimeoutRef.current = window.setTimeout(() => {
      setMissingItemToast(null);
      missingToastTimeoutRef.current = null;
    }, 5000);
  }

  function markDelivered(qr: string, sampleId: string) {
    setDeliveredQrs((prev) => {
      if (prev.includes(qr)) {
        pushLog("Already delivered: " + sampleId, "info");
        return prev;
      }
      pushLog("Item delivered: " + sampleId, "success");
      return [...prev, qr];
    });
  }

  // Clear flash after short duration
  useEffect(() => {
    if (flashQr) {
      // (Timer removed; we now clear based on stale time in interval)
    }
  }, [flashQr]);

  // Start interval to clear flash when stale
  useEffect(() => {
    if (isLoading && !flashCleanupIntervalRef.current) {
      flashCleanupIntervalRef.current = window.setInterval(() => {
        if (flashQr && flashLastDetectedAtRef.current) {
          const age = Date.now() - flashLastDetectedAtRef.current;
          if (age > 400) {
            // > 400ms since last duplicate detection
            setFlashQr(null);
            flashLastDetectedAtRef.current = null;
          }
        }
      }, 150);
    }
    if (!isLoading && flashCleanupIntervalRef.current) {
      window.clearInterval(flashCleanupIntervalRef.current);
      flashCleanupIntervalRef.current = null;
    }
    return () => {
      if (flashCleanupIntervalRef.current) {
        window.clearInterval(flashCleanupIntervalRef.current);
        flashCleanupIntervalRef.current = null;
      }
    };
  }, [isLoading, flashQr]);

  function pushLog(message: string, level: LogLevel) {
    const id = ++logsCounterRef.current;
    setLogs((prev) => {
      const next = [...prev, { id, ts: Date.now(), level, message }];
      if (next.length > 200) next.splice(0, next.length - 200); // cap size
      return next;
    });
  }

  // Cleanup stream on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, []);

  async function handleStart() {
    if (isLoading) return;
    setIsLoading(true);
    pushLog("Loading started. Awaiting QR code...", "info");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: { ideal: "environment" },
        },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          const vw = videoRef.current?.videoWidth || 0;
          const vh = videoRef.current?.videoHeight || 0;
          pushLog(
            `Video stream ready (${vw}x${vh}). Starting scan loop.`,
            "info",
          );
          if (videoRef.current && videoRef.current.paused) {
            videoRef.current
              .play()
              .catch((err) => console.warn("Video play failed", err));
          }
          // Remove handler to avoid repeated triggers
          if (videoRef.current) videoRef.current.onloadedmetadata = null;
          startScanningLoop();
        };
      }
      setHasStream(true);
    } catch (err) {
      console.error("Failed to start camera stream:", err);
      pushLog(
        "Camera start failed: " +
          (err instanceof Error ? err.message : "Unknown error"),
        "error",
      );
      setIsLoading(false);
    }
  }

  function handleStop() {
    if (!isLoading) return;
    setIsLoading(false);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setHasStream(false);
    stopScanningLoop();
    pushLog("Loading stopped.", "info");
  }

  // Scanning logic
  const scanCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const scanCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const scanIntervalRef = useRef<number | null>(null);

  function ensureCanvas() {
    if (!scanCanvasRef.current) {
      const c = document.createElement("canvas");
      scanCanvasRef.current = c;
      scanCtxRef.current = c.getContext("2d", { willReadFrequently: true });
    }
  }

  function startScanningLoop() {
    if (scanningStartedRef.current) {
      pushLog("Scan loop already active; skipping re-init.", "info");
      return;
    }
    scanningStartedRef.current = true;
    // Attempt ZXing first
    try {
      const hints = new Map();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.QR_CODE]);
      hints.set(DecodeHintType.TRY_HARDER, true);
      const reader = new BrowserMultiFormatReader(hints);
      codeReaderRef.current = reader;
      usingZxingRef.current = true;
      pushLog("ZXing initialized. Starting continuous decode.", "info");
      // Prefer the currently selected deviceId to avoid re-selection flicker
      let deviceId: string | null = null;
      try {
        const track = streamRef.current?.getVideoTracks()[0];
        const settings = track?.getSettings();
        if (settings && settings.deviceId)
          deviceId = settings.deviceId as string;
      } catch {}
      reader.decodeFromVideoDevice(
        deviceId,
        videoRef.current!,
        (result: Result | undefined, err: unknown) => {
          if (result) {
            handleZxingResult(result);
          } else if (err && !(err instanceof NotFoundException)) {
            const msg = err instanceof Error ? err.message : "Unknown";
            pushLog("ZXing error: " + msg, "warn");
          }
        },
      );
      startHeartbeat();
      return;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown";
      pushLog("ZXing init failed, falling back to jsQR: " + msg, "error");
      usingZxingRef.current = false;
    }
    // Fallback jsQR interval scanning
    ensureCanvas();
    if (scanIntervalRef.current) return;
    pushLog("Fallback jsQR scan loop started.", "info");
    pushLog(
      `Scan interval: ${SCAN_INTERVAL_MS}ms; logging every ${LOG_EVERY_FRAMES} frames without code.`,
      "info",
    );
    scanIntervalRef.current = window.setInterval(() => {
      tryScanFrame();
    }, SCAN_INTERVAL_MS);
    startHeartbeat();
  }

  function stopScanningLoop() {
    if (scanIntervalRef.current) {
      window.clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (codeReaderRef.current) {
      try {
        codeReaderRef.current.reset();
      } catch {}
      codeReaderRef.current = null;
    }
    if (heartbeatRef.current) {
      window.clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
    scanningStartedRef.current = false;
  }

  function startHeartbeat() {
    if (heartbeatRef.current) return;
    heartbeatRef.current = window.setInterval(() => {
      pushLog("Heartbeat: scanning active.", "info");
    }, 5000);
  }

  function handleZxingResult(result: Result) {
    const raw = result.getText().trim();
    setLastScanned(raw);
    setScanError(null);
    pushLog(`ZXing QR detected: ${raw}`, "success");
    drawZxingOverlay(result);
    const match = allItems.find((mi) => mi.qr === raw);
    if (!match) {
      pushLog(
        (isLoadMode
          ? "QR not recognized in inventory: "
          : "Cannot deliver (not loaded): ") + raw,
        "warn",
      );
      return;
    }
    if (isLoadMode) {
      setLoadedItems((prev) => {
        const already = prev.some((p) => p.qr === match.qr);
        if (already) {
          pushLog("QR already loaded: " + raw, "info");
          setLastAddedQr(match.qr);
          setFlashQr(match.qr);
          flashLastDetectedAtRef.current = Date.now();
          return prev;
        }
        pushLog("Item loaded: " + match.sampleId, "success");
        const next = [...prev, match];
        setLastAddedQr(match.qr);
        setFlashQr(null);
        flashLastDetectedAtRef.current = null;
        return next;
      });
    } else {
      // Unload mode: only mark delivered if it exists among loaded items
      const exists = loadedItems.some((p) => p.qr === match.qr);
      if (!exists) {
        showMissingItemToast(match.qr);
        pushLog("Cannot deliver (item not onboard): " + raw, "warn");
        return;
      }
      markDelivered(match.qr, match.sampleId);
    }
  }

  function drawZxingOverlay(result: Result) {
    const points = result.getResultPoints();
    const video = videoRef.current;
    const oCanvas = overlayCanvasRef.current;
    if (!points || points.length === 0 || !video || !oCanvas) return;
    const w = video.videoWidth;
    const h = video.videoHeight;
    oCanvas.width = w;
    oCanvas.height = h;
    const octx = oCanvas.getContext("2d");
    if (!octx) return;
    octx.clearRect(0, 0, w, h);
    octx.strokeStyle = "#22c55e";
    octx.lineWidth = 3;
    octx.beginPath();
    points.forEach((p, i) => {
      const x = p.getX();
      const y = p.getY();
      if (i === 0) octx.moveTo(x, y);
      else octx.lineTo(x, y);
    });
    octx.closePath();
    octx.stroke();
    points.forEach((p) => {
      octx.fillStyle = "#22c55e";
      octx.beginPath();
      octx.arc(p.getX(), p.getY(), 4, 0, Math.PI * 2);
      octx.fill();
    });
  }

  function tryScanFrame() {
    if (!videoRef.current || !hasStream || !isLoading) return;
    const video = videoRef.current;
    if (video.readyState !== HTMLMediaElement.HAVE_ENOUGH_DATA) {
      // Throttle skipped logs to avoid spam
      skippedCounterRef.current++;
      if (skippedCounterRef.current % LOG_EVERY_FRAMES === 0) {
        pushLog(
          `Frame skipped (not ready). Total skipped: ${skippedCounterRef.current}`,
          "info",
        );
      }
      return;
    }
    ensureCanvas();
    const canvas = scanCanvasRef.current!;
    const ctx = scanCtxRef.current!;
    const w = video.videoWidth || 256;
    const h = video.videoHeight || 144;
    canvas.width = w;
    canvas.height = h;
    ctx.drawImage(video, 0, 0, w, h);
    const imageData = ctx.getImageData(0, 0, w, h);
    try {
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: "dontInvert",
      });
      const decodeMs = 0;
      if (code && code.data) {
        const raw = code.data.trim();
        setLastScanned(raw);
        setScanError(null);
        pushLog(
          `QR detected (frame ${frameCounterRef.current + 1}) in ${decodeMs}ms: ${raw}`,
          "success",
        );
        // Draw bounding box overlay
        const oCanvas = overlayCanvasRef.current;
        if (oCanvas) {
          oCanvas.width = w;
          oCanvas.height = h;
          const octx = oCanvas.getContext("2d");
          if (octx) {
            octx.clearRect(0, 0, w, h);
            const loc = code.location;
            octx.strokeStyle = "#22c55e";
            octx.lineWidth = 3;
            octx.beginPath();
            octx.moveTo(loc.topLeftCorner.x, loc.topLeftCorner.y);
            octx.lineTo(loc.topRightCorner.x, loc.topRightCorner.y);
            octx.lineTo(loc.bottomRightCorner.x, loc.bottomRightCorner.y);
            octx.lineTo(loc.bottomLeftCorner.x, loc.bottomLeftCorner.y);
            octx.closePath();
            octx.stroke();
          }
        }
        // Match against items
        const match = allItems.find((mi) => mi.qr === raw);
        if (!match) {
          pushLog(
            (isLoadMode
              ? "QR not recognized in inventory: "
              : "Cannot deliver (not loaded): ") + raw,
            "warn",
          );
        } else if (isLoadMode) {
          setLoadedItems((prev) => {
            const already = prev.some((p) => p.qr === match.qr);
            if (already) {
              pushLog("QR already loaded: " + raw, "info");
              setLastAddedQr(match.qr);
              setFlashQr(match.qr);
              flashLastDetectedAtRef.current = Date.now();
              return prev;
            }
            pushLog("Item loaded: " + match.sampleId, "success");
            const next = [...prev, match];
            setLastAddedQr(match.qr);
            setFlashQr(null);
            flashLastDetectedAtRef.current = null;
            return next;
          });
        } else {
          const exists = loadedItems.some((p) => p.qr === match.qr);
          if (!exists) {
            showMissingItemToast(raw);
            pushLog("Cannot deliver (item not onboard): " + raw, "warn");
          } else {
            markDelivered(match.qr, match.sampleId);
          }
        }
        frameCounterRef.current++;
      } else {
        frameCounterRef.current++;
        if (frameCounterRef.current % LOG_EVERY_FRAMES === 0) {
          pushLog(
            `Attempt ${frameCounterRef.current}: no QR (decode ${decodeMs}ms)`,
            "info",
          );
        }
        // Clear overlay if present
        const oCanvas = overlayCanvasRef.current;
        if (oCanvas) {
          const octx = oCanvas.getContext("2d");
          const w2 = oCanvas.width;
          const h2 = oCanvas.height;
          octx?.clearRect(0, 0, w2, h2);
        }
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "QR decode error";
      setScanError(msg);
      pushLog("Decode error: " + msg, "error");
    }
  }

  return (
    <div className="glass-card">
      {/* Top section: Controls/Video on left, Thermo on right */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Left: Loading Controls */}
        <div className="flex flex-col sm:flex-row gap-4 items-start">
          <div className="relative w-[256px] h-[144px] bg-[#0B0F2A] border border-cyan-500/20 rounded-xl overflow-hidden">
            <video
              ref={videoRef}
              className={`w-full h-full object-cover ${hasStream ? "block" : "hidden"}`}
              width={256}
              height={144}
              muted
              playsInline
            />
            <canvas
              ref={overlayCanvasRef}
              className={`absolute inset-0 w-full h-full pointer-events-none ${hasStream ? "block" : "hidden"}`}
            />
            {!hasStream && (
              <div className="absolute inset-0 flex items-center justify-center text-gray-500">
                QR code scanner
              </div>
            )}
          </div>
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={handleStart}
              disabled={isLoading}
              className={`px-4 py-2 rounded-xl text-white font-semibold flex items-center gap-2 transition disabled:bg-gray-700 disabled:opacity-50
                ${isLoadMode ? "bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 shadow-[0_0_12px_rgba(0,229,255,0.2)]" : "bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 shadow-[0_0_12px_rgba(99,102,241,0.2)]"}`}
            >
              {isLoadMode ? (
                // Load Icon: Arrow pointing down into tray
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
              ) : (
                // Unload Icon: Arrow pointing up out of tray
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                  />
                </svg>
              )}
              {isLoadMode ? "Start Loading" : "Start Unloading"}
            </button>
            <button
              type="button"
              onClick={handleStop}
              disabled={!isLoading}
              className={`px-4 py-2 rounded-xl text-white font-semibold flex items-center gap-2 bg-red-600/80 hover:bg-red-600 disabled:bg-gray-700 disabled:opacity-50 transition shadow-[0_0_12px_rgba(239,68,68,0.15)]`}
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"
                />
              </svg>
              {isLoadMode ? "Stop Loading" : "Stop Unloading"}
            </button>
            {/* Missing item toast - auto-hides after 5s */}
            {missingItemToast && !isLoadMode && (
              <div
                key={missingItemToast.qr}
                className="w-full px-4 py-2 mt-2 rounded-xl text-red-400 bg-red-500/10 border border-red-500/20 font-semibold text-sm flex flex-col items-center justify-center animate-flash-red shadow-lg"
                title="This item was not loaded onto the robot"
              >
                <span>Item can&apos;t be found</span>
                <span className="text-[10px] text-red-500 truncate max-w-full">
                  {missingItemToast.qr.split("|")[0] || missingItemToast.qr}
                </span>
              </div>
            )}
          </div>
        </div>
        {/* Right: Thermometer/Graph */}
        <ThermoView
          isLoadMode={isLoadMode}
          tempC={tempC}
          tempHistory={tempHistory}
          totalWeight={totalWeight}
          weightHistory={weightHistory}
        />
      </div>

      {/* Main content below */}
      <StatusBar
        lastScanned={lastScanned}
        loadedCount={loadedItems.length}
        error={scanError}
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {loadedItems.length === 0 && (
          <div className="text-gray-500 italic py-4 col-span-full">
            No items loaded yet. Please start scanning to add items.
          </div>
        )}
        {loadedItems.map((item) => (
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
        Loaded items: {loadedItems.length} / {allItems.length}. Unique matches
        only.
      </p>

      <LogPanel
        logs={logs}
        showLogs={showLogs}
        onToggle={() => setShowLogs((s: boolean) => !s)}
      />
    </div>
  );
}

function ThermoView({
  isLoadMode,
  tempC,
  tempHistory,
  totalWeight,
  weightHistory,
}: {
  isLoadMode: boolean;
  tempC: number;
  tempHistory: number[];
  totalWeight: number;
  weightHistory: number[];
}) {
  // Calculates a color from green to red based on temperature deviation from the ideal range.
  function getTempColor(temp: number): string {
    const ideal = 5;
    const safeMin = 2,
      safeMax = 8;
    const dangerMin = 0,
      dangerMax = 10;

    // Clamp temp within the danger zone for color calculation
    const clampedTemp = Math.max(dangerMin, Math.min(dangerMax, temp));

    let hue: number;
    if (clampedTemp >= safeMin && clampedTemp <= safeMax) {
      // Inside safe zone (2-8C): Transition from yellow (60) to green (120) and back to yellow.
      const range = (safeMax - safeMin) / 2;
      const distFromIdeal = Math.abs(clampedTemp - ideal);
      // 120 (green) at ideal, 60 (yellow) at edges of safe zone
      hue = 120 - (distFromIdeal / range) * 60;
    } else if (clampedTemp < safeMin) {
      // Below safe zone (0-2C): Transition from yellow (60) to red (0).
      const range = safeMin - dangerMin;
      const distFromSafe = safeMin - clampedTemp;
      hue = 60 - (distFromSafe / range) * 60;
    } else {
      // temp > safeMax
      // Above safe zone (8-10C): Transition from yellow (60) to red (0).
      const range = dangerMax - safeMax;
      const distFromSafe = clampedTemp - safeMax;
      hue = 60 - (distFromSafe / range) * 60;
    }

    hue = Math.max(0, Math.min(120, hue));
    return `hsl(${hue}, 90%, 50%)`;
  }

  function getWeightColor(weight: number): string {
    // 0g-250g -> Green (120), 320g -> Orange (30), 500g+ -> Red (0)
    let hue: number;
    const w = Math.max(0, weight);

    if (w <= 250) {
      // Range 0 -> 250 (Solid Green)
      hue = 120;
    } else if (w <= 320) {
      // Range 250 -> 320 (Green to Orange)
      const t = (w - 250) / (320 - 250);
      hue = 120 - t * (120 - 30); // 120 -> 30
    } else {
      // Range 320 -> 500+ (Orange to Red)
      const t = Math.min(1, (w - 320) / (500 - 320));
      hue = 30 - t * 30; // 30 -> 0
    }

    return `hsl(${hue}, 80%, 50%)`;
  }

  if (isLoadMode) {
    const tempMinAxis = 0,
      tempMaxAxis = 10;
    const weightMinAxis = 0,
      weightMaxAxis = 500;
    const w = 220,
      h = 120; // Reduced width from 480 to 220
    const graphAreaY = 16;
    const graphAreaHeight = h - 32;

    // Temperature bar logic
    const tempT = Math.max(
      0,
      Math.min(1, (tempC - tempMinAxis) / (tempMaxAxis - tempMinAxis)),
    );
    const tempMaskHeight = (1 - tempT) * graphAreaHeight;

    // Weight bar logic
    const weightT = Math.max(0, Math.min(1, totalWeight / weightMaxAxis));
    const weightMaskHeight = (1 - weightT) * graphAreaHeight;

    return (
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-400">Payload Temperature</span>
          <span className="text-sm text-gray-400">Total Weight</span>
        </div>
        <div
          className="bg-[#0a0e24] rounded-xl p-2 flex gap-4 border border-cyan-500/10"
          style={{ gap: "92px", paddingLeft: "24px", paddingRight: "24px" }}
        >
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
                transition: "background-color 0.5s ease",
              }}
            >
              {/* 3a. The white label, stationary inside the colored bar */}
              <div className="relative w-full h-full flex items-center justify-center">
                <span className="text-3xl font-bold text-white">
                  {tempC.toFixed(1)}°C
                </span>
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
                backgroundColor: "#0a0e24", // Same as container background
                transition: "height 0.5s ease",
              }}
            >
              {/* 3b. The gray label, stationary inside the mask */}
              <div className="relative w-full h-full flex justify-center">
                <span
                  className="absolute text-3xl font-bold text-gray-600"
                  style={{ top: "25px" }}
                >
                  {tempC.toFixed(1)}°C
                </span>
              </div>
            </div>

            {/* 4. SVG for axes and labels (top layer) */}
            <svg
              width={w}
              height={h}
              className="absolute inset-0 pointer-events-none"
            >
              {/* Y-Axis Labels */}
              <text
                x={24}
                y={20}
                textAnchor="end"
                className="text-xs fill-gray-400"
              >
                {tempMaxAxis}°C
              </text>
              <text
                x={24}
                y={h - 16}
                textAnchor="end"
                className="text-xs fill-gray-400"
              >
                {tempMinAxis}°C
              </text>
              {/* Axis Lines */}
              <line
                x1={32}
                y1={16}
                x2={32}
                y2={h - 16}
                stroke="#1e3a5f"
                strokeWidth={2}
              />
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
                borderRadius: "4px",
                transition: "background-color 0.5s ease",
              }}
            >
              {/* 3a. The white label, stationary inside the colored bar */}
              <div className="relative w-full h-full flex items-center justify-center">
                <span className="text-3xl font-bold text-white">
                  {totalWeight.toFixed(0)}g
                </span>
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
                backgroundColor: "#0a0e24", // Same as container background
                transition: "height 0.5s ease",
                borderTopLeftRadius: "4px",
                borderTopRightRadius: "4px",
              }}
            >
              {/* 3b. The gray label, stationary inside the mask */}
              <div className="relative w-full h-full flex justify-center">
                <span
                  className="absolute text-3xl font-bold text-gray-600"
                  style={{ top: "25px" }}
                >
                  {totalWeight.toFixed(0)}g
                </span>
              </div>
            </div>

            {/* 4. SVG for axes and labels (top layer) */}
            <svg
              width={w}
              height={h}
              className="absolute inset-0 pointer-events-none"
            >
              {/* Y-Axis Labels */}
              <text
                x={w - 12}
                y={20}
                textAnchor="end"
                className="text-xs fill-gray-400"
              >
                {weightMaxAxis}g
              </text>
              <text
                x={w - 12}
                y={h - 16}
                textAnchor="end"
                className="text-xs fill-gray-400"
              >
                {weightMinAxis}g
              </text>
              {/* Axis Lines */}
              <line
                x1={w - 48}
                y1={16}
                x2={w - 48}
                y2={h - 16}
                stroke="#1e3a5f"
                strokeWidth={2}
              />
            </svg>
          </div>
        </div>
      </div>
    );
  }

  // Unload: Two side-by-side SVG line charts (flex container)
  const chartHeight = 140;
  const padding = 32;
  const maxPoints = 599; // 600 points total

  // --- Temp Graph Conf ---
  const tempMin = 0,
    tempMax = 10;
  const tempWidth = 240; // narrower
  const tempXScale = (i: number) =>
    padding + (i / maxPoints) * (tempWidth - padding * 2);
  const tempYScale = (v: number) => {
    const t = (v - tempMin) / (tempMax - tempMin);
    return padding - 20 + (1 - t) * (chartHeight - padding * 2);
  };
  const tempPath = tempHistory
    .map((v, i) => `${i === 0 ? "M" : "L"}${tempXScale(i)},${tempYScale(v)}`)
    .join(" ");

  // --- Weight Graph Conf ---
  const weightMin = 0,
    weightMax = 500;
  const weightWidth = 240; // same width
  const weightXScale = (i: number) =>
    padding + (i / maxPoints) * (weightWidth - padding * 2);
  const weightYScale = (v: number) => {
    // Clamp v to max just in case
    const safeV = Math.min(v, weightMax);
    const t = (safeV - weightMin) / (weightMax - weightMin);
    return padding - 20 + (1 - t) * (chartHeight - padding * 2);
  };
  const weightPath = weightHistory
    .map(
      (v, i) => `${i === 0 ? "M" : "L"}${weightXScale(i)},${weightYScale(v)}`,
    )
    .join(" ");

  return (
    <div className="mb-4 flex flex-row gap-4">
      {/* Temp Graph */}
      <div className="flex-1">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-gray-400 font-semibold truncate">
            Temp History
          </span>
          <span className="text-xs font-bold text-cyan-400">
            {tempC.toFixed(1)}°C
          </span>
        </div>
        <div className="bg-[#0a0e24] rounded-xl p-2 overflow-hidden flex justify-center border border-cyan-500/10">
          <svg width={tempWidth} height={chartHeight - 20} className="block">
            <rect
              x={0}
              y={0}
              width={tempWidth}
              height={chartHeight}
              fill="none"
            />
            {/* Y-Axis Labels */}
            <text
              x={padding - 4}
              y={padding}
              textAnchor="end"
              dominantBaseline="middle"
              className="text-[10px] fill-gray-400"
            >
              {tempMax}°
            </text>
            <text
              x={padding - 4}
              y={chartHeight - padding - 10}
              textAnchor="end"
              dominantBaseline="middle"
              className="text-[10px] fill-gray-400"
            >
              {tempMin}°
            </text>
            {/* Axis Lines */}
            <line
              x1={padding}
              y1={chartHeight - padding - 10}
              x2={tempWidth - padding}
              y2={chartHeight - padding - 10}
              stroke="#1e3a5f"
              strokeWidth={2}
            />
            <line
              x1={padding}
              y1={padding - 10}
              x2={padding}
              y2={chartHeight - padding - 10}
              stroke="#1e3a5f"
              strokeWidth={2}
            />

            <path
              d={tempPath}
              stroke="#3b82f6"
              strokeWidth={2}
              fill="none"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>

      {/* Weight Graph */}
      <div className="flex-1">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-gray-400 font-semibold truncate">
            Weight History
          </span>
          <span className="text-xs font-bold text-orange-400">
            {Math.round(totalWeight)}g
          </span>
        </div>
        <div className="bg-[#0a0e24] rounded-xl p-2 overflow-hidden flex justify-center border border-cyan-500/10">
          <svg width={weightWidth} height={chartHeight - 20} className="block">
            <rect
              x={0}
              y={0}
              width={weightWidth}
              height={chartHeight}
              fill="none"
            />
            {/* Y-Axis Labels */}
            <text
              x={padding - 4}
              y={padding}
              textAnchor="end"
              dominantBaseline="middle"
              className="text-[10px] fill-gray-400"
            >
              {weightMax}g
            </text>
            <text
              x={padding - 4}
              y={chartHeight - padding - 10}
              textAnchor="end"
              dominantBaseline="middle"
              className="text-[10px] fill-gray-400"
            >
              {weightMin}g
            </text>
            {/* Axis Lines */}
            <line
              x1={padding}
              y1={chartHeight - padding - 10}
              x2={weightWidth - padding}
              y2={chartHeight - padding - 10}
              stroke="#1e3a5f"
              strokeWidth={2}
            />
            <line
              x1={padding}
              y1={padding - 10}
              x2={padding}
              y2={chartHeight - padding - 10}
              stroke="#1e3a5f"
              strokeWidth={2}
            />

            <path
              d={weightPath}
              stroke="#f97316"
              strokeWidth={2}
              fill="none"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}

function Card({
  item,
  lastAddedQr,
  flashQr,
  delivered,
  isLoadMode,
  onDelete,
}: {
  item: MedicalItem;
  lastAddedQr: string | null;
  flashQr: string | null;
  delivered: boolean;
  isLoadMode: boolean;
  onDelete: () => void;
}) {
  const isLast = item.qr === lastAddedQr;
  const isFlash = item.qr === flashQr;
  let classes =
    "group rounded-xl border p-4 shadow-sm bg-white/5 backdrop-blur-sm transition-all ";
  if (isLoadMode) {
    if (isFlash) {
      classes += "border-cyan-500 ring-2 ring-cyan-400 animate-flash-fast ";
    } else if (isLast) {
      classes += "border-cyan-400/50 ring-1 ring-cyan-200/20 ";
    } else {
      classes += "border-cyan-500/10 ";
    }
  } else {
    if (delivered) {
      classes += "border-emerald-500 ring-1 ring-emerald-300/30 ";
    } else {
      classes += "border-cyan-500/10 ";
    }
  }
  return (
    <div className={classes}>
      <div className="flex justify-between items-start mb-2">
        <h3 className="text-sm font-semibold text-white leading-snug pr-2">
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
            className="p-1 rounded text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition"
            aria-label="Remove item"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="3 6 5 6 21 6" />
              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              <path d="M10 11v6" />
              <path d="M14 11v6" />
              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
            </svg>
          </button>
        ) : delivered ? (
          <div className="flex items-center text-emerald-400 text-xs font-medium">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-4 h-4 mr-1"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20 6L9 17l-5-5" />
            </svg>
            Delivered
          </div>
        ) : (
          <div className="h-5" />
        )}
      </div>
    </div>
  );
}

function StatusBar({
  lastScanned,
  loadedCount,
  error,
}: {
  lastScanned: string | null;
  loadedCount: number;
  error: string | null;
}) {
  return (
    <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs">
      <div className="text-gray-400">
        Last scanned:{" "}
        {lastScanned ? (
          <code className="text-cyan-400">{lastScanned}</code>
        ) : (
          "—"
        )}
      </div>
      <div className="text-gray-400">
        Total loaded:{" "}
        <span className="font-semibold text-gray-200">{loadedCount}</span>
      </div>
      {error && <div className="text-red-400">{error}</div>}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-400 mr-2">{label}</span>
      <span
        className={
          "text-gray-200 truncate max-w-[55%] text-right " +
          (label === "Destination" ? "font-semibold" : "font-medium")
        }
        title={value}
      >
        {value}
      </span>
    </div>
  );
}

// If collection time needed later, we can reintroduce formatTime utility.

function priorityBadge(priority: string) {
  const base =
    "inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold";
  switch (priority.toUpperCase()) {
    case "AKUTT":
      return base + " bg-red-500/20 text-red-400";
    case "HASTER":
      return base + " bg-orange-500/20 text-orange-400";
    case "RASK":
      return base + " bg-yellow-500/20 text-yellow-400";
    case "VANLIG":
    default:
      return base + " bg-emerald-500/20 text-emerald-400";
  }
}

function LogPanel({
  logs,
  showLogs,
  onToggle,
}: {
  logs: LogEntry[];
  showLogs: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-200">Scanning Logs</h3>
        <button
          type="button"
          onClick={onToggle}
          className="text-xs px-2 py-1 rounded-xl border border-cyan-500/20 bg-[#0a0e24] text-gray-300 hover:bg-cyan-500/10 transition flex items-center gap-1"
        >
          <span
            className={`inline-block transform transition-transform ${showLogs ? "rotate-90" : ""}`}
          >
            ▶
          </span>
          {showLogs ? "Collapse" : "Expand"}
        </button>
      </div>
      {!showLogs && (
        <div className="text-[11px] text-gray-500 italic">
          {logs.length} log entries (collapsed)
        </div>
      )}
      {showLogs && (
        <div className="border border-cyan-500/10 rounded-xl bg-[#0a0e24] h-48 overflow-auto text-[11px] leading-relaxed p-2 font-mono shadow-inner">
          {logs.length === 0 && (
            <div className="text-gray-500">(No log entries yet)</div>
          )}
          {[...logs].reverse().map((l) => {
            const ts = new Date(l.ts).toLocaleTimeString();
            return (
              <div key={l.id} className={logColor(l.level) + " whitespace-pre"}>
                <span className="text-gray-500">{ts}</span>
                <span className="text-gray-500 mx-1">|</span>
                <span>{l.message}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function logColor(level: LogLevel) {
  switch (level) {
    case "error":
      return "text-red-400";
    case "warn":
      return "text-yellow-300";
    case "success":
      return "text-green-400";
    case "info":
    default:
      return "text-gray-300";
  }
}
