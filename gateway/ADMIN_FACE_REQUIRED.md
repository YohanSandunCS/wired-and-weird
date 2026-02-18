# Admin Face Image Required

## ⚠️ IMPORTANT: Add Admin Face Image

To use face recognition authentication, you MUST add an admin face image to this directory.

### Instructions:

1. Take a clear, well-lit photo of the authorized admin
2. Ensure:
   - Only ONE face is visible
   - Face is clearly visible and well-lit
   - Front-facing photo (not profile)
   - Neutral expression recommended
3. Save the image as `admin.jpg` in this directory (`gateway/`)
4. Image requirements:
   - Format: JPEG
   - Recommended size: 640x480 or higher
   - File size: < 5 MB

### Verification:

After adding the image, start the gateway server:

```bash
python main.py
```

You should see:
```
✓ Admin face encoding loaded successfully
```

If you see warnings, check:
- File is named exactly `admin.jpg` (case-sensitive on Linux/Mac)
- File is in JPEG format
- Face is clearly visible in the image
- Only one face is present

### Quick Test:

You can use the `/auth/health` endpoint to verify:

```bash
curl http://localhost:8000/auth/health
```

Expected response:
```json
{
  "status": "ready",
  "admin_face_loaded": true
}
```

---

**For Testing**: You can use any clear face photo. For demo purposes, a photo taken with your webcam or phone camera works fine.
