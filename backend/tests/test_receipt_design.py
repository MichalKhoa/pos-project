"""Receipt design and font sizing (Batch H phase 5): hierarchy, spacing, merged detail line, ruler."""
import os
import re
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from escpos_helpers import print_sale, receipt_lines
from services.escpos_service import (
    LINE_DOTS_FONT_A,
    LINE_DOTS_FONT_B,
    print_ruler,
    ESCPOSPrinterService,
)
from escpos.printer import Dummy


def _esc_count(data: bytes, cmd: bytes) -> int:
    return len(re.findall(re.escape(cmd), data))


def _mode_byte_before(out: bytes, needle: bytes) -> int:
    """The argument byte of the last ESC ! before `needle` in the raw output."""
    idx = out.find(needle)
    modes = re.findall(rb"\x1b!(.)", out[:idx])
    return modes[-1][0]


class HierarchyTests(unittest.TestCase):
    """D1/D14: store name and total print double height (and double width when it fits)."""

    def test_store_name_sets_double_height_then_resets(self):
        _, printer = print_sale({}, {"storeName": "Test"})
        out = printer.output
        mode = _mode_byte_before(out, b"Test")
        self.assertTrue(mode & 0x10, "expected the double-height bit set before the store name")
        # reset to normal height happens before the next header line
        name_idx = out.find(b"Test")
        after_modes = re.findall(rb"\x1b!(.)", out[name_idx:])
        self.assertTrue(after_modes, "expected a mode reset after the store name")
        self.assertFalse(after_modes[0][0] & 0x10, "double height not reset after the store name")

    def test_total_line_is_double_height(self):
        _, printer = print_sale({"totalAmount": 42.0}, {})
        mode = _mode_byte_before(printer.output, "CELKEM".encode("cp852"))
        self.assertTrue(mode & 0x10, "expected the double-height bit set before the total")

    def test_total_is_double_width_when_it_fits_half_the_line(self):
        # 48-column receipt: "CELKEM K ÚHRADĚ:" + value fits line_width // 2 = 24
        _, printer = print_sale({"totalAmount": 42.0}, {"receiptFontSize": "standard"})
        out = printer.output
        total_idx = out.find("CELKEM".encode("cp852"))
        preceding = out[:total_idx]
        last_mode = re.findall(rb"\x1b!(.)", preceding)[-1]
        self.assertTrue(last_mode[0] & 0x20, "expected the double-width bit set")


class LineSpacingTests(unittest.TestCase):
    """D11: ESC 3 n per font at job start, ESC 2 restored at job end."""

    def test_job_sets_line_pitch_for_the_font_then_restores_default(self):
        _, printer = print_sale({}, {"receiptFontSize": "standard"})
        out = printer.output
        self.assertIn(b"\x1b3" + bytes([LINE_DOTS_FONT_A]), out)
        self.assertTrue(out.endswith(b"\x1b@"))
        self.assertIn(b"\x1b2", out)

    def test_compact_font_uses_font_b_dots(self):
        _, printer = print_sale({}, {"receiptFontSize": "compact"})
        self.assertIn(b"\x1b3" + bytes([LINE_DOTS_FONT_B]), printer.output)


class NoDuplicateRuleTests(unittest.TestCase):
    """D2: the header separator and the title's own rule never both print."""

    def test_banner_title_has_no_doubled_dashed_line(self):
        _, printer = print_sale({}, {"receiptTitleStyle": "banner", "receiptShowBarcode": False})
        lines = receipt_lines(printer)
        dash_lines = [i for i, l in enumerate(lines) if l and set(l) == {"-"}]
        consecutive = any(b - a == 1 for a, b in zip(dash_lines, dash_lines[1:]))
        self.assertFalse(consecutive, f"two dashed lines in a row: {dash_lines}")


