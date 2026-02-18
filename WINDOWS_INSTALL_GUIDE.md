# Windows Installation Guide for Face Recognition

## 🪟 Windows-Specific Setup

The `face_recognition` library can be challenging to install on Windows. Follow these steps:

## Method 1: Using Pre-built Wheels (Recommended)

### Step 1: Install Visual C++ Build Tools (if needed)

Download and install: [Microsoft C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)

### Step 2: Install CMake

```powershell
pip install cmake
```

### Step 3: Install dlib (Pre-built)

Try the pre-built wheel first:

```powershell
pip install dlib
```

If this fails, download a pre-built wheel from:
https://github.com/z-mahmud22/Dlib_Windows_Python3.x

Then install:
```powershell
pip install dlib-19.24.0-cp312-cp312-win_amd64.whl  # Adjust for your Python version
```

### Step 4: Install face_recognition

```powershell
pip install face_recognition
```

### Step 5: Install Other Dependencies

```powershell
cd gateway
pip install -r requirements.txt
```

## Method 2: Using Conda (Alternative)

If you have Anaconda/Miniconda:

```powershell
conda create -n medirunner python=3.10
conda activate medirunner
conda install -c conda-forge dlib
pip install face_recognition
pip install -r requirements.txt
```

## Method 3: Docker (If All Else Fails)

Create `gateway/Dockerfile`:

```dockerfile
FROM python:3.10-slim

WORKDIR /app

# Install dependencies for dlib
RUN apt-get update && apt-get install -y \
    cmake \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["python", "main.py"]
```

Run with Docker:
```powershell
cd gateway
docker build -t medirunner-gateway .
docker run -p 8000:8000 -v ${PWD}/admin.jpg:/app/admin.jpg medirunner-gateway
```

## Verification

Test if face_recognition works:

```powershell
python -c "import face_recognition; print('✓ face_recognition installed successfully')"
```

## Common Windows Errors

### Error: "Microsoft Visual C++ 14.0 or greater is required"

**Solution**: Install [Visual C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)

### Error: "Could not build wheels for dlib"

**Solution**: Use pre-built dlib wheel from GitHub (see Method 1, Step 3)

### Error: "No module named 'cmake'"

**Solution**: 
```powershell
pip install cmake
```

### Error: "DLL load failed" when importing face_recognition

**Solution**: Install Visual C++ Redistributable:
- [VC++ 2015-2022 Redistributable (x64)](https://aka.ms/vs/17/release/vc_redist.x64.exe)

## PowerShell Tips

### Check Python Version
```powershell
python --version  # Should be 3.8+
```

### Check pip Version
```powershell
pip --version
```

### Force Reinstall
```powershell
pip install --force-reinstall --no-cache-dir face_recognition
```

### List Installed Packages
```powershell
pip list | Select-String "face|dlib|cmake"
```

## Alternative: Use WSL2 (Windows Subsystem for Linux)

If Windows installation is too problematic:

1. Install WSL2: https://learn.microsoft.com/en-us/windows/wsl/install
2. Open WSL2 Ubuntu terminal
3. Run Linux installation:

```bash
sudo apt-get update
sudo apt-get install -y python3-pip cmake build-essential
pip3 install face_recognition
cd /mnt/d/MediRunner/ww/wired-and-weird/gateway
pip3 install -r requirements.txt
python3 main.py
```

## Test Backend After Installation

```powershell
cd gateway
python main.py
```

Should see:
```
INFO:     Started server process
INFO:     Uvicorn running on http://0.0.0.0:8000
✓ Admin face encoding loaded successfully
```

Then test in browser: http://localhost:8000/auth/health

## Performance Notes

- First face recognition may take 2-3 seconds on Windows
- Subsequent scans are faster (~1 second)
- On slower machines, consider reducing image quality in capture

## Still Having Issues?

1. Check Python version: `python --version` (must be 3.8-3.11, not 3.12+ yet)
2. Try in a fresh virtual environment:
   ```powershell
   python -m venv venv
   .\venv\Scripts\Activate
   pip install -r requirements.txt
   ```
3. Share error logs in project Issues

## Resources

- [face_recognition GitHub](https://github.com/ageitgey/face_recognition)
- [dlib Windows Guide](https://github.com/z-mahmud22/Dlib_Windows_Python3.x)
- [CMake Downloads](https://cmake.org/download/)
