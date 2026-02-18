# Production Face Recognition - Quick Start Guide

## What Changed?

Your system has been upgraded from **demo mode** (simple image comparison) to **production mode** (neural network face recognition with real-time detection).

### Demo Mode vs Production Mode

| Feature | Demo Mode | Production Mode |
|---------|-----------|-----------------|
| Backend | `auth_simple.py` - histogram comparison | `auth_production.py` - 128-D face embeddings |
| Face Detection | None (accepts any image) | Real face detection + validation |
| Match Algorithm | Pixel similarity (55% threshold) | Euclidean distance on embeddings (0.6 threshold) |
| Frontend | Basic camera capture | MediaPipe face detection with bounding boxes |
| Security | Low (can be fooled) | High (neural network based) |
| Dependencies | Pillow only | face_recognition, dlib, opencv, MediaPipe |
| Accuracy | ~60% | ~95-99% |

## Installation (One-Time Setup)

### Option 1: Automated Script (Recommended)

Run the PowerShell setup script from project root:

```powershell
.\setup_production.ps1
```

This will:
- ✅ Install backend dependencies (dlib, face_recognition, opencv)
- ✅ Install frontend dependencies (MediaPipe)
- ✅ Verify installation
- ✅ Check configuration
- ✅ Show next steps

### Option 2: Manual Installation

#### Backend (Python)

1. Navigate to gateway directory:
```powershell
cd gateway
```

2. Activate virtual environment:
```powershell
venv\Scripts\Activate.ps1
```

3. Install dlib (pre-built wheel for Windows):
```powershell
pip install https://github.com/z-mahmud22/Dlib_Windows_Python3.x/raw/main/dlib-19.24.1-cp312-cp312-win_amd64.whl
```

4. Install other dependencies:
```powershell
pip install -r requirements_production.txt
```

#### Frontend (Node.js)

1. Navigate to frontend directory:
```powershell
cd frontend
```

2. Install MediaPipe packages:
```powershell
npm install @mediapipe/face_detection @mediapipe/camera_utils
```

## Configuration

### Backend Configuration

**File:** `gateway/app/main.py` (Line 14)

Change from:
```python
from .auth_simple import create_auth_router
```

To:
```python
from .auth_production import create_auth_router
```

✅ **This is already done for you!**

### Frontend Configuration

**File:** `frontend/app/page.tsx`

Login route changed to: `/face-login-production`  
Enrollment route changed to: `/enroll-production`

✅ **This is already done for you!**

## Running the System

### 1. Start Gateway Server

```powershell
cd gateway
venv\Scripts\Activate.ps1
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

You should see:
```
INFO:     Uvicorn running on http://0.0.0.0:8000
INFO:     Application startup complete.
```

### 2. Start Frontend (New Terminal)

```powershell
cd frontend
npm run dev
```

You should see:
```
  ▲ Next.js 16.0.3
  - Local:        http://localhost:3000
