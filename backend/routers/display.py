from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import logging
from typing import List

logger = logging.getLogger("pos-display")

router = APIRouter(prefix="/api/v1/ws", tags=["Customer LCD Display"])


class ConnectionManager:
    """Manages active WebSocket connections to secondary customer screens/VFD panels."""

    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"Customer display connected. Active displays: {len(self.active_connections)}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            logger.info(f"Customer display disconnected. Active displays: {len(self.active_connections)}")

    async def broadcast_cart_update(self, cart_payload: dict):
        """Streams live cart items & total amount to customer LCD screen."""
        for connection in self.active_connections:
            try:
                await connection.send_json(cart_payload)
            except Exception as e:
                logger.error(f"Error broadcasting to display: {e}")


manager = ConnectionManager()


@router.websocket("/customer-display")
async def customer_display_websocket(websocket: WebSocket):
    """
    WebSocket endpoint for customer-facing LCD display screen.
    Receives real-time JSON updates when items are added to cart or total amount changes.
    """
    await manager.connect(websocket)
    try:
        while True:
            # Receive message from POS register or secondary client
            data = await websocket.receive_json()
            await manager.broadcast_cart_update(data)
    except WebSocketDisconnect:
        manager.disconnect(websocket)
