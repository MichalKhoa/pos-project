"""Test helpers for ESC/POS receipt output (Batch H).

Uses python-escpos `Dummy`, which records every byte and runs the real encoder,
so `ESC t`, `?` for unencodable letters and barcode validation behave like a printer.
"""
import os
import sys
from unittest.mock import patch

from escpos.printer import Dummy

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.escpos_service import ESCPOSPrinterService, _ESCPOS_CONTROL, decode_escpos_preview

DEFAULT_SALE = {
    "receiptNumber": "2026-000001",
    "timestamp": "2026-11-16T10:00:00",
    "taxSummary": {},
    "paymentMethod": "card",
    "totalAmount": 3.5,
    "items": [{"name": "Rohlik", "price": 3.5, "quantity": 1, "vat": 12}],
}

# Kept as _CONTROL for existing test imports; the regex itself lives in escpos_service.py
# so the production debug preview and these tests decode output identically.
_CONTROL = _ESCPOS_CONTROL


def print_sale(sale=None, store_config=None, **kwargs):
    """Print a receipt through a patched `_get_printer_device`; return (result, Dummy)."""
    service = ESCPOSPrinterService("DUMMY")
    printer = Dummy()
    with patch.object(service, "_get_printer_device", return_value=printer):
        res = service.print_receipt({**DEFAULT_SALE, **(sale or {})}, {"storeName": "Test", **(store_config or {})}, **kwargs)
    return res, printer


def receipt_lines(printer, encoding="cp852"):
    """Decode the recorded bytes to text lines, with control sequences removed."""
    return decode_escpos_preview(printer.output, encoding)


def assert_fits(test, lines, width):
    """Fail the test case when any line is longer than `width` characters."""
    too_long = [(len(line), line) for line in lines if len(line) > width]
    test.assertFalse(too_long, f"lines longer than {width}: {too_long}")
