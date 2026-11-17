"""Test helpers for ESC/POS receipt output (Batch H).

Uses python-escpos `Dummy`, which records every byte and runs the real encoder,
so `ESC t`, `?` for unencodable letters and barcode validation behave like a printer.
"""
import os
import re
import sys
from unittest.mock import patch

from escpos.printer import Dummy

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.escpos_service import ESCPOSPrinterService

DEFAULT_SALE = {
    "receiptNumber": "2026-000001",
    "timestamp": "2026-11-16T10:00:00",
    "taxSummary": {},
    "paymentMethod": "card",
    "totalAmount": 3.5,
    "items": [{"name": "Rohlik", "price": 3.5, "quantity": 1, "vat": 12}],
}

# Control sequences the receipt writes: (ESC|GS) command plus its fixed-size arguments.
_CONTROL = re.compile(
    rb"\x1b[!MEatJ3dpV-]."  # one argument byte
    rb"|\x1b[2@=]"          # no argument
    rb"|\x1bp..."           # drawer pulse: m t1 t2
    rb"|\x1d[VhwfHBLW]\x41?.?"  # GS V / h / w / f / H / B: one or two argument bytes
    rb"|\x1d\(k.{3}[\x00-\xff]*?(?=\x1d\(k|\Z)",  # native QR blocks
    re.DOTALL,
)


def print_sale(sale=None, store_config=None, **kwargs):
    """Print a receipt through a patched `_get_printer_device`; return (result, Dummy)."""
    service = ESCPOSPrinterService("DUMMY")
    printer = Dummy()
    with patch.object(service, "_get_printer_device", return_value=printer):
        res = service.print_receipt({**DEFAULT_SALE, **(sale or {})}, {"storeName": "Test", **(store_config or {})}, **kwargs)
    return res, printer


def _strip_barcode(data: bytes) -> bytes:
    """Remove `GS k m n d1..dn` barcode blocks (variable length, so not a fixed regex)."""
    out = bytearray()
    i = 0
    while i < len(data):
        if data[i:i + 2] == b"\x1dk" and i + 3 < len(data):
            n = data[i + 3]
            i += 4 + n
            continue
        out.append(data[i])
        i += 1
    return bytes(out)


def receipt_lines(printer, encoding="cp852"):
    """Decode the recorded bytes to text lines, with control sequences removed."""
    raw = _CONTROL.sub(b"", _strip_barcode(printer.output))
    return raw.decode(encoding, errors="replace").split("\n")


def assert_fits(test, lines, width):
    """Fail the test case when any line is longer than `width` characters."""
    too_long = [(len(line), line) for line in lines if len(line) > width]
    test.assertFalse(too_long, f"lines longer than {width}: {too_long}")
