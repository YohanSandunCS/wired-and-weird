# Face Recognition Authentication Setup Guide

## Overview

This system adds face recognition and voice-triggered authentication to the MediRunner platform. Users can authenticate by scanning their face instead of using traditional username/password credentials.

## Features

✅ Face recognition authentication using Python's face_recognition library  
✅ Voice-triggered login using Web Speech API  
✅ Separate authentication state from robot WebSocket communication  
✅ Clean, modular implementation with no database required  
✅ Real-time webcam feed with live face scanning  

## Architecture

### Backend (Gateway)
- **File**: `gateway/app/auth.py`
- **Endpoint**: `POST /auth/face-login`
- **Dependencies**: face_recognition, pillow, numpy

The gateway loads an admin face encoding on startup and compares uploaded images against it using a 0.55 similarity threshold.

### Frontend
- **Page**: `frontend/app/face-login/page.tsx`
- **Features**: Webcam capture, face scanning, voice recognition
- **Store**: Authentication state in Zustand (`isAuthenticated`)

## Setup Instructions

### 1. Backend Setup

#### Install Python Dependencies

```bash
cd gateway
pip install -r requirements.txt
```

This installs:
- face_recognition >= 1.3.0
- pillow >= 10.0.0
- numpy >= 1.24.0

#### Add Admin Face Image

**IMPORTANT**: You must add an admin face image for the system to work.

1. Take a clear photo of the authorized admin's face
2. Save it as `admin.jpg` in the `gateway/` folder (root of gateway, not inside app/)
3. Ensure:
   - Only ONE face is visible in the image
   - Face is well-lit and clearly visible
   - Image is in JPEG format
   - Recommended resolution: 640x480 or higher

#### Start Gateway Server

```bash
cd gateway
python main.py
```

The server will log:
```
✓ Admin face encoding loaded successfully from /path/to/gateway/admin.jpg
```

If you see warnings about admin.jpg not found, the face login will not work.

#### Verify Backend Health

```bash
curl http://localhost:8000/auth/health
```

Should return:
```json
{
  "status": "ready",
  "admin_face_loaded": true
}
```

### 2. Frontend Setup

The frontend changes are already integrated. Just start the dev server:

```bash
cd frontend
npm install
npm run dev
```

### 3. Access Face Login

Navigate to: **http://localhost:3000/face-login**

Or from the main login page, click **"Login with Face Recognition"**

## Usage

### Face Recognition Login

1. Go to `/face-login`
2. Allow camera permissions when prompted
3. Position your face in the camera frame
4. Click **"Scan Face"** button
5. Wait for verification (1-2 seconds)
6. On success: Redirected to `/console`
7. On failure: Error message with reason

### Voice-Triggered Login

1. Click **"Voice Login"** button
2. Allow microphone permissions
3. Say one of the trigger phrases:
   - "login"
   - "authenticate me"
   - "start login"
4. Face scan automatically triggers
5. Authentication proceeds

### Troubleshooting

#### "No face detected"
- Ensure face is clearly visible in frame
- Check lighting conditions
- Move closer to camera

#### "Multiple faces detected"
- Only one person should be in frame
- Remove background people or objects that look like faces

#### "Face not recognized"
- Ensure the admin.jpg matches the person scanning
- Check if admin.jpg has only one clear face
- Try better lighting or different angle

#### Voice recognition not working
- Chrome/Edge work best for Web Speech API
- Firefox may have limited support
- Allow microphone permissions
- Speak clearly and naturally

## API Reference

### POST /auth/face-login

**Request:**
```json
{
  "image": "base64_encoded_jpeg_string"
}
```

**Response (Success):**
```json
{
  "success": true,
  "user": "admin",
  "message": "Face recognized successfully"
}
```

**Response (Failure):**
```json
{
  "success": false,
  "message": "No face detected in image"
}
```

### GET /auth/health

**Response:**
```json
{
  "status": "ready",
  "admin_face_loaded": true
}
```

## Security Notes

⚠️ **This is a demo-level implementation for competition purposes:**

- No JWT tokens or session management
- No rate limiting on authentication attempts
- Single admin user only
- Face encoding stored in memory only (lost on restart)
- No encryption on face data transmission (use HTTPS in production)

For production use, consider:
- Multiple user support with database
- Secure session management
- Rate limiting and attempt tracking
- Encrypted face data storage
- HTTPS/TLS for all communication
- Logging and audit trails

## File Structure

```
gateway/
├── admin.jpg                    # Admin face image (YOU MUST ADD THIS)
├── requirements.txt             # Updated with face_recognition deps
├── app/
│   ├── main.py                 # Registers auth router
│   └── auth.py                 # Face recognition logic

frontend/
├── app/
│   ├── face-login/
│   │   └── page.tsx            # Face login UI with voice support
│   └── page.tsx                # Updated with face login link
├── store/
│   └── appStore.ts             # Added isAuthenticated state
└── app/console/page.tsx        # Protected route
```

## Testing

### Test Face Recognition

1. Add your photo as `gateway/admin.jpg`
2. Start gateway server
3. Navigate to face-login page
4. Click "Scan Face" with yourself in frame
5. Should authenticate successfully

### Test Voice Trigger

1. On face-login page, click "Voice Login"
2. Say "login" clearly
3. Should automatically trigger face scan
4. Should authenticate if face matches

### Test Route Protection

1. Try to access `/console` directly without authentication
2. Should redirect to `/face-login`
3. After successful face authentication
4. Should allow access to `/console`

## Browser Compatibility

| Feature | Chrome | Edge | Firefox | Safari |
|---------|--------|------|---------|--------|
| Camera Access | ✅ | ✅ | ✅ | ✅ |
| Face Login | ✅ | ✅ | ✅ | ✅ |
| Voice Recognition | ✅ | ✅ | ⚠️ Limited | ❌ No |

## Performance

- Face scanning: ~1-2 seconds
- Voice recognition: Real-time
- Camera feed: 30 fps
- Image size: ~100-200 KB per capture

## Future Enhancements

- [ ] Multiple authorized users
- [ ] Face enrollment flow
- [ ] Liveness detection (prevent photo attacks)
- [ ] Face recognition confidence display
- [ ] Authentication history log
- [ ] Mobile app support
- [ ] Offline face authentication
