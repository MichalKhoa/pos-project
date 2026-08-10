import os
import glob
import subprocess
import logging

import time

logger = logging.getLogger("pos-escpos")


def with_printer_reconnect(max_retries: int = 3, delay_seconds: float = 1.0):
    """Decorator that automatically retries printer connection with exponential backoff on USB/Serial hardware hiccups."""
    def decorator(func):
        def wrapper(*args, **kwargs):
            last_err = None
            current_delay = delay_seconds
            for attempt in range(1, max_retries + 1):
                try:
                    return func(*args, **kwargs)
                except (PermissionError, FileNotFoundError, OSError, Exception) as e:
                    last_err = e
                    logger.warning(f"Printer connection attempt {attempt}/{max_retries} failed: {e}. Retrying in {current_delay}s...")
                    time.sleep(current_delay)
                    current_delay *= 2.0
            logger.error(f"Printer auto-reconnect failed after {max_retries} attempts: {last_err}")
            raise last_err
        return wrapper
    return decorator


def detect_connected_printers():
    """
    Scans host system for connected thermal printer hardware devices:
    - Windows Spooler Printers (win32print)
    - USB Direct Nodes (/dev/usb/lp*, /dev/usblp*)
    - Serial/TTY Nodes (/dev/ttyUSB*, /dev/ttyACM*)
    - CUPS System Printers
    - Network / Browser Print
    """
    devices = []

    # 0. Check Windows installed printers via win32print when running on Windows
    if os.name == 'nt':
        try:
            import win32print
            printers = win32print.EnumPrinters(win32print.PRINTER_ENUM_LOCAL | win32print.PRINTER_ENUM_CONNECTIONS)
            for idx, p in enumerate(printers):
                pname = p[2]
                port = p[1]
                is_pos = any(kw in pname.upper() for kw in ["EPSON", "RECEIPT", "POS", "THERMAL", "TICKETING", "TM-T", "TSP", "STAR"])
                devices.append({
                    "id": pname,
                    "name": f"Windows Tiskárna ({pname} • {port})",
                    "interface": "WIN32",
                    "address": pname,
                    "status": "CONNECTED",
                    "is_default": is_pos or (idx == 0)
                })
        except Exception as win_err:
            logger.warning(f"Failed to scan Windows printers via win32print: {win_err}")

    # 1. Check USB Thermal Printer character devices (/dev/usb/lp0, lp1, etc.)
    usb_paths = sorted(glob.glob("/dev/usb/lp*") + glob.glob("/dev/usblp*"))
    for idx, path in enumerate(usb_paths):
        devices.append({
            "id": path,
            "name": f"USB Tiskárna účtenek ({path})",
            "interface": "USB",
            "address": path,
            "status": "CONNECTED",
            "is_default": (not devices) and (idx == 0)
        })


    # 2. Check Serial/TTY POS Printer ports (/dev/ttyUSB*, /dev/ttyACM*)
    tty_paths = sorted(glob.glob("/dev/ttyUSB*") + glob.glob("/dev/ttyACM*"))
    for path in tty_paths:
        devices.append({
            "id": path,
            "name": f"Sériová TTY Tiskárna ({path})",
            "interface": "SERIAL",
            "address": path,
            "status": "CONNECTED",
            "is_default": False
        })

    # 3. Check CUPS System Printers via lpstat if available
    try:
        res = subprocess.run(["lpstat", "-p"], capture_output=True, text=True, timeout=2)
        if res.returncode == 0:
            for line in res.stdout.splitlines():
                if "printer" in line:
                    parts = line.split()
                    if len(parts) >= 2:
                        pname = parts[1]
                        devices.append({
                            "id": f"cups-{pname}",
                            "name": f"Systémová tiskárna CUPS ({pname})",
                            "interface": "CUPS",
                            "address": pname,
                            "status": "CONNECTED",
                            "is_default": False
                        })
    except Exception:
        pass

    # 4. Fallback Default USB device if no physical hardware detected
    if not devices:
        devices.append({
            "id": "/dev/usb/lp0",
            "name": "USB Tiskárna účtenek (/dev/usb/lp0)",
            "interface": "USB",
            "address": "/dev/usb/lp0",
            "status": "DEFAULT",
            "is_default": True
        })

    # 5. Network Printer & Web Browser Print Option
    devices.append({
        "id": "network-custom",
        "name": "Síťová tiskárna (Ethernet / Wi-Fi IP)",
        "interface": "NETWORK",
        "address": "192.168.1.100",
        "status": "CUSTOM",
        "is_default": False
    })
    devices.append({
        "id": "browser-print",
        "name": "Webový systémový tisk (Pop-up window)",
        "interface": "BROWSER",
        "address": "window.print()",
        "status": "VIRTUAL",
        "is_default": False
    })

    return devices