```

### 3. Open Browser

Navigate to: **http://localhost:3000**

## Using the System

### First Time: Enroll Users

1. Click **"Enroll New User"** button
2. Allow camera access when prompted
3. You should see:
   - ✅ Camera feed displayed
   - ✅ **Green bounding box around your face**
   - ✅ Face detection status indicator
   - ✅ "Enroll Face" button enabled
4. Enter username and click "Enroll Face"
5. Backend will:
   - Detect face in the image
   - Extract 128-dimensional face encoding
   - Save to `enrolled_users_encodings.json`
6. Your face is now registered!

### Login with Face Recognition

1. Click **"Login with Face Recognition"** button
2. Allow camera access
3. You should see:
   - ✅ Camera feed displayed
   - ✅ **Green bounding box around your face**
   - ✅ Face detection status: "✓ Face Detected"
   - ✅ "Scan Face" button enabled
4. Click "Scan Face"
5. Backend will:
   - Detect face in the image
   - Extract face encoding
   - Compare against all enrolled users
   - Match if distance < 0.6
6. If matched, you're logged in!

## Visual Indicators

### Face Detection (Frontend)

When MediaPipe detects a face, you'll see:
- 🟢 **Green bounding box** around face
- 🟢 Corner markers (┌ ┐ └ ┘)
- 🟢 Confidence percentage (e.g., "92%")
- ✅ Status: "Face Detected"

When no face detected:
- ❌ Status: "No Face Detected"
- 🔴 Button disabled

### Console Output (Backend)

During enrollment:
```
[FACE ENROLL] Processing enrollment for user: john_doe
[FACE ENROLL] Detected 1 face(s) in image
[FACE ENROLL] ✓ Face encoding extracted
[FACE ENROLL] ✓ User enrolled successfully
```

During login:
```
[FACE VERIFY] Processing verification
[FACE VERIFY] Detected 1 face(s) in image
[FACE VERIFY] Comparing against 3 enrolled user(s)
[FACE VERIFY] User: john_doe | Distance: 0.42 | Confidence: 58%
[FACE VERIFY] User: jane_smith | Distance: 0.89 | Confidence: 11%
[FACE VERIFY] User: bob_jones | Distance: 0.76 | Confidence: 24%
[FACE VERIFY] ✓ Match found: john_doe (distance: 0.42)
```

## How It Works

### Backend (face_recognition library)

1. **Face Detection:** Uses HOG detector to find faces in image
2. **Encoding Extraction:** Deep learning model extracts 128-D feature vector
3. **Matching:** Computes Euclidean distance between encodings
4. **Threshold:** Distance < 0.6 = Match

### Frontend (MediaPipe)

1. **Real-time Detection:** Runs face detection on every camera frame
2. **Bounding Box:** Draws green box around detected face
3. **Face Cropping:** Crops detected face region with 20% padding
4. **Validation:** Only enables button when face is detected

## Troubleshooting

### Issue: "No face detected" but face is clearly visible

**Solution:** Adjust lighting or face angle. Face should be:
- ✅ Well-lit (not too dark/bright)
- ✅ Front-facing (not profile)
- ✅ Clear (not blurry)
- ✅ Centered in frame

### Issue: dlib installation fails

**Solution:** Use pre-built wheel:
```powershell
pip install https://github.com/z-mahmud22/Dlib_Windows_Python3.x/raw/main/dlib-19.24.1-cp312-cp312-win_amd64.whl
```

If Python version mismatch, download correct wheel from:
https://github.com/z-mahmud22/Dlib_Windows_Python3.x

### Issue: MediaPipe not loading

**Solution:** Check internet connection (models load from CDN). Or install offline:
```powershell
npm install @mediapipe/face_detection @mediapipe/camera_utils --save
```

### Issue: "Face detected" but login fails

**Solution:** 
1. Check if user is enrolled: `gateway/enrolled_users_encodings.json`
2. Check console output for distance values
3. If distance > 0.6, face doesn't match (security feature)
4. Try re-enrolling with clearer image

### Issue: Multiple faces in frame

**Solution:** 
- Enrollment: Will reject (security feature)
- Login: Will use first detected face
- Best practice: Only one person in frame

## File Structure

### Backend Files
```
gateway/
├── app/
│   ├── main.py (✨ Updated to use auth_production)
│   ├── auth_simple.py (Old demo mode)
│   └── auth_production.py (✨ NEW production mode)
├── requirements_production.txt (✨ NEW)
├── PRODUCTION_SETUP.py (✨ NEW setup instructions)
└── enrolled_users_encodings.json (Auto-created on first enrollment)
```

### Frontend Files
```
frontend/
├── app/
│   ├── page.tsx (✨ Updated routes)
│   ├── face-login-production/
│   │   └── page.tsx (✨ NEW production login)
│   └── enroll-production/
│       └── page.tsx (✨ NEW production enrollment)
└── MEDIAPIPE_INSTALL.md (✨ NEW)
```

## Next Steps

### Test the System

1. ✅ Enroll yourself as first user
2. ✅ Login with your face
3. ✅ Enroll another person
4. ✅ Try logging in as them
5. ✅ Verify it rejects wrong faces

### Monitor Logs

Watch backend console for:
- Face detection results
- Distance calculations
- Match confidence percentages

### Tune Threshold (Optional)

If getting too many false positives/negatives, edit `gateway/app/auth_production.py`:

```python
FACE_MATCH_THRESHOLD = 0.6  # Lower = stricter, Higher = more lenient
```

- **Stricter (0.4-0.5):** Fewer false positives, may reject same person
- **Default (0.6):** Good balance
- **Lenient (0.7-0.8):** More tolerant, higher false positive risk

## Additional Resources

- **Full Setup Guide:** `PRODUCTION_FACE_RECOGNITION_SETUP.md`
- **Backend Details:** `gateway/PRODUCTION_SETUP.py`
- **Frontend Details:** `frontend/MEDIAPIPE_INSTALL.md`
- **face_recognition Docs:** https://github.com/ageitgey/face_recognition
- **MediaPipe Docs:** https://google.github.io/mediapipe/

## Switching Back to Demo Mode

If you need to revert to demo mode:

1. Edit `gateway/app/main.py` line 14:
```python
from .auth_simple import create_auth_router
```

2. Edit `frontend/app/page.tsx`:
```typescript
router.push('/face-login')  // Instead of face-login-production
router.push('/enroll')      // Instead of enroll-production
```

3. Restart servers

## Summary

✨ **You now have production-grade face recognition!**

- ✅ Real face detection (not fooled by random images)
- ✅ Neural network embeddings (95%+ accuracy)
- ✅ Real-time visual feedback (bounding boxes)
- ✅ Secure matching algorithm (distance-based)
- ✅ Privacy-friendly (stores encodings, not images)

Happy testing! 🚀
