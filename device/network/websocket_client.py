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
        self.url = Config.GATEWAY_URL
        self.websocket = None
        self.connected = False
        self.message_handler = message_handler
        self.reconnect_delay = 5  # seconds
        self.max_reconnect_delay = 60  # max backoff
        
        if Config.DEBUG:
            print(f"[WebSocketClient] Initialized for {self.url}")
    
    async def connect(self):
        """Establish WebSocket connection to gateway"""
        try:
            if Config.DEBUG:
                print(f"[WebSocketClient] Connecting to {self.url}...")
            
            self.websocket = await websockets.connect(self.url)
            self.connected = True
            
            if Config.DEBUG:
                print("[WebSocketClient] Connected successfully")
            
            # Send registration message
            await self.register()
            
            return True
        except Exception as e:
            if Config.DEBUG:
                print(f"[WebSocketClient] Connection failed: {e}")
            self.connected = False
            return False
    
    async def register(self):
        """Send registration message to gateway"""
        registration_msg = {
            'type': 'registration',
            'robot_id': Config.ROBOT_ID,
            'robot_name': Config.ROBOT_NAME,
            'timestamp': datetime.now().isoformat()
        }
        await self.send_message(registration_msg)
        
        if Config.DEBUG:
            print(f"[WebSocketClient] Registered as {Config.ROBOT_ID}")
    
    async def send_message(self, message):
        """
        Send message to gateway
        Args:
            message: Dict to be serialized as JSON
        """
        if not self.connected or not self.websocket:
            if Config.DEBUG:
                print("[WebSocketClient] Cannot send - not connected")
            return False
        
        try:
            json_message = json.dumps(message)
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
            'robot_id': Config.ROBOT_ID,
            'timestamp': datetime.now().isoformat(),
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
            'type': 'video_frame',
            'robot_id': Config.ROBOT_ID,
            'timestamp': datetime.now().isoformat(),
            'encoding': encoding,
            'payload': frame_data
        }
        await self.send_message(message)
    
    async def receive_messages(self):
        """Listen for incoming messages from gateway"""
        try:
            async for message in self.websocket:
                try:
                    data = json.loads(message)
                    if Config.DEBUG:
                        print(f"[WebSocketClient] Received: {data.get('type', 'unknown')}")
                    
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