class ESCPOSPrinterService:
    """
    Thermal ESC/POS Hardware Printer Service.
    Supports USB (/dev/usb/lp0), Serial (COM / /dev/ttyUSB0), Win32 (Windows Spooler), or Network IP (9100).
    """

    def __init__(self, interface_type: str = "DUMMY", address: str = "/dev/usb/lp0"):
        self.interface_type = interface_type.upper()
        self.address = address

    def print_receipt(self, sale_data: dict, store_config: dict) -> dict:
        """
        Prints a formatted 58mm or 80mm thermal receipt using python-escpos.
        If physical printer is not connected, logs receipt output cleanly to console.
        Returns a dict: {"success": True, "physical": True/False, "status": "PRINTED"/"SIMULATED"}
        """
        paper_width = str(store_config.get("printerPaperWidth", store_config.get("printer_paper_width", "80"))).upper()
        is_a4 = paper_width == "A4"
        is_58mm = not is_a4 and paper_width in ["58", "48"]
        line_width = 80 if is_a4 else (32 if is_58mm else 48)
        name_width = 40 if is_a4 else (14 if is_58mm else 28)
        print_mm = "Formát A4 (Faktura / Daňový Doklad)" if is_a4 else ("48mm (58mm rola)" if is_58mm else "72mm (80mm rola)")

        logger.info(f"Printing {print_mm} receipt #{sale_data.get('receiptNumber')} via {self.interface_type}")

        try:
            separator = "=" * line_width
            dash_line = "-" * line_width

            # 1. Attempt physical ESC/POS Hardware Connection if interface is configured
            printer = None
            try:
                if os.name == 'nt' and (self.interface_type in ["WIN32", "USB"] or self.address.startswith('/dev/')):
                    from escpos.printer import Win32Raw
                    target_name = self.address
                    if not target_name or target_name.startswith('/dev/'):
                        target_name = ""
                        try:
                            import win32print
                            printers = [p[2] for p in win32print.EnumPrinters(win32print.PRINTER_ENUM_LOCAL | win32print.PRINTER_ENUM_CONNECTIONS)]
                            pos_printers = [p for p in printers if any(kw in p.upper() for kw in ["EPSON", "RECEIPT", "POS", "THERMAL"])]
                            if pos_printers:
                                target_name = pos_printers[0]
                            elif printers:
                                target_name = printers[0]
                        except Exception:
                            pass
                    printer = Win32Raw(target_name)
                elif self.interface_type == "USB":
                    from escpos.printer import Usb, File
                    if os.path.exists(self.address):
                        printer = File(self.address)
                    else:
                        # Standard Epson/Xprinter/POS-58 USB vendor ID fallback
                        printer = Usb(0x04b8, 0x0e15, 0)
                elif self.interface_type == "NETWORK" and self.address:
                    from escpos.printer import Network
                    printer = Network(self.address, port=9100)
                elif self.interface_type == "SERIAL" and self.address:
                    from escpos.printer import Serial
                    printer = Serial(self.address, baudrate=9600)
            except Exception as conn_err:
                logger.info(f"Physical ESC/POS printer hardware offline ({conn_err}), using print simulation fallback.")
                printer = None

            if printer:
                try:
                    if hasattr(printer, 'open'):
                        printer.open(f"Himmel_POS_Receipt_{sale_data.get('receiptNumber')}")
                except Exception as open_err:
                    logger.warning(f"Failed to open printer device ({open_err}), falling back to simulation.")
                    printer = None

            if printer:
                try:
                    # Set ESC/POS codepage to CP852 / CP1250 if supported
                    try:
                        if hasattr(printer, 'charcode'):
                            printer.charcode('CP852')
                    except Exception:
                        pass

                    is_refund = sale_data.get("isRefund") or sale_data.get("is_refund")
                    receipt_num = str(sale_data.get("receiptNumber", ""))
                    orig_num = str(sale_data.get("originalReceiptNumber") or sale_data.get("original_receipt_number") or "")
                    refund_reason = str(sale_data.get("refundReason") or sale_data.get("refund_reason") or "")

                    # Store Header
                    printer.set(align='center', font='a', width=2, height=2)
                    printer.text(f"{store_config.get('storeName', 'Himmel POS')}\n")
                    printer.set(align='center', font='a', width=1, height=1)
                    if store_config.get('street'):
                        printer.text(f"{store_config.get('street')}\n")
                    if store_config.get('city'):
                        printer.text(f"{store_config.get('city')}\n")
                    if store_config.get('ico') or store_config.get('dic'):
                        printer.text(f"ICO: {store_config.get('ico', '')}  DIC: {store_config.get('dic', '')}\n")
                    printer.text(separator + "\n")

                    # Document Title & Timestamp
                    title = f"STORNO DOKLAD c. {receipt_num}" if is_refund else f"UCTENKA c. {receipt_num}"
                    printer.set(align='center', font='a', width=1, height=1)
                    printer.text(f"{title}\n")
                    if is_refund and orig_num:
                        printer.text(f"Puvodni doklad: #{orig_num}\n")
                    if is_refund and refund_reason:
                        printer.text(f"Duvod: {refund_reason}\n")
                    ts_val = str(sale_data.get("timestamp", ""))
                    if ts_val:
                        try:
                            from datetime import datetime
                            dt = datetime.fromisoformat(ts_val.replace("Z", "+00:00"))
                            formatted_ts = dt.strftime("%d.%m.%Y %H:%M:%S")
                        except Exception:
                            formatted_ts = ts_val[:19].replace('T', ' ')
                        printer.text(f"{formatted_ts}\n")
                    printer.text(dash_line + "\n")

                    # Items Header
                    printer.set(align='left', font='a', width=1, height=1)
                    if is_58mm:
                        printer.text(f"{'Polozka':<14} {'Ks':^4} {'Cena':>12}\n")
                    else:
                        printer.text(f"{'Polozka':<28} {'Ks':^5} {'Cena':>13}\n")
                    printer.text(dash_line + "\n")

                    # Line Items
                    name_w = 14 if is_58mm else 28
                    for item in sale_data.get('items', []):
                        qty = item.get('quantity', 1)
                        disc = item.get('discountPercent') or item.get('discount_percent') or 0
                        price = item.get('price', 0) * (1 - disc / 100)
                        tot = price * qty
                        tot_str = f"{tot:.0f} Kc"
                        name_raw = item.get('name', '')
                        
                        if len(name_raw) > name_w:
                            printer.text(f"{name_raw[:line_width]}\n")
                            if is_58mm:
                                printer.text(f"{'':<14} {qty:^4} {tot_str:>12}\n")
                            else:
                                printer.text(f"{'':<28} {qty:^5} {tot_str:>13}\n")
                        else:
                            if is_58mm:
                                printer.text(f"{name_raw:<14} {qty:^4} {tot_str:>12}\n")
                            else:
                                printer.text(f"{name_raw:<28} {qty:^5} {tot_str:>13}\n")
                        
                        if disc > 0:
                            printer.text(f"  (-{disc}% sleva)\n")
                        vat_rate = item.get('vat', 21)
                        printer.text(f"  DPH {vat_rate}%\n")

                    printer.text(separator + "\n")

                    # Total Banner
                    tot_val_str = f"{sale_data.get('totalAmount', 0):.0f} Kc"
                    tot_label = "STORNO:" if is_refund else "CELKEM K UHRADE:"
                    if is_58mm:
                        printer.text(f"{tot_label:<16} {tot_val_str:>15}\n")
                    else:
                        printer.text(f"{tot_label:<24} {tot_val_str:>23}\n")
                    printer.text(dash_line + "\n")

                    # Payment Method & Cash Details
                    pm = str(sale_data.get('paymentMethod', '')).upper()
                    pm_label = "HOTOVOST" if pm in ["CASH", "HOTOVOST"] else ("KARTA" if pm in ["CARD", "KARTA"] else ("KOMBINOVANA" if pm in ["SPLIT"] else "QR PLATBA"))
                    if is_58mm:
                        printer.text(f"{'Zpusob uhrady:':<16} {pm_label:>15}\n")
                    else:
                        printer.text(f"{'Zpusob uhrady:':<24} {pm_label:>23}\n")

                    if pm in ["CASH", "HOTOVOST"]:
                        tend = sale_data.get("tenderedAmount") or sale_data.get("tendered_amount") or 0
                        chg = sale_data.get("changeDue") or sale_data.get("change_due") or 0
                        tend_str = f"{tend:.0f} Kc"
                        chg_str = f"{chg:.0f} Kc"
                        if is_58mm:
                            printer.text(f"{'  Prijato:':<16} {tend_str:>15}\n")
                            printer.text(f"{'  Vraceno:':<16} {chg_str:>15}\n")
                        else:
                            printer.text(f"{'  Prijata hotovost:':<24} {tend_str:>23}\n")
                            printer.text(f"{'  Vraceno:':<24} {chg_str:>23}\n")
                    elif pm == "SPLIT" and sale_data.get("splitDetails"):
                        split = sale_data.get("splitDetails")
                        cash_part = f"{(split.get('cash') or 0):.0f} Kc"
                        card_part = f"{(split.get('card') or 0):.0f} Kc"
                        if is_58mm:
                            printer.text(f"{'  - Hotove:':<16} {cash_part:>15}\n")
                            printer.text(f"{'  - Kartou:':<16} {card_part:>15}\n")
                        else:
                            printer.text(f"{'  - Hotove:':<24} {cash_part:>23}\n")
                            printer.text(f"{'  - Kartou:':<24} {card_part:>23}\n")

                    printer.text(dash_line + "\n")

                    # Tax Summary Breakdown (Rozpis DPH)
                    tax_summary = sale_data.get("taxSummary") or sale_data.get("tax_summary")
                    if tax_summary and isinstance(tax_summary, dict):
                        printer.text("Rozpis DPH:\n")
                        if is_58mm:
                            printer.text(f"{'Sazba':<6} {'Zaklad':>12} {'Dan':>12}\n")
                            for t in tax_summary.values():
                                r_str = f"{t.get('rate')}%"
                                net_str = f"{t.get('net', 0):.2f}"
                                tax_str = f"{t.get('tax', 0):.2f}"
                                printer.text(f"{r_str:<6} {net_str:>12} {tax_str:>12}\n")
                        else:
                            printer.text(f"{'Sazba':<8} {'Zaklad (Netto)':>13} {'Dan (DPH)':>11} {'Brutto':>13}\n")
                            for t in tax_summary.values():
                                r_str = f"{t.get('rate')}%"
                                net_str = f"{t.get('net', 0):.2f}"
                                tax_str = f"{t.get('tax', 0):.2f}"
                                gross_str = f"{t.get('gross', 0):.2f}"
                                printer.text(f"{r_str:<8} {net_str:>13} {tax_str:>11} {gross_str:>13}\n")
                        printer.text(dash_line + "\n")

                    # Fiscal / EET block
                    fik = sale_data.get("fik") or sale_data.get("fik_code")
                    bkp = sale_data.get("bkp") or sale_data.get("bkp_code")
                    if fik:
                        printer.text(f"EET FIK: {fik}\n")
                    if bkp:
                        printer.text(f"EET BKP: {bkp}\n")
                    if not fik and not bkp:
                        printer.set(align='center')
                        printer.text("Rezim provozu: Bez EET\n")

                    printer.text(dash_line + "\n")

                    # Footer
                    footer = store_config.get('receiptFooter') or "Dekujeme za vas nakup!"
                    printer.set(align='center')
                    printer.text(f"{footer}\n")

                    # Bottom margin before cutter
                    printer.text("\n\n")

                    # Cut paper & kick cash drawer pulse on cash payment
                    try:
                        if pm in ["CASH", "HOTOVOST", "SPLIT"]:
                            printer.cashdraw(2)
                        printer.cut()
                    except Exception:
                        pass

                    return {"success": True, "physical": True, "status": "PRINTED"}
                except Exception as print_exec_err:
                    logger.error(f"Error during ESC/POS print execution: {print_exec_err}")
                    return {"success": False, "physical": False, "status": "ERROR", "error": str(print_exec_err)}
                finally:
                    try:
                        if hasattr(printer, 'close'):
                            printer.close()
                    except Exception:
                        pass


            # Simulation fallback when physical printer is not connected
            print(separator)
            print(f"--- PHYSICAL ESC/POS {paper_width}mm PRINT SIMULATION ---")
            print(f"Store: {store_config.get('storeName')}")
            print(f"Receipt #: {sale_data.get('receiptNumber')}")
            print(f"Paper Width: {paper_width} mm ({line_width} chars/line)")
            print(f"Total Amount: {sale_data.get('totalAmount')} Kč")
            print(f"Payment Method: {sale_data.get('paymentMethod')}")
            print(separator)
            return {"success": True, "physical": False, "status": "SIMULATED"}

        except Exception as e:
            logger.error(f"Failed to print thermal receipt: {e}")
            return {"success": False, "physical": False, "status": "ERROR", "error": str(e)}

    def open_cash_drawer(self) -> dict:
        """
        Sends pulse signal to thermal printer cash drawer RJ11/RJ12 port to kick the drawer open.
        """
        logger.info(f"Opening cash drawer via printer interface {self.interface_type}")
        try:
            printer = None
            if os.name == 'nt' and (self.interface_type in ["WIN32", "USB"] or self.address.startswith('/dev/')):
                from escpos.printer import Win32Raw
                target_name = self.address
                if not target_name or target_name.startswith('/dev/'):
                    target_name = ""
                    try:
                        import win32print
                        printers = [p[2] for p in win32print.EnumPrinters(win32print.PRINTER_ENUM_LOCAL | win32print.PRINTER_ENUM_CONNECTIONS)]
                        pos_printers = [p for p in printers if any(kw in p.upper() for kw in ["EPSON", "RECEIPT", "POS", "THERMAL"])]
                        if pos_printers:
                            target_name = pos_printers[0]
                        elif printers:
                            target_name = printers[0]
                    except Exception:
                        pass
                printer = Win32Raw(target_name)
            elif self.interface_type == "USB":
                from escpos.printer import Usb, File
                if os.path.exists(self.address):
                    printer = File(self.address)
                else:
                    printer = Usb(0x04b8, 0x0e15, 0)
            elif self.interface_type == "NETWORK" and self.address:
                from escpos.printer import Network
                printer = Network(self.address, port=9100)
            elif self.interface_type == "SERIAL" and self.address:
                from escpos.printer import Serial
                printer = Serial(self.address, baudrate=9600)

            if printer:
                try:
                    if hasattr(printer, 'open'):
                        printer.open("Himmel_POS_Drawer_Kick")
                    # Try kicking pin 2 and pin 5 to cover all cash drawer wiring types
                    try:
                        printer.cashdraw(2)
                    except Exception:
                        pass
                    try:
                        printer.cashdraw(5)
                    except Exception:
                        pass
                    return {"success": True, "physical": True, "status": "OPENED"}
                except Exception as kick_err:
                    logger.warning(f"Cash drawer kick warning: {kick_err}")
                finally:
                    try:
                        if hasattr(printer, 'close'):
                            printer.close()
                    except Exception:
                        pass

            print("--- CASH DRAWER OPEN SIGNAL SIMULATED ---")
            return {"success": True, "physical": False, "status": "SIMULATED"}
        except Exception as err:
            logger.error(f"Failed to open cash drawer: {err}")
            return {"success": False, "physical": False, "status": "ERROR", "error": str(err)}


