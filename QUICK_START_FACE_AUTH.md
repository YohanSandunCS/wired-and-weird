# Quick Start: Face Recognition Authentication

## 🚀 Quick Installation & Setup (5 minutes)

### Step 1: Install Backend Dependencies

```bash
cd gateway
pip install -r requirements.txt
```

> **Note**: If `face_recognition` installation fails on Windows, you may need to install CMake and dlib first:
> ```bash
> pip install cmake
> pip install dlib
> pip install face_recognition
> ```

### Step 2: Add Admin Face

1. Take a photo of yourself (or the admin user)
2. Save as `gateway/admin.jpg`
3. Verify it's a clear, front-facing photo with only one face

### Step 3: Start Gateway

```bash
cd gateway
python main.py
```

**Look for this message:**
```
✓ Admin face encoding loaded successfully
```

### Step 4: Start Frontend

```bash
cd frontend
npm install  # if not already done
npm run dev
```

### Step 5: Test Face Login

1. Open: http://localhost:3000/face-login
2. Allow camera access
3. Click "Scan Face"
4. Should authenticate if your face matches admin.jpg

## 🎤 Test Voice Login

1. On face-login page, click "Voice Login"
2. Say "login" or "authenticate me"
3. Should auto-trigger face scan

## ✅ Verification Checklist

- [ ] Gateway running on port 8000
- [ ] Admin face loaded message appeared
- [ ] Frontend running on port 3000
- [ ] Camera permissions granted
- [ ] Face scan successful
- [ ] Redirected to `/console` after authentication

## 🐛 Common Issues

### "Admin face not found"
- Ensure `admin.jpg` is in `gateway/` folder (not inside `app/`)
- Check file name is exactly `admin.jpg`

### "No face detected"
- Ensure face is clearly visible
- Check camera works in browser
- Try better lighting

### "Face not recognized"
- Verify admin.jpg matches the person scanning
- Ensure good lighting when scanning
- Try capturing admin.jpg again with better quality

### "Voice recognition not working"
- Use Chrome or Edge browser (best support)
- Allow microphone permissions
- Speak clearly after clicking "Voice Login"

## 📁 Created Files

**Backend:**
- `gateway/app/auth.py` - Face recognition logic
- `gateway/requirements.txt` - Updated with face_recognition deps

**Frontend:**
- `frontend/app/face-login/page.tsx` - Face login UI
- `frontend/store/appStore.ts` - Added auth state

**Documentation:**
- `FACE_AUTH_SETUP.md` - Detailed setup guide
- `QUICK_START_FACE_AUTH.md` - This file

## 🔗 Useful Endpoints

- **Health Check**: http://localhost:8000/auth/health
- **Face Login**: http://localhost:3000/face-login
- **Console** (protected): http://localhost:3000/console

## 💡 Tips

1. **Better Recognition**: Take admin.jpg in similar lighting to where you'll scan
2. **Voice Commands**: Speak naturally, not too fast
3. **Camera Position**: Center your face in the frame
4. **One Person Only**: Ensure only one face is visible

## 🎯 Next Steps

After successful authentication:
1. You'll be redirected to `/console`
2. You can then log in with team code
3. Access robot control features

## 📞 Support

Check the full documentation in `FACE_AUTH_SETUP.md` for:
- API reference
- Security notes
- Troubleshooting
- Architecture details
