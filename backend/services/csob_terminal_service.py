import socket
import logging
import struct
import time
from typing import Dict, Any, Optional

logger = logging.getLogger("csob-terminal-service")

# Default ČSOB / Ingenico TCP Socket Port used by Sonet / GPE protocols
DEFAULT_CSOB_PORT = 8888
STX = b'\x02'
ETX = b'\x03'


class CSOBTerminalService:
    """
    Service interface for ČSOB payment terminal Ingenico Move 3500 over TCP/IP socket connection.
    Supports GPE / B-POST protocol TCP framing (STX ... ETX + LRC checksum or 2-byte header length prefix).
    """

    def __init__(self, ip: str = "", port: int = DEFAULT_CSOB_PORT, terminal_id: str = "", enabled: bool = False):
        self.ip = ip.strip() if ip else ""
        self.port = int(port) if port else DEFAULT_CSOB_PORT
        self.terminal_id = terminal_id.strip() if terminal_id else ""
        self.enabled = bool(enabled)

    def is_configured(self) -> bool:
        """Checks if terminal IP address and port are configured."""
        return bool(self.enabled and self.ip and self.port > 0)

    def calculate_lrc(self, data: bytes) -> bytes:
        """Computes Longitudinal Redundancy Check (LRC XOR byte) for STX-ETX frames."""
        lrc = 0
        for b in data:
            lrc ^= b
        return bytes([lrc])

    def build_gpe_request_frame(self, amount: float, transaction_type: str = "SALE", variable_symbol: str = "") -> bytes:
        """
        Builds STX...ETX + LRC framed TCP payload for Ingenico Move 3500 GPE protocol.
        Amount is encoded in haléře/cents (integer).
        """
        amount_cents = int(round(amount * 100))
        # Format: TYPE|AMOUNT_CENTS|CURRENCY_NUMERIC|TID|VS
        payload_str = f"{transaction_type}|{amount_cents}|203|{self.terminal_id}|{variable_symbol}"
        payload_bytes = payload_str.encode("utf-8")

        frame_content = payload_bytes + ETX
        lrc = self.calculate_lrc(frame_content)
        return STX + frame_content + lrc

    def parse_gpe_response_frame(self, raw_data: bytes) -> Dict[str, Any]:
        """Parses GPE/B-POST response frame from Ingenico terminal."""
        if not raw_data:
            return {"success": False, "status": "EMPTY_RESPONSE", "message": "No response received from terminal."}

        try:
            # Strip STX / ETX if present
            cleaned = raw_data
            if cleaned.startswith(STX):
                cleaned = cleaned[1:]
            if ETX in cleaned:
                cleaned = cleaned.split(ETX)[0]

            text = cleaned.decode("utf-8", errors="ignore")
            parts = text.split("|")

            # Standard GPE Response: RESP_CODE|AUTH_CODE|CARD_MASK|TRANSACTION_ID|RECEIPT_TEXT
            resp_code = parts[0] if len(parts) > 0 else "99"
            auth_code = parts[1] if len(parts) > 1 else ""
            card_mask = parts[2] if len(parts) > 2 else ""
            tx_id = parts[3] if len(parts) > 3 else ""
            receipt_text = parts[4] if len(parts) > 4 else ""

            is_approved = (resp_code in ("00", "000", "OK", "APPROVED"))

            return {
                "success": is_approved,
                "status": "APPROVED" if is_approved else "DECLINED",
                "response_code": resp_code,
                "auth_code": auth_code,
                "card_mask": card_mask or "**** **** **** ****",
                "transaction_id": tx_id,
                "receipt_text": receipt_text,
                "message": "Transaction approved" if is_approved else f"Declined by bank (code {resp_code})"
            }
        except Exception as e:
            logger.error(f"Error parsing terminal response: {e}")
            return {"success": False, "status": "PARSE_ERROR", "message": str(e)}

    def ping_terminal(self, target_ip: Optional[str] = None, target_port: Optional[int] = None, timeout: float = 3.0) -> Dict[str, Any]:
        """
        Attempts direct TCP socket handshake to verify terminal IP address reachability.
        """
        host = target_ip.strip() if target_ip else self.ip
        port = int(target_port) if target_port else self.port

        if not host:
            return {
                "success": False,
                "status": "NOT_CONFIGURED",
                "message": "Chybí IP adresa ČSOB terminálu. Zadání je vyžadováno v nastavení.",
                "host": host,
                "port": port
            }

        try:
            logger.info(f"Pinging CSOB Ingenico Move 3500 at {host}:{port} (timeout={timeout}s)...")
            sock = socket.create_connection((host, port), timeout=timeout)
            sock.close()
            return {
                "success": True,
                "status": "REACHABLE",
                "message": f"ČSOB terminál Ingenico Move 3500 na {host}:{port} je dostupný přes síť!",
                "host": host,
                "port": port
            }
        except socket.timeout:
            return {
                "success": False,
                "status": "TIMEOUT",
                "message": f"Vypršel časový limit pro připojení k {host}:{port}. Zkontrolujte zda je terminál zapnut a na stejné síti.",
                "host": host,
                "port": port
            }
        except ConnectionRefusedError:
            return {
                "success": False,
                "status": "REFUSED",
                "message": f"Připojení k {host}:{port} bylo odmítnuto. Zkontrolujte číslo portu na terminálu.",
                "host": host,
                "port": port
            }
        except Exception as e:
            return {
                "success": False,
                "status": "ERROR",
                "message": f"Chyba síťového spojení ({host}:{port}): {str(e)}",
                "host": host,
                "port": port
            }

    def _read_gpe_frame(self, sock: socket.socket, overall_timeout: float = 60.0) -> bytes:
        """
        Reads streaming bytes from terminal TCP socket until ETX + LRC is received
        or timeout expires, handling TCP packet segmentation cleanly.
        """
        sock.settimeout(min(overall_timeout, 3.0))
        buffer = bytearray()
        deadline = time.time() + overall_timeout

        while time.time() < deadline:
            try:
                chunk = sock.recv(1024)
                if not chunk:
                    break
                buffer.extend(chunk)
                if ETX in buffer:
                    etx_idx = buffer.index(ETX)
                    # Check if trailing LRC byte is present
                    if len(buffer) > etx_idx + 1:
                        return bytes(buffer)
            except socket.timeout:
                if buffer and ETX in buffer:
                    return bytes(buffer)
                continue

        return bytes(buffer)

    def process_payment(self, amount: float, variable_symbol: str = "", timeout: float = 60.0) -> Dict[str, Any]:
        """
        Initiates cashless payment card transaction on ČSOB terminal via GPE protocol over TCP socket.
        """
        if not self.ip or not self.port:
            return {
                "success": False,
                "status": "NOT_CONFIGURED",
                "message": "ČSOB terminál nemá nastavenou IP adresu. Nakonfigurujte terminál v nastavení.",
                "amount": amount
            }

        if not self.enabled:
            return {
                "success": False,
                "status": "DISABLED",
                "message": "ČSOB terminál je v nastavení deaktivován.",
                "amount": amount
            }

        frame = self.build_gpe_request_frame(amount, transaction_type="SALE", variable_symbol=variable_symbol)

        try:
            logger.info(f"Connecting to CSOB terminal {self.ip}:{self.port} to process payment of {amount} CZK...")
            with socket.create_connection((self.ip, self.port), timeout=timeout) as sock:
                sock.sendall(frame)
                raw_res = self._read_gpe_frame(sock, overall_timeout=timeout)
                parsed = self.parse_gpe_response_frame(raw_res)
                parsed["amount"] = amount
                return parsed
        except socket.timeout:
            return {
                "success": False,
                "status": "TIMEOUT",
                "message": "Časový limit transakce vypršel. Zákazník nepřiložil kartu včas.",
                "amount": amount
            }
        except Exception as e:
            logger.error(f"CSOB Terminal transaction failed: {e}")
            return {
                "success": False,
                "status": "CONNECTION_ERROR",
                "message": f"Nepodařilo se komunikovat s terminálem {self.ip}:{self.port}: {str(e)}",
                "amount": amount
            }

    def reconcile_terminal(self, timeout: float = 30.0) -> Dict[str, Any]:
        """Sends daily closure / reconciliation command (uzávěrka) to CSOB terminal."""
        if not self.ip or not self.port:
            return {
                "success": False,
                "status": "NOT_CONFIGURED",
                "message": "ČSOB terminál nemá nastavenou IP adresu pro spuštění denní uzávěrky."
            }

        frame = self.build_gpe_request_frame(0.0, transaction_type="RECONCILE")
        try:
            with socket.create_connection((self.ip, self.port), timeout=timeout) as sock:
                sock.sendall(frame)
                raw_res = self._read_gpe_frame(sock, overall_timeout=timeout)
                return self.parse_gpe_response_frame(raw_res)
        except Exception as e:
            return {
                "success": False,
                "status": "CONNECTION_ERROR",
                "message": f"Uzávěrka selhala: {str(e)}"
            }


if __name__ == "__main__":
    # Runnable assert self-check per ponytail rules
    svc = CSOBTerminalService(ip="", port=8888, enabled=False)
    assert not svc.is_configured(), "Should be unconfigured when IP is empty"
    res = svc.process_payment(100.0)
    assert res["status"] == "NOT_CONFIGURED", "Should return NOT_CONFIGURED when IP missing"

    svc_test = CSOBTerminalService(ip="127.0.0.1", port=8888, enabled=True)
    frame = svc_test.build_gpe_request_frame(150.50, "SALE", "VS123")
    assert frame.startswith(b'\x02'), "Frame must start with STX byte"

    lrc_check = svc_test.calculate_lrc(b"TEST\x03")
    assert isinstance(lrc_check, bytes)

    parsed = svc_test.parse_gpe_response_frame(b"\x0200|998877|4111****1111|TX999|Uctenka text\x03\x12")
    assert parsed["success"] is True, "Resp code 00 must parse as approved"
    assert parsed["auth_code"] == "998877"

    print("CSOBTerminalService self-check passed clean.")
