# Description

This directory contains code for centralized python server.

### Virtual Environment Setup

It's recommended to use a virtual environment to avoid package conflicts:

#### On Windows:
```powershell
# Create virtual environment
python -m venv venv

# Activate virtual environment
.\venv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt

# Run the application
python main.py
```

## ⚙️ Configuration

The application uses environment-based configuration. Create a `.env` file in the project root to customize settings:

```env
# Server Configuration
HOST=0.0.0.0
PORT=8000
RELOAD=true

# Application Settings
TITLE=MediRunner WebSocket Gateway
DESCRIPTION=WebSocket gateway for MediRunner robot communication
VERSION=1.0.0

# CORS Settings
CORS_ORIGINS=*
CORS_METHODS=*
CORS_HEADERS=*
```

## 🏃‍♂️ Running the Application

### Development Mode

For development with hot reloading:

```bash
python main.py
```

The server will start on `http://localhost:8000` with auto-reload enabled.

### Production Mode

For production deployment, set environment variables:

```bash
# Windows PowerShell
$env:RELOAD="false"; python main.py

# Windows CMD
set RELOAD=false && python main.py

```

## 📚 API Documentation

Once the server is running, you can access the interactive API documentation:

- **Swagger UI**: `http://localhost:8000/docs`
- **ReDoc**: `http://localhost:8000/redoc`
- **OpenAPI JSON**: `http://localhost:8000/openapi.json`