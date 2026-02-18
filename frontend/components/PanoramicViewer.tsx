'use client'

import { useEffect, useRef } from 'react'

interface PanoramicViewerProps {
  imageUrl: string
  onClose: () => void
  captureTime: number
  width: number
  height: number
}

export default function PanoramicViewer({ imageUrl, onClose, captureTime, width, height }: PanoramicViewerProps) {
  const viewerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isDraggingRef = useRef(false)
  const lastMouseXRef = useRef(0)
  const lastMouseYRef = useRef(0)
  const rotationXRef = useRef(0)
  const rotationYRef = useRef(0)
  const imageRef = useRef<HTMLImageElement | null>(null)
  const animationFrameRef = useRef<number | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas size
    canvas.width = canvas.offsetWidth
    canvas.height = canvas.offsetHeight

    // Load the image
    const img = new Image()
    img.onload = () => {
      imageRef.current = img
      render()
    }
    img.src = imageUrl

    function render() {
      if (!ctx || !imageRef.current || !canvas) return

      ctx.clearRect(0, 0, canvas.width, canvas.height)
      
      // Calculate the visible portion based on rotation
      const sourceX = ((rotationXRef.current % 360 + 360) % 360) / 360 * imageRef.current.width
      const sourceY = Math.max(0, Math.min(imageRef.current.height * 0.3, 
        (rotationYRef.current + 90) / 180 * imageRef.current.height * 0.6))
      
      const sourceWidth = imageRef.current.width * 0.4 // Show 40% of panorama width
      const sourceHeight = imageRef.current.height * 0.6 // Show 60% of height
      
      // Handle wrapping at edges
      if (sourceX + sourceWidth > imageRef.current.width) {
        const firstPartWidth = imageRef.current.width - sourceX
        const secondPartWidth = sourceWidth - firstPartWidth
        
        // Draw first part
        ctx.drawImage(
          imageRef.current,
          sourceX, sourceY, firstPartWidth, sourceHeight,
          0, 0, (firstPartWidth / sourceWidth) * canvas.width, canvas.height
        )
        
        // Draw wrapped part
        ctx.drawImage(
          imageRef.current,
          0, sourceY, secondPartWidth, sourceHeight,
          (firstPartWidth / sourceWidth) * canvas.width, 0, 
          (secondPartWidth / sourceWidth) * canvas.width, canvas.height
        )
      } else {
        ctx.drawImage(
          imageRef.current,
          sourceX, sourceY, sourceWidth, sourceHeight,
          0, 0, canvas.width, canvas.height
        )
      }
      
      animationFrameRef.current = requestAnimationFrame(render)
    }

    function handleMouseDown(e: MouseEvent) {
      if (!canvas) return
      isDraggingRef.current = true
      lastMouseXRef.current = e.clientX
      lastMouseYRef.current = e.clientY
      canvas.style.cursor = 'grabbing'
    }

    function handleMouseMove(e: MouseEvent) {
      if (!isDraggingRef.current) return

      const deltaX = e.clientX - lastMouseXRef.current
      const deltaY = e.clientY - lastMouseYRef.current

      rotationXRef.current += deltaX * 0.5
      rotationYRef.current = Math.max(-45, Math.min(45, rotationYRef.current + deltaY * 0.3))

      lastMouseXRef.current = e.clientX
      lastMouseYRef.current = e.clientY
    }

    function handleMouseUp() {
      if (!canvas) return
      isDraggingRef.current = false
      canvas.style.cursor = 'grab'
    }

    function handleWheel(e: WheelEvent) {
      e.preventDefault()
      rotationYRef.current = Math.max(-45, Math.min(45, rotationYRef.current + e.deltaY * 0.05))
    }

    function handleResize() {
      if (canvas) {
        canvas.width = canvas.offsetWidth
        canvas.height = canvas.offsetHeight
      }
    }

    canvas.addEventListener('mousedown', handleMouseDown)
    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    canvas.addEventListener('wheel', handleWheel, { passive: false })
    window.addEventListener('resize', handleResize)

    if (canvas) {
      canvas.style.cursor = 'grab'
    }

    return () => {
      if (canvas) {
        canvas.removeEventListener('mousedown', handleMouseDown)
        canvas.removeEventListener('wheel', handleWheel)
      }
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      window.removeEventListener('resize', handleResize)
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [imageUrl])

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div 
        className="relative w-full h-full max-w-7xl max-h-[90vh] m-8"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/80 to-transparent p-6 z-10">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">360° Panoramic View</h2>
              <p className="text-gray-300 text-sm">Drag to rotate • Scroll to tilt</p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:text-gray-300 text-4xl leading-none w-12 h-12 flex items-center justify-center bg-black/50 rounded-full hover:bg-black/70 transition-colors"
            >
              ×
            </button>
          </div>
        </div>

        {/* Canvas Viewer */}
        <canvas
          ref={canvasRef}
          className="w-full h-full rounded-lg"
        />

        {/* Footer Info */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6">
          <div className="flex justify-between items-center text-white">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <span className="text-gray-400">Resolution:</span>
                <span className="font-medium">{width} × {height}</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-gray-400">Captured:</span>
                <span className="font-medium">{new Date(captureTime).toLocaleString()}</span>
              </div>
            </div>
            <div className="text-right">
              <div className="inline-flex items-center space-x-2 bg-blue-600/30 border border-blue-400/50 rounded-full px-4 py-2">
                <span className="text-blue-300">🎮</span>
                <span className="text-sm font-medium">Interactive 3D View</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
