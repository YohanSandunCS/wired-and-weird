"""
Entry point for running the MediRunner WebSocket Gateway server.
"""
import uvicorn
from app.config import settings
import os


if __name__ == "__main__":
    # Check if running in debug mode
    debug_mode = os.getenv("PYTHONDEBUG") == "1" or "debugpy" in os.environ
    
    if debug_mode:
        # For debugging: import the app directly and run with debugger-friendly settings
        from app.main import app
        uvicorn.run(
            app,
            host=settings.host,
            port=settings.port,
            reload=False,  # Disable reload in debug mode
            log_level="debug"
        )
    else:
        # Production mode: use string reference for hot reloading
        uvicorn.run(
            "app.main:app",
            host=settings.host,
            port=settings.port,
            reload=settings.reload
        )
