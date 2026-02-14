"""
Data models for MediRunner WebSocket Gateway.
"""
import time
from typing import Optional, Dict, Any

from pydantic import BaseModel, Field


class MessageEnvelope(BaseModel):
    """Standard message envelope for all WebSocket communications."""
    type: str
    robotId: str
    payload: Optional[Dict[str, Any]] = None
    timestamp: int = Field(default_factory=lambda: int(time.time() * 1000))