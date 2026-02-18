"""
WebSocket endpoints for robot and console connections.
"""
import asyncio
import time
from fastapi import WebSocket, WebSocketDisconnect, Query, APIRouter

from .models import MessageEnvelope
from .connection_manager import ConnectionManager

router = APIRouter()


def create_websocket_router(manager: ConnectionManager) -> APIRouter:
    """Create WebSocket router with connection manager dependency."""
    
    @router.websocket("/robot")
    async def robot_ws(websocket: WebSocket, robotId: str = Query(...)):
        """Robot connects here. Receives ping/commands, sends pong/telemetry."""
        print(f"🤖 [DEBUG] Robot connection attempt: robotId={robotId}")
        await manager.connect_robot(robotId, websocket)
        print(f"🤖 [DEBUG] Robot {robotId} connected successfully")

        # Create keep-alive task to prevent timeouts during debugging
        async def keep_alive():
            while True:
                try:
                    await asyncio.sleep(30)  # Keep alive every 30 seconds
                    # Send a simple keep-alive message instead of ping
                    keep_alive_msg = MessageEnvelope(
                        type="keep_alive",
                        robotId=robotId,
                        payload={"source": "gateway"}
                    )
                    await websocket.send_text(keep_alive_msg.model_dump_json())
                    print(f"🤖 [KEEPALIVE] Sent keep-alive to robot {robotId}")
                except Exception as e:
                    print(f"🤖 [KEEPALIVE] Failed for robot {robotId}: {e}")
                    break

        keep_alive_task = asyncio.create_task(keep_alive())

        try:
            while True:
                try:
                    # Use timeout to prevent hanging indefinitely during debugging
                    raw = await asyncio.wait_for(websocket.receive_text(), timeout=120.0)
                    print(f"🤖 [MSG] Robot {robotId}: {raw[:100]}{'...' if len(raw) > 100 else ''}")
                    
                    try:
                        msg = MessageEnvelope.model_validate_json(raw)
                    except Exception as e:
                        print(f"🤖 [ERROR] Robot {robotId} invalid message: {e}")
                        continue

                    if msg.type == "pong":
                        print(f"🤖 [PONG] Robot {robotId} -> consoles")
                        await manager.broadcast_to_consoles(robotId, msg)

                    elif msg.type in ("telemetry", "event", "vision", "mission_update", "vision_frame", "panoramic_image"):
                        print(f"🤖 [DATA] Robot {robotId} {msg.type}")
                        await manager.broadcast_to_consoles(robotId, msg)

                    elif msg.type == "keep_alive":
                        print(f"🤖 [KEEPALIVE] Robot {robotId} acknowledged keep-alive")
                        # Keep-alive messages are just for connection health, no forwarding needed

                    else:
                        print(f"🤖 [UNKNOWN] Robot {robotId} type: {msg.type}")

                except asyncio.TimeoutError:
                    print(f"🤖 [TIMEOUT] Robot {robotId} - no message for 120s, checking connection...")
                    try:
                        # Send a simple ping message to check if connection is alive
                        ping_msg = MessageEnvelope(
                            type="ping",
                            robotId=robotId,
                            payload={"source": "timeout_check"}
                        )
                        await websocket.send_text(ping_msg.model_dump_json())
                        print(f"🤖 [PING] Robot {robotId} still alive")
                        continue  # Connection is alive, keep waiting
                    except Exception:
                        print(f"🤖 [DEAD] Robot {robotId} connection dead")
                        break

        except WebSocketDisconnect as e:
            print(f"🤖 [DISCONNECT] Robot {robotId} - code: {e.code}")
            await manager.disconnect_robot(robotId)
        except Exception as e:
            print(f"🤖 [ERROR] Robot {robotId} WebSocket error: {type(e).__name__}: {e}")
            await manager.disconnect_robot(robotId)
        finally:
            keep_alive_task.cancel()

    @router.websocket("/console")
    async def console_ws(websocket: WebSocket, robotId: str = Query(...)):
        """
        Next.js UI connects here.
        On connect:
          - register console
          - send a ping to the robot (handshake)
        """
        print(f"🖥️ [DEBUG] Console connection attempt: robotId={robotId}")
        await manager.connect_console(robotId, websocket)
        print(f"🖥️ [DEBUG] Console {robotId} connected")

        # Create keep-alive task for console to prevent timeouts during debugging
        async def keep_alive():
            while True:
                try:
                    await asyncio.sleep(30)  # Keep alive every 30 seconds
                    # Send a simple keep-alive message instead of ping
                    keep_alive_msg = MessageEnvelope(
                        type="keep_alive",
                        robotId=robotId,
                        payload={"source": "gateway"}
                    )
                    await websocket.send_text(keep_alive_msg.model_dump_json())
                    print(f"🖥️ [KEEPALIVE] Sent keep-alive to console {robotId}")
                except Exception as e:
                    print(f"🖥️ [KEEPALIVE] Failed for console {robotId}: {e}")
                    break

        keep_alive_task = asyncio.create_task(keep_alive())

        # 🔹 Send robot status immediately when console connects
        try:
            robot_status = manager.get_robot_status(robotId)
            status_msg = MessageEnvelope(
                type="robot_status",
                robotId=robotId,
                payload={
                    "isOnline": robot_status["robot_connected"],
                    "source": "console_connect"
                }
            )
            await websocket.send_text(status_msg.model_dump_json())
            print(f"🖥️ [STATUS] Sent robot status to console: {robotId} online={robot_status['robot_connected']}")
        except Exception as e:
            print(f"🖥️ [STATUS] Failed to send status for {robotId}: {e}")

        # 🔹 Handshake: try ping robot as soon as console connects
        try:
            await manager.send_handshake_ping(robotId)
            print(f"🖥️ [HANDSHAKE] Sent ping to robot {robotId}")
        except Exception as e:
            print(f"🖥️ [HANDSHAKE] Failed to ping robot {robotId}: {e}")

        try:
            while True:
                try:
                    # Longer timeout for console during debugging (5 minutes)
                    raw = await asyncio.wait_for(websocket.receive_text(), timeout=300.0)
                    print(f"🖥️ [MSG] Console {robotId}: {raw[:100]}{'...' if len(raw) > 100 else ''}")
                    
                    try:
                        msg = MessageEnvelope.model_validate_json(raw)
                    except Exception as e:
                        print(f"🖥️ [ERROR] Console {robotId} invalid message: {e}")
                        continue

                    # Console-originated messages that should go to robot:
                    if msg.type in ("ping", "command", "mission"):
                        print(f"🖥️ [SEND] Console {robotId} -> robot: {msg.type}")
                        await manager.send_to_robot(robotId, msg)
                    elif msg.type == "keep_alive":
                        print(f"🖥️ [KEEPALIVE] Console {robotId} acknowledged keep-alive")
                        # Keep-alive messages are just for connection health, no forwarding needed
                    else:
                        print(f"🖥️ [UNKNOWN] Console {robotId} type: {msg.type}")

                except asyncio.TimeoutError:
                    print(f"🖥️ [TIMEOUT] Console {robotId} - no message for 300s, checking connection...")
                    try:
                        # Send a simple ping message to check if connection is alive
                        ping_msg = MessageEnvelope(
                            type="ping",
                            robotId=robotId,
                            payload={"source": "timeout_check"}
                        )
                        await websocket.send_text(ping_msg.model_dump_json())
                        print(f"🖥️ [PING] Console {robotId} still alive")
                        continue  # Connection is alive, keep waiting
                    except Exception:
                        print(f"🖥️ [DEAD] Console {robotId} connection dead")
                        break

        except WebSocketDisconnect as e:
            print(f"🖥️ [DISCONNECT] Console {robotId} - code: {e.code}")
            manager.disconnect_console(robotId, websocket)
        except Exception as e:
            print(f"🖥️ [ERROR] Console {robotId} WebSocket error: {type(e).__name__}: {e}")
            manager.disconnect_console(robotId, websocket)
        finally:
            keep_alive_task.cancel()

    return router