"""
WebSocket client for gateway communication
Handles connection, message sending/receiving, and reconnection
"""
import asyncio
import json
import websockets
from datetime import datetime
from config import Config

class WebSocketClient:
    """Manages WebSocket connection to gateway server"""
    
    def __init__(self, message_handler=None):
        """
        Initialize WebSocket client
        Args:
            message_handler: Async callback function for handling received messages
        """
        # Build URL with robotId query parameter
        self.base_url = Config.GATEWAY_URL.format(robot_id=Config.ROBOT_ID)
        self.websocket = None
        self.connected = False
        self.message_handler = message_handler
        self.reconnect_delay = 5  # seconds
        self.max_reconnect_delay = 60  # max backoff
        
        if Config.DEBUG:
            print(f"[WebSocketClient] Initialized for {self.base_url}")
    
    async def connect(self):
        """Establish WebSocket connection to gateway"""
        try:
            if Config.DEBUG:
                print(f"[WebSocketClient] Connecting to {self.base_url}...")
            
            self.websocket = await websockets.connect(self.base_url)
            self.connected = True
            
            if Config.DEBUG:
                print("[WebSocketClient] Connected successfully")
            
            return True
        except Exception as e:
            if Config.DEBUG:
                print(f"[WebSocketClient] Connection failed: {e}")
            self.connected = False
            return False
    
    async def send_message(self, message_dict):
        """
        Send message to gateway in MessageEnvelope format
        Args:
            message_dict: Dict with 'type' and optionally 'payload'
        """
        if not self.connected or not self.websocket:
            if Config.DEBUG:
                print("[WebSocketClient] Cannot send - not connected")
            return False
        
        try:
            # Build message in gateway's expected format
            envelope = {
                'type': message_dict.get('type', 'unknown'),
                'robotId': Config.ROBOT_ID,
                'payload': message_dict.get('payload', {}),
                'timestamp': int(datetime.now().timestamp() * 1000)  # milliseconds
            }
            
            json_message = json.dumps(envelope)
            await self.websocket.send(json_message)
            return True
        except Exception as e:
            if Config.DEBUG:
                print(f"[WebSocketClient] Send error: {e}")
            self.connected = False
            return False
    
    async def send_telemetry(self, telemetry_data):
        """
        Send telemetry data to gateway
        Args:
            telemetry_data: Dict containing sensor readings and status
        """
        message = {
            'type': 'telemetry',
            'payload': telemetry_data
        }
        await self.send_message(message)
    
    async def send_video_frame(self, frame_data, encoding='base64'):
        """
        Send video frame to gateway
        Args:
            frame_data: Base64 string or bytes
            encoding: 'base64' or 'binary'
        """
        message = {
            'type': 'vision_frame',
            'payload': {
                'encoding': encoding,
                'data': frame_data
            }
        }
        await self.send_message(message)
    
    async def receive_messages(self):
        """Listen for incoming messages from gateway"""
        try:
            async for message in self.websocket:
                try:
                    data = json.loads(message)
                    msg_type = data.get('type', 'unknown')
                    
                    # Skip debug output for keep_alive and ping messages to reduce spam
                    if Config.DEBUG and msg_type not in ('keep_alive', 'ping'):
                        print(f"[WebSocketClient] ← {msg_type}")
                    
                    # Call message handler if provided
                    if self.message_handler:
                        await self.message_handler(data)
                
                except json.JSONDecodeError as e:
                    if Config.DEBUG:
                        print(f"[WebSocketClient] Invalid JSON: {e}")
        
        except websockets.exceptions.ConnectionClosed:
            if Config.DEBUG:
                print("[WebSocketClient] Connection closed")
            self.connected = False
        except Exception as e:
            if Config.DEBUG:
                print(f"[WebSocketClient] Receive error: {e}")
            self.connected = False
    
    async def run_with_reconnect(self):
        """Main loop with automatic reconnection"""
        current_delay = self.reconnect_delay
        
        while True:
            if await self.connect():
                # Reset reconnect delay on successful connection
                current_delay = self.reconnect_delay
                
                # Listen for messages
                await self.receive_messages()
            
            # Connection lost or failed
            if Config.DEBUG:
                print(f"[WebSocketClient] Reconnecting in {current_delay}s...")
            
            await asyncio.sleep(current_delay)
            
            # Exponential backoff
            current_delay = min(current_delay * 2, self.max_reconnect_delay)
    
    async def close(self):
        """Close WebSocket connection"""
        if self.websocket:
            await self.websocket.close()
            self.connected = False
            if Config.DEBUG:
                print("[WebSocketClient] Connection closed")
