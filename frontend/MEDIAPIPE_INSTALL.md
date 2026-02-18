# FRONTEND MEDIAPIPE INSTALLATION

## Install MediaPipe Dependencies

Run this in the frontend directory:

```powershell
cd frontend
npm install @mediapipe/face_detection @mediapipe/camera_utils
```

## What Gets Installed:

- **@mediapipe/face_detection**: MediaPipe Face Detection library for browser
- **@mediapipe/camera_utils**: Camera utilities for MediaPipe

## Usage in Code:

```typescript
import { FaceDetection } from '@mediapipe/face_detection'
import { Camera } from '@mediapipe/camera_utils'
```

## Features:

✅ Real-time face detection in browser
✅ Draws bounding boxes around detected faces  
✅ Returns face coordinates for cropping
✅ Works with getUserMedia webcam streams
✅ Fast and lightweight (runs in browser)
✅ No backend processing needed for detection

## Model Loading:

MediaPipe loads models from CDN automatically:
```typescript
const faceDetection = new FaceDetection({
  locateFile: (file) => {
    return `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${file}`
  }
})
```

Internet connection required on first load (models are cached after).

## Browser Compatibility:

- Chrome/Edge: ✅ Full support
- Firefox: ✅ Full support  
- Safari: ✅ Full support (v14+)

## Memory Usage:

- Model size: ~2-3 MB (cached)
- Runtime memory: ~50-100 MB
- Very efficient for real-time detection

## Performance:

- Detection speed: 30-60 FPS (depends on device)
- Latency: <50ms per frame
- CPU usage: Low (optimized for browser)

## Alternatives:

If MediaPipe doesn't work, you can use:
- TensorFlow.js BlazeFace
- face-api.js (already in dependencies)
- Browser Web APIs only (no detection, full image capture)

## Verification:

After installation, check package.json:
```json
{
  "dependencies": {
    "@mediapipe/face_detection": "^0.4.x",
    "@mediapipe/camera_utils": "^0.3.x"
  }
}
```

Run dev server and check browser console for any errors:
```powershell
npm run dev
```

Navigate to http://localhost:3000/face-login-production
- Camera should start
- Green box should appear around your face
- Button should enable when face detected
