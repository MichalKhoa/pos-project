"""Smoke tests for the ESC/POS test helpers (Batch H phase 0)."""
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from escpos_helpers import assert_fits, print_sale, receipt_lines


class EscposHarnessTests(unittest.TestCase):
    def test_plain_sale_prints_through_dummy(self):
        res, printer = print_sale()
        self.assertTrue(res["success"])
        text = "\n".join(receipt_lines(printer))
        self.assertIn("Rohlik", text)
        self.assertIn("CELKEM K ÚHRADĚ", text)

    def test_codepage_is_selected_with_esc_t(self):
        _, printer = print_sale()
        self.assertIn(b"\x1bt\x12", printer.output)  # CP852 = slot 18

    def test_control_bytes_are_removed_from_lines(self):
        _, printer = print_sale()
        for line in receipt_lines(printer)[:3]:
            self.assertNotIn("\x1b", line)

    def test_assert_fits_reports_long_lines(self):
        with self.assertRaises(AssertionError):
            assert_fits(self, ["x" * 10], 5)
        assert_fits(self, ["x" * 5], 5)


if __name__ == "__main__":
    unittest.main()
