import logging
import serial
from typing import Dict, Any, Optional

logger = logging.getLogger("pos-hardware-display")

cz_chars  = "áčďéěíňóřšťúůýžÁČĎÉĚÍŇÓŘŠŤÚŮÝŽ"
asc_chars = "acdeeinorstuuyzACDEEINORSTUUYZ"
trans_tbl = str.maketrans(cz_chars, asc_chars)


def detect_vfd_com_port() -> Optional[str]:
    """Detects connected Prolific / FTDI / USB-Serial COM ports on Windows."""
    try:
        import win32com.client
        wmi = win32com.client.GetObject("winmgmts:\\\\.\\root\\cimv2")
        ports = wmi.ExecQuery("SELECT Name, DeviceID FROM Win32_PnPEntity WHERE Name LIKE '%(COM%'")
        for p in ports:
            p_name = str(p.Name)
            if "Prolific" in p_name or "USB Serial" in p_name or "CH340" in p_name or "FTDI" in p_name:
                import re
                m = re.search(r'\(COM(\d+)\)', p_name)
                if m:
                    return f"COM{m.group(1)}"
    except Exception:
        pass
    
    return "COM3"


class HardwareLCDService:
    """Manages physical VFD/LCD 2x20 pole displays connected via USB-Serial COM port."""

    def __init__(self, port: str = "COM3", baudrate: int = 9600):
        self.port = port
        self.baudrate = baudrate

    def send_display_update(self, payload: Dict[str, Any], store_name: str = "Himmel POS"):
        msg_type = payload.get("type", "CART_CLEAR")
        cart = payload.get("cart", [])
        total_amount = payload.get("totalAmount", 0.0)

        if msg_type == "CART_UPDATE" and cart:
            # Show ONLY last added item; total is hidden until payment is triggered
            last_item = cart[-1]
            qty = last_item.get("quantity") or last_item.get("qty") or 1
            price = last_item.get("price", 0.0)
            item_tot = price * qty
            name = last_item.get("name", "")[:14]
            l1 = f"{name} {qty}x"
            l2 = f"Cena: {item_tot:.0f} Kc"
        elif msg_type == "PAYMENT_PENDING":
            # Total is ONLY displayed when moved to payment modal
            l1 = "    K uhrade:    "
            l2 = f"Celkem: {total_amount:.0f} Kc"
        elif msg_type == "PAYMENT_SUCCESS":
            l1 = "   Zaplaceno!   "
            l2 = " Dekujeme za nakup "
        else: # CART_CLEAR / Idle
            l1 = f"    {store_name[:12]}    "
            l2 = "  Vitejte u nas!  "

        self._write_vfd(l1, l2)

    def _write_vfd(self, line1: str, line2: str):
        target_port = self.port or detect_vfd_com_port() or "COM3"
        try:
            ser = serial.Serial(target_port, self.baudrate, timeout=0.5)
            ser.write(b'\x0c')      # FormFeed (Clear VFD)
            ser.write(b'\x1b\x40')  # ESC @ (Initialize VFD)

            clean_l1 = line1.translate(trans_tbl)[:20].ljust(20)
            clean_l2 = line2.translate(trans_tbl)[:20].ljust(20)

            ser.write((clean_l1 + clean_l2).encode('cp852', errors='replace'))
            ser.close()
            logger.info(f"Updated hardware VFD customer display on {target_port}")
        except Exception as e:
            logger.debug(f"Hardware VFD display write skipped ({target_port}): {e}")
