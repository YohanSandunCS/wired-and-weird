"""
REST API endpoints for MediRunner WebSocket Gateway.
"""
import time
from fastapi import APIRouter, File, UploadFile, Form
from typing import List, Optional

from .connection_manager import ConnectionManager
try:
    from .image_processing import process_image
except ImportError:
    # If CV2/Tesseract/Numpy not available, generic fallback
    process_image = None

router = APIRouter()


def create_api_router(manager: ConnectionManager) -> APIRouter:
    """Create API router with connection manager dependency."""
    
    @router.post("/detect-symbols")
    async def detect_symbols(file: UploadFile = File(...), possible_words: Optional[str] = Form(None)):
        """
        Symbol detection endpoint utilizing Computer Vision + OCR.
        """
        if not process_image:
            return {"error": "Image processing module not available (check dependencies)"}
            
        try:
            contents = await file.read()
            words_list = None
            if possible_words:
                 words_list = possible_words.split(',')

            outcome = process_image(contents, words_list)
            
            # If nothing detected, return empty or error
            return {
                "detected": outcome.get("detected", []),
                "logs": outcome.get("logs", [])
            }
        except Exception as e:
            print(f"Prediction failed: {e}")
            return {"detected": [], "logs": [str(e)], "error": str(e)}

    @router.get("/")
    async def root():
        """API documentation endpoint."""
        return {
            "message": "MediRunner WebSocket Gateway",
            "endpoints": {
                "robot": "/ws/robot?robotId=<id>",
                "console": "/ws/console?robotId=<id>",
            },
        }

    @router.get("/health")
    async def health():
        """Health check endpoint."""
        return {"status": "healthy", "timestamp": int(time.time() * 1000)}

    @router.get("/status")
    async def status():
        """Get connection status for all robots."""
        return {
            "connections": manager.get_all_connections(),
            "timestamp": int(time.time() * 1000)
        }

    @router.get("/status/{robot_id}")
    async def robot_status(robot_id: str):
        """Get connection status for a specific robot."""
        return {
            "robot_id": robot_id,
            **manager.get_robot_status(robot_id),
            "timestamp": int(time.time() * 1000)
        }

    return router