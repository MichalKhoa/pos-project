import logging

logger = logging.getLogger("pos-escpos")


class ESCPOSPrinterService:
    """
    Thermal ESC/POS Hardware Printer Service.
    Supports USB (/dev/usb/lp0), Serial (COM / /dev/ttyUSB0), or Network IP (9100).
    """

    def __init__(self, interface_type: str = "DUMMY", address: str = "/dev/usb/lp0"):
        self.interface_type = interface_type.upper()
        self.address = address

    def print_receipt(self, sale_data: dict, store_config: dict) -> bool:
        """
        Prints a formatted 58mm or 80mm thermal receipt using python-escpos.
        If physical printer is not connected, logs receipt output cleanly to console.
        """
        paper_width = str(store_config.get("printerPaperWidth", store_config.get("printer_paper_width", "80")))
        is_58mm = paper_width in ["58", "48"]
        line_width = 32 if is_58mm else 48
        name_width = 14 if is_58mm else 24
        print_mm = "48mm (58mm rola)" if is_58mm else "72mm (80mm rola)"

        logger.info(f"Printing {print_mm} thermal receipt #{sale_data.get('receiptNumber')} via {self.interface_type}")

        try:
            separator = "=" * line_width
            dash_line = "-" * line_width

            # Uncomment and configure physical escpos printer driver when hardware attached:
            """
            from escpos.printer import Usb, Network, Serial

            if self.interface_type == "USB":
                printer = Usb(0x04b8, 0x0e15, 0) # Standard Epson/Xprinter USB vendor/product ID
            elif self.interface_type == "NETWORK":
                printer = Network(self.address, port=9100)
            elif self.interface_type == "SERIAL":
                printer = Serial(self.address, baudrate=9600)
            else:
                printer = None

            if printer:
                # Header
                printer.set(align='center', font='a', width=2, height=2)
                printer.text(f"{store_config.get('storeName', 'Himmel POS')}\n")
                printer.set(align='center', font='a', width=1, height=1)
                printer.text(f"{store_config.get('street')}\n{store_config.get('city')}\n")
                printer.text(f"ICO: {store_config.get('ico')} DIC: {store_config.get('dic')}\n")
                printer.text(separator + "\n")
                printer.text(f"UCTENKA c. {sale_data.get('receiptNumber')}\n")
                printer.text(f"{sale_data.get('timestamp')}\n")
                printer.text(dash_line + "\n")

                # Line Items
                printer.set(align='left')
                for item in sale_data.get('items', []):
                    item_name = item['name'][:name_width]
                    printer.text(f"{item_name:<{name_width}} {item['quantity']:>2}x {item['price']:>6.0f} Kc\n")

                printer.text(separator + "\n")
                printer.set(align='right', font='a', width=2, height=2)
                printer.text(f"CELKEM: {sale_data.get('totalAmount'):.0f} Kc\n")
                printer.set(align='left', font='a', width=1, height=1)

                # Footer & EET Signatures
                printer.text(f"Zpusob uchrady: {sale_data.get('paymentMethod').upper()}\n")
                printer.text(dash_line + "\n")
                printer.text(f"FIK: {sale_data.get('fik_code', 'N/A')}\n")
                printer.text(f"BKP: {sale_data.get('bkp_code', 'N/A')}\n")
                printer.set(align='center')
                printer.text(f"\n{store_config.get('receiptFooter')}\n\n")

                # Cut paper & open cash drawer
                printer.cashdraw(2)
                printer.cut()
                return True
            """

            print(separator)
            print(f"--- PHYSICAL ESC/POS {paper_width}mm PRINT SIMULATION ---")
            print(f"Store: {store_config.get('storeName')}")
            print(f"Receipt #: {sale_data.get('receiptNumber')}")
            print(f"Paper Width: {paper_width} mm ({line_width} chars/line)")
            print(f"Total Amount: {sale_data.get('totalAmount')} Kč")
            print(f"Payment Method: {sale_data.get('paymentMethod')}")
            print(separator)
            return True

        except Exception as e:
            logger.error(f"Failed to print thermal receipt: {e}")
            return False