class MergedDetailLineTests(unittest.TestCase):
    """D3: qty x price and DPH share one right-aligned detail line."""

    def test_qty_times_price_still_shows_in_compact_density(self):
        # Review fix: the qty x price line used to be unconditional (weighted items); folding it
        # under "item_density == standard" was a regression.
        _, printer = print_sale({"items": [{"name": "Cola", "price": 28.8, "quantity": 2, "vat": 21}]},
                                 {"receiptItemDensity": "compact"})
        text = "\n".join(receipt_lines(printer))
        self.assertIn("2 × 28.80 Kč", text)
        self.assertNotIn("DPH", text)  # VAT still follows item_density == standard

    def test_long_weighted_name_and_vat_never_overflow_the_line(self):
        # Review fix: the old pad computation let detail_left + detail_right exceed line_width.
        _, printer = print_sale({"items": [{"name": "Salam", "price": 999.99, "quantity": 12.345,
                                             "unit": "kg", "vat": 21, "discountPercent": 50}]},
                                 {"printerPaperWidth": "58", "receiptLineColumns": 32})
        lines = receipt_lines(printer)
        too_long = [l for l in lines if len(l) > 32]
        self.assertFalse(too_long, f"lines over 32 chars: {too_long}")
        text = "\n".join(lines)
        self.assertIn("DPH 21%", text)

    def test_quantity_two_prints_qty_times_price_and_vat_on_one_line(self):
        _, printer = print_sale({"items": [{"name": "Cola", "price": 28.8, "quantity": 2, "vat": 21}]})
        text = "\n".join(receipt_lines(printer))
        self.assertIn("2 × 28.80 Kč", text)
        self.assertRegex(text, r"2 × 28\.80 Kč\s+DPH 21%")

    def test_quantity_one_has_no_qty_times_price_line(self):
        _, printer = print_sale({"items": [{"name": "Rohlik", "price": 3.5, "quantity": 1, "vat": 12}],
                                  "taxSummary": {}})
        text = "\n".join(receipt_lines(printer))
        self.assertNotIn("×", text)

    def test_discount_and_vat_share_the_detail_line(self):
        _, printer = print_sale({"items": [{"name": "Cola", "price": 28.8, "quantity": 2,
                                             "vat": 21, "discountPercent": 10}]})
        text = "\n".join(receipt_lines(printer))
        self.assertIn("(-10%)", text)
        line = next(l for l in text.splitlines() if "(-10%)" in l)
        self.assertIn("DPH 21%", line)


class SeparatorSpacingTests(unittest.TestCase):
    """D4: ESC J n feeds extra dots around separators per the spacing setting."""

    def test_compact_sends_no_extra_feed(self):
        _, printer = print_sale({}, {"receiptSeparatorSpacing": "compact"})
        self.assertNotIn(b"\x1bJ" + bytes([6]), printer.output)
        self.assertNotIn(b"\x1bJ" + bytes([16]), printer.output)

    def test_spacious_sends_sixteen_dots(self):
        _, printer = print_sale({}, {"receiptSeparatorSpacing": "spacious"})
        self.assertIn(b"\x1bJ" + bytes([16]), printer.output)

    def test_standard_sends_six_dots(self):
        _, printer = print_sale({}, {"receiptSeparatorSpacing": "standard"})
        self.assertIn(b"\x1bJ" + bytes([6]), printer.output)


class MoneyFormatTests(unittest.TestCase):
    """D5: amounts in tables always show two decimals."""

    def test_whole_item_price_still_prints_two_decimals(self):
        _, printer = print_sale({"items": [{"name": "Rohlik", "price": 12, "quantity": 1, "vat": 12}],
                                  "totalAmount": 12.0, "taxSummary": {}})
        lines = receipt_lines(printer)
        item_line = next(l for l in lines if l.startswith("Rohlik"))
        self.assertIn("12.00 Kč", item_line)


class RefundReverseTitleTests(unittest.TestCase):
    """D8: a refund's title prints reversed (GS B 1 ... GS B 0)."""

    def test_storno_title_is_wrapped_in_reverse_print(self):
        _, printer = print_sale({"totalAmount": -50, "isRefund": True})
        out = printer.output
        on_idx = out.find(b"\x1dB\x01")
        off_idx = out.find(b"\x1dB\x00", on_idx if on_idx != -1 else 0)
        title_idx = out.find("STORNO".encode("cp852"))
        self.assertNotEqual(on_idx, -1)
        self.assertNotEqual(off_idx, -1)
        self.assertTrue(on_idx < title_idx < off_idx, "title not wrapped in reverse-print bytes")


class JobResetOnErrorTests(unittest.TestCase):
    """Review fix: end_job (ESC @) must run even when the print raises mid-job."""

    def test_exception_mid_job_still_resets_the_printer(self):
        from unittest.mock import patch

        with patch("services.escpos_service.wrap_text", side_effect=RuntimeError("boom")):
            res, printer = print_sale()
        self.assertFalse(res["success"])
        self.assertTrue(printer.output.endswith(b"\x1b@"))


class RulerTests(unittest.TestCase):
    """D15: the ruler marks the configured width in both fonts."""

    def test_ruler_sets_each_fonts_own_line_pitch(self):
        printer = Dummy()
        print_ruler(printer, 42)
        self.assertIn(b"\x1b3" + bytes([LINE_DOTS_FONT_A]), printer.output)
        self.assertIn(b"\x1b3" + bytes([LINE_DOTS_FONT_B]), printer.output)

    def test_ruler_marks_the_configured_width(self):
        printer = Dummy()
        print_ruler(printer, 42)
        lines = [l for l in receipt_lines(printer) if l]
        marked = [l for l in lines if "|" in l]
        self.assertEqual(len(marked), 2)  # Font A and Font B passes
        for line in marked:
            self.assertEqual(line.index("|"), 42)

    def test_print_ruler_endpoint_simulates_without_hardware(self):
        service = ESCPOSPrinterService("DUMMY")
        res = service.print_ruler({"printerPaperWidth": "80"})
        self.assertTrue(res["success"])


if __name__ == "__main__":
    unittest.main()
