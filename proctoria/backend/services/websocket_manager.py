from fastapi import WebSocket
import json
import logging
from typing import Dict, Set
import asyncio

logger = logging.getLogger(__name__)

class WebSocketManager:
    """Manages WebSocket connections for real-time communication."""
    
    def __init__(self):
        # Store active connections by session_id
        self.active_connections: Dict[str, WebSocket] = {}
        # Store connections by room (for monitoring dashboard)
        self.monitoring_rooms: Dict[str, Set[WebSocket]] = {}
    
    async def connect(self, websocket: WebSocket, session_id: str):
        """Accept a new WebSocket connection."""
        await websocket.accept()
        self.active_connections[session_id] = websocket
        logger.info(f"WebSocket connected for session {session_id}")
        
        # Send connection confirmation
        await self.send_personal_message(session_id, {
            "type": "connection_established",
            "session_id": session_id,
            "timestamp": self._get_timestamp()
        })
    
    def disconnect(self, session_id: str):
        """Remove a WebSocket connection."""
        if session_id in self.active_connections:
            del self.active_connections[session_id]
            logger.info(f"WebSocket disconnected for session {session_id}")
    
    async def send_personal_message(self, session_id: str, message: dict):
        """Send a message to a specific session."""
        if session_id in self.active_connections:
            try:
                websocket = self.active_connections[session_id]
                await websocket.send_text(json.dumps(message))
            except Exception as e:
                logger.error(f"Failed to send message to session {session_id}: {str(e)}")
                # Remove dead connection
                self.disconnect(session_id)
    
    async def broadcast_to_monitoring(self, room: str, message: dict):
        """Broadcast message to all monitoring dashboard connections."""
        if room in self.monitoring_rooms:
            dead_connections = []
            for websocket in self.monitoring_rooms[room]:
                try:
                    await websocket.send_text(json.dumps(message))
                except Exception as e:
                    logger.error(f"Failed to send broadcast message: {str(e)}")
                    dead_connections.append(websocket)
            
            # Remove dead connections
            for dead_ws in dead_connections:
                self.monitoring_rooms[room].discard(dead_ws)
    
    async def join_monitoring_room(self, websocket: WebSocket, room: str):
        """Add a WebSocket to a monitoring room."""
        if room not in self.monitoring_rooms:
            self.monitoring_rooms[room] = set()
        self.monitoring_rooms[room].add(websocket)
        logger.info(f"WebSocket joined monitoring room {room}")
    
    async def leave_monitoring_room(self, websocket: WebSocket, room: str):
        """Remove a WebSocket from a monitoring room."""
        if room in self.monitoring_rooms:
            self.monitoring_rooms[room].discard(websocket)
            if not self.monitoring_rooms[room]:
                del self.monitoring_rooms[room]
    
    async def handle_message(self, session_id: str, message: dict):
        """Handle incoming WebSocket message."""
        try:
            message_type = message.get("type")
            
            if message_type == "ping":
                await self.send_personal_message(session_id, {
                    "type": "pong",
                    "timestamp": self._get_timestamp()
                })
            
            elif message_type == "violation_alert":
                # Forward violation alert to monitoring dashboard
                await self.broadcast_to_monitoring("admin", {
                    "type": "violation_alert",
                    "session_id": session_id,
                    "violation": message.get("violation"),
                    "timestamp": self._get_timestamp()
                })
            
            elif message_type == "status_update":
                # Handle status updates from student
                await self.broadcast_to_monitoring("admin", {
                    "type": "session_status_update",
                    "session_id": session_id,
                    "status": message.get("status"),
                    "timestamp": self._get_timestamp()
                })
            
            elif message_type == "emergency_stop":
                # Handle emergency stop request
                await self.send_personal_message(session_id, {
                    "type": "session_paused",
                    "reason": "Emergency stop requested",
                    "timestamp": self._get_timestamp()
                })
                
                await self.broadcast_to_monitoring("admin", {
                    "type": "emergency_stop",
                    "session_id": session_id,
                    "timestamp": self._get_timestamp()
                })
            
            logger.debug(f"Handled message type {message_type} for session {session_id}")
            
        except Exception as e:
            logger.error(f"Error handling WebSocket message for session {session_id}: {str(e)}")
    
    async def send_violation_alert(self, session_id: str, violation: dict):
        """Send violation alert to student and monitoring dashboard."""
        alert_message = {
            "type": "violation_detected",
            "violation": violation,
            "timestamp": self._get_timestamp()
        }
        
        # Send to student
        await self.send_personal_message(session_id, alert_message)
        
        # Send to monitoring dashboard
        admin_message = {
            "type": "violation_alert",
            "session_id": session_id,
            "violation": violation,
            "timestamp": self._get_timestamp()
        }
        await self.broadcast_to_monitoring("admin", admin_message)
    
    async def send_risk_update(self, session_id: str, risk_score: float):
        """Send risk score update."""
        message = {
            "type": "risk_score_update",
            "risk_score": risk_score,
            "timestamp": self._get_timestamp()
        }
        
        # Send to student
        await self.send_personal_message(session_id, message)
        
        # Send to monitoring dashboard
        admin_message = {
            "type": "session_risk_update",
            "session_id": session_id,
            "risk_score": risk_score,
            "timestamp": self._get_timestamp()
        }
        await self.broadcast_to_monitoring("admin", admin_message)
    
    async def send_session_ended(self, session_id: str):
        """Send session ended notification."""
        message = {
            "type": "session_ended",
            "timestamp": self._get_timestamp()
        }
        
        await self.send_personal_message(session_id, message)
        
        # Notify monitoring dashboard
        admin_message = {
            "type": "session_ended",
            "session_id": session_id,
            "timestamp": self._get_timestamp()
        }
        await self.broadcast_to_monitoring("admin", admin_message)
        
        # Clean up connection
        self.disconnect(session_id)
    
    async def send_admin_intervention(self, session_id: str, message: str):
        """Send admin intervention message to student."""
        intervention_message = {
            "type": "admin_intervention",
            "message": message,
            "timestamp": self._get_timestamp()
        }
        
        await self.send_personal_message(session_id, intervention_message)
    
    def get_active_sessions(self) -> list:
        """Get list of active session IDs."""
        return list(self.active_connections.keys())
    
    def get_connection_count(self) -> int:
        """Get number of active connections."""
        return len(self.active_connections)
    
    def get_monitoring_room_count(self, room: str) -> int:
        """Get number of connections in a monitoring room."""
        return len(self.monitoring_rooms.get(room, set()))
    
    def _get_timestamp(self) -> str:
        """Get current timestamp in ISO format."""
        from datetime import datetime
        return datetime.utcnow().isoformat()
    
    async def heartbeat_check(self):
        """Periodic heartbeat check for all connections."""
        dead_sessions = []
        
        for session_id, websocket in self.active_connections.items():
            try:
                await websocket.ping()
            except Exception as e:
                logger.warning(f"Heartbeat failed for session {session_id}: {str(e)}")
                dead_sessions.append(session_id)
        
        # Clean up dead connections
        for session_id in dead_sessions:
            self.disconnect(session_id)
        
        logger.debug(f"Heartbeat check completed. Removed {len(dead_sessions)} dead connections")
    
    async def start_heartbeat_task(self):
        """Start background heartbeat task."""
        while True:
            await asyncio.sleep(30)  # Check every 30 seconds
            await self.heartbeat_check()