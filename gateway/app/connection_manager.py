"""
WebSocket connection manager for handling robot and console connections.
"""
from typing import Dict, List
from fastapi import WebSocket

from .models import MessageEnvelope


class ConnectionManager:
    """Manages WebSocket connections between robots and consoles."""
    
    def __init__(self) -> None:
        # One robot socket per robotId
        self.robot_sockets: Dict[str, WebSocket] = {}
        # Zero or more consoles per robotId
        self.console_sockets: Dict[str, List[WebSocket]] = {}

    async def connect_robot(self, robot_id: str, websocket: WebSocket):
        """Connect a robot WebSocket."""
        await websocket.accept()
        self.robot_sockets[robot_id] = websocket
        print(f"[ROBOT] Connected: {robot_id}")
        self.console_sockets.setdefault(robot_id, [])
        
        # Notify all consoles that robot is now online
        await self.notify_robot_status(robot_id, True)

    async def connect_console(self, robot_id: str, websocket: WebSocket):
        """Connect a console WebSocket."""
        await websocket.accept()
        self.console_sockets.setdefault(robot_id, []).append(websocket)
        print(f"[CONSOLE] Connected for robot: {robot_id}")

    async def disconnect_robot(self, robot_id: str):
        """Disconnect a robot WebSocket."""
        self.robot_sockets.pop(robot_id, None)
        print(f"[ROBOT] Disconnected: {robot_id}")
        
        # Notify all consoles that robot is now offline
        await self.notify_robot_status(robot_id, False)

    def disconnect_console(self, robot_id: str, websocket: WebSocket):
        """Disconnect a console WebSocket."""
        if robot_id in self.console_sockets:
            self.console_sockets[robot_id] = [
                ws for ws in self.console_sockets[robot_id] if ws is not websocket
            ]
            print(f"[CONSOLE] Disconnected for robot: {robot_id}")

    async def send_to_robot(self, robot_id: str, message: MessageEnvelope):
        """Send a message to a specific robot."""
        ws = self.robot_sockets.get(robot_id)
        if ws is None:
            print(f"[WARN] No robot connected for {robot_id}, cannot send {message.type}")
            await self.broadcast_to_consoles(
                robot_id,
                MessageEnvelope(
                    type="error",
                    robotId=robot_id,
                    payload={"message": "Robot not connected"},
                ),
            )
            return

        await ws.send_text(message.model_dump_json())
        print(f"[-> ROBOT {robot_id}] {message.type}")

    async def broadcast_to_consoles(self, robot_id: str, message: MessageEnvelope):
        """Broadcast a message to all consoles connected to a specific robot."""
        sockets = self.console_sockets.get(robot_id, [])
        if not sockets:
            print(f"[WARN] No consoles connected for {robot_id}, dropping {message.type}")
            return

        data = message.model_dump_json()
        for ws in sockets:
            await ws.send_text(data)
        print(f"[ROBOT {robot_id} -> {len(sockets)} CONSOLE(S)] {message.type}")

    async def send_handshake_ping(self, robot_id: str):
        """Send a ping to robot to check liveness when console connects."""
        ping_msg = MessageEnvelope(
            type="ping",
            robotId=robot_id,
            payload={"source": "console_handshake"},
        )
        await self.send_to_robot(robot_id, ping_msg)

    def get_robot_status(self, robot_id: str) -> Dict[str, any]:
        """Get connection status for a specific robot."""
        return {
            "robot_connected": robot_id in self.robot_sockets,
            "console_count": len(self.console_sockets.get(robot_id, [])),
        }

    def get_all_connections(self) -> Dict[str, Dict[str, any]]:
        """Get status of all connections."""
        return {
            robot_id: self.get_robot_status(robot_id)
            for robot_id in set(list(self.robot_sockets.keys()) + list(self.console_sockets.keys()))
        }
    
    async def notify_robot_status(self, robot_id: str, is_online: bool):
        """Notify all consoles about robot status change."""
        status_msg = MessageEnvelope(
            type="robot_status",
            robotId=robot_id,
            payload={
                "isOnline": is_online,
                "source": "robot_connection_change"
            }
        )
        await self.broadcast_to_consoles(robot_id, status_msg)