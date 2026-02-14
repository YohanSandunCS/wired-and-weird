"""
REST API endpoints for MediRunner WebSocket Gateway.
"""
import time
from fastapi import APIRouter

from .connection_manager import ConnectionManager

router = APIRouter()


def create_api_router(manager: ConnectionManager) -> APIRouter:
    """Create API router with connection manager dependency."""
    
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