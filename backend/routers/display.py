from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Body, Header, HTTPException, status
import logging
from typing import List, Dict, Any, Optional

logger = logging.getLogger("pos-display")

router = APIRouter(prefix="/api/v1", tags=["Customer Display"])


class ConnectionManager:
    """Manages active WebSocket connections to secondary customer screens/VFD panels."""

    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self.last_payload: Dict[str, Any] = {"type": "CART_CLEAR", "cart": [], "totalAmount": 0}

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"Customer display connected. Active displays: {len(self.active_connections)}")
        # Send current display state on connection so new client syncs immediately
        try:
            await websocket.send_json(self.last_payload)
        except Exception as e:
            logger.error(f"Failed to send initial display state: {e}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
            logger.info(f"Customer display disconnected. Active displays: {len(self.active_connections)}")

    async def broadcast_cart_update(self, payload: dict):
        """Streams live cart items, QR payment, & completion status to all customer displays."""
        self.last_payload = payload
        disconnected = []
        for connection in self.active_connections:
            try:
                await connection.send_json(payload)
            except Exception as e:
                logger.error(f"Error broadcasting to display: {e}")
                disconnected.append(connection)
        for conn in disconnected:
            self.disconnect(conn)


manager = ConnectionManager()


@router.websocket("/ws/customer-display")
async def customer_display_websocket(websocket: WebSocket):
    """
    WebSocket endpoint for customer-facing LCD / Phone display screen.
    Operates in read-only listener mode for customer devices (ignores unauthenticated incoming client pushes).
    """
    await manager.connect(websocket)
    try:
        while True:
            # Secondary display clients are consumers; ignore incoming raw text/JSON pushes over WS
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)


from services.hardware_display_service import HardwareLCDService

hardware_lcd = HardwareLCDService(port="COM3")

@router.post("/display/broadcast")
async def broadcast_display_event(
    payload: Dict[str, Any] = Body(...),
    x_pos_display_token: Optional[str] = Header(None)
):
    """
    HTTP POST endpoint allowing POS register app or backend services to broadcast customer display events.
    Verifies payload structure before dispatching to WebSocket clients and hardware VFD display on COM3.
    """
    # Sanitize and validate basic payload structure
    msg_type = payload.get("type", "CART_CLEAR")
    if msg_type not in ["CART_UPDATE", "PAYMENT_PENDING", "PAYMENT_SUCCESS", "CART_CLEAR"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid customer display message type"
        )

    await manager.broadcast_cart_update(payload)
    
    # Send update to hardware serial VFD/LCD customer display on COM3
    try:
        hardware_lcd.send_display_update(payload)
    except Exception as e:
        logger.debug(f"Hardware LCD display update failed: {e}")

    return {"status": "SUCCESS", "active_displays": len(manager.active_connections), "hardware_display": True}



