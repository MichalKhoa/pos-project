import os
import glob
import logging
import threading
import time
from datetime import datetime

logger = logging.getLogger("pos-escpos")

# Re-entrant thread lock to prevent concurrent print jobs or drawer kicks from clashing on raw device streams
_hardware_printer_lock = threading.RLock()


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


from services.printer_discovery import detect_connected_printers


def get_receipt_separator(style: str, width: int) -> str:
    """Builds a horizontal receipt separator line according to chosen aesthetic style."""
    if style == "double":
        return "=" * width
    elif style == "dotted":
        return "." * width
    elif style == "solid":
        return "_" * width
    elif style == "stars":
        return ("* " * ((width // 2) + 1))[:width]
    elif style == "wavy":
        return ("~ " * ((width // 2) + 1))[:width]
    return "-" * width


def print_receipt_logo(printer, logo_base64: str, is_58mm: bool):
    """Prints monochrome raster store logo via python-escpos image command."""
    if not logo_base64 or not hasattr(printer, 'image'):
        return
    try:
        import base64
        import io
        from PIL import Image

        raw_b64 = logo_base64.split(",", 1)[1] if "," in logo_base64 else logo_base64
        img_bytes = base64.b64decode(raw_b64)
        pil_img = Image.open(io.BytesIO(img_bytes))

        # Handle transparency: composite onto white background
        if pil_img.mode in ('RGBA', 'LA') or (pil_img.mode == 'P' and 'transparency' in pil_img.info):
            alpha = pil_img.convert('RGBA')
            bg = Image.new('RGBA', alpha.size, (255, 255, 255, 255))
            bg.paste(alpha, mask=alpha.split()[3])
            pil_img = bg.convert('RGB')
        else:
            pil_img = pil_img.convert('RGB')

        max_dots = 320 if is_58mm else 420
        if pil_img.width > max_dots:
            scale = max_dots / pil_img.width
            new_h = max(1, int(pil_img.height * scale))
            pil_img = pil_img.resize((max_dots, new_h), Image.Resampling.LANCZOS)

        bw_img = pil_img.convert('1')
        printer.set(align='center')
        printer.image(bw_img, center=True)
    except Exception as img_err:
        logger.warning(f"Failed to print receipt logo image: {img_err}")


def write_receipt_text(printer, text: str, strip_diacritics: bool = False, encoding: str = "CP852"):
    """
    Safely writes Czech text to ESC/POS thermal printer with CP852/CP1250 encoding,
    falling back to ASCII transliteration if strip_diacritics is enabled or if unencodable.
    """
    if not text:
        return
    if strip_diacritics:
        import unicodedata
        clean = unicodedata.normalize('NFKD', text).encode('ASCII', 'ignore').decode('utf-8')
        printer.text(clean)
        return

    try:
        printer.text(text)
    except Exception:
        try:
            raw_bytes = text.encode(encoding, errors='replace')
            if hasattr(printer, '_raw'):
                printer._raw(raw_bytes)
            else:
                printer.text(raw_bytes.decode(encoding, errors='replace'))
        except Exception:
            import unicodedata
            clean = unicodedata.normalize('NFKD', text).encode('ASCII', 'ignore').decode('utf-8')
            printer.text(clean)


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
        with _hardware_printer_lock:
            return self._do_print_receipt(sale_data, store_config)

    def _do_print_receipt(self, sale_data: dict, store_config: dict) -> dict:
        paper_width = str(store_config.get("printerPaperWidth", store_config.get("printer_paper_width", "80"))).upper()
        is_a4 = paper_width == "A4"
        is_58mm = not is_a4 and paper_width in ["58", "48"]
        line_width = 80 if is_a4 else (32 if is_58mm else 48)
        name_width = 40 if is_a4 else (14 if is_58mm else 28)
        print_mm = "Formát A4 (Faktura / Daňový Doklad)" if is_a4 else ("48mm (58mm rola)" if is_58mm else "72mm (80mm rola)")

        logger.info(f"Printing {print_mm} receipt #{sale_data.get('receiptNumber')} via {self.interface_type}")

        try:
            # Customization Settings
            sep_style = store_config.get("receiptSeparatorStyle", "dashed")
            separator = get_receipt_separator(sep_style, line_width)
            dash_line = get_receipt_separator("dashed", line_width)
            top_margin = int(store_config.get("receiptTopMargin", 1))
            bottom_margin = int(store_config.get("receiptBottomMargin", 3))
            copies = max(1, min(2, int(store_config.get("receiptCopies", 1))))
            encoding = store_config.get("receiptEncoding", "CP852")
            strip_diacritics = bool(store_config.get("stripDiacritics", False))

            bold_store = bool(store_config.get("receiptBoldStoreName", True))
            bold_items = bool(store_config.get("receiptBoldItemNames", True))
            bold_prices = bool(store_config.get("receiptBoldPrices", True))
            bold_total = bool(store_config.get("receiptBoldTotal", True))
            bold_footer = bool(store_config.get("receiptBoldFooter", False))

            title_style = store_config.get("receiptTitleStyle", "banner")
            show_contacts = bool(store_config.get("receiptShowStoreContact", True))
            item_density = store_config.get("receiptItemDensity", "standard")
            show_sku = bool(store_config.get("receiptShowItemSku", False))
            show_vat = bool(store_config.get("receiptShowItemVat", True))
            show_disc = bool(store_config.get("receiptShowItemDiscount", True))
            tax_matrix_style = store_config.get("receiptTaxMatrixStyle", "detailed")
            qr_type = store_config.get("receiptQrCodeType", "none")
            show_logo = bool(store_config.get("receiptShowLogo", False))
            logo_base64 = str(store_config.get("receiptLogoBase64", "") or "").strip()
            show_branding = bool(store_config.get("receiptShowBranding", True))
            show_cashier = bool(store_config.get("receiptShowCashier", True))
            custom_header = str(store_config.get("receiptCustomHeader") or store_config.get("receipt_custom_header") or "").strip()


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
                    printer = Network(self.address, port=9100, timeout=3.0)
                elif self.interface_type == "SERIAL" and self.address:
                    from escpos.printer import Serial
                    printer = Serial(self.address, baudrate=9600)
            except Exception as conn_err:
                logger.info(f"Physical ESC/POS printer hardware offline ({conn_err}), using print simulation fallback.")
                printer = None

            if printer:
                try:
                    if hasattr(printer, 'open'):
                        printer.open(f"VoltFlow_POS_Receipt_{sale_data.get('receiptNumber')}")
                except Exception as open_err:
                    logger.warning(f"Failed to open printer device ({open_err}), falling back to simulation.")
                    printer = None

            if printer:
                try:
                    # Set ESC/POS codepage to CP852 / CP1250 if supported
                    try:
                        if hasattr(printer, 'charcode'):
                            printer.charcode(encoding if encoding in ['CP852', 'CP1250'] else 'CP852')
                    except Exception:
                        pass

                    is_refund = sale_data.get("isRefund") or sale_data.get("is_refund")
                    receipt_num = str(sale_data.get("receiptNumber", ""))
                    orig_num = str(sale_data.get("originalReceiptNumber") or sale_data.get("original_receipt_number") or "")
                    refund_reason = str(sale_data.get("refundReason") or sale_data.get("refund_reason") or "")
                    pm = str(sale_data.get('paymentMethod', '')).upper()

                    for copy_idx in range(copies):
                        # Top Margin Feed
                        for _ in range(top_margin):
                            printer.text("\n")

                        # Copy indicator if 2nd copy
                        if copy_idx > 0:
                            printer.set(align='center', font='a', width=1, height=1, bold=True)
                            write_receipt_text(printer, "*** KOPIE PRO OBCHODNÍKA ***\n", strip_diacritics, encoding)
                            printer.text(separator + "\n")

                        # Store Logo (if enabled)
                        if show_logo and logo_base64:
                            print_receipt_logo(printer, logo_base64, is_58mm)

                        # Store Header
                        printer.set(align='center', font='a', width=2 if bold_store else 1, height=2 if bold_store else 1, bold=bold_store)
                        write_receipt_text(printer, f"{store_config.get('storeName', 'VoltFlow POS')}\n", strip_diacritics, encoding)
                        printer.set(align='center', font='a', width=1, height=1, bold=False)

                        if store_config.get('street'):
                            write_receipt_text(printer, f"{store_config.get('street')}\n", strip_diacritics, encoding)
                        if store_config.get('city'):
                            write_receipt_text(printer, f"{store_config.get('city')}\n", strip_diacritics, encoding)

                        vat_status = store_config.get("receiptVatPayerStatus", "payer")
                        vat_badge = "Plátce DPH" if vat_status == "payer" else "Neplátce DPH"
                        ico_str = store_config.get('ico', '')
                        dic_str = store_config.get('dic', '')
                        if ico_str or dic_str:
                            write_receipt_text(printer, f"IČO: {ico_str}  DIČ: {dic_str} ({vat_badge})\n", strip_diacritics, encoding)

                        # Optional Store Contacts
                        if show_contacts:
                            contacts = []
                            if store_config.get("receiptStorePhone"):
                                contacts.append(f"Tel: {store_config.get('receiptStorePhone')}")
                            if store_config.get("receiptStoreEmail"):
                                contacts.append(f"Email: {store_config.get('receiptStoreEmail')}")
                            if contacts:
                                write_receipt_text(printer, " • ".join(contacts) + "\n", strip_diacritics, encoding)

                        reg_no = store_config.get('registerNo') or 'Pokladna #01'
                        prov_no = store_config.get('idProvozovny') or '11'
                        write_receipt_text(printer, f"Provozovna: {prov_no} | {reg_no}\n", strip_diacritics, encoding)
                        if custom_header:
                            write_receipt_text(printer, f"{custom_header}\n", strip_diacritics, encoding)
                        printer.text(separator + "\n")


                        # Document Title & Timestamp
                        raw_title = f"STORNO DOKLAD č. {receipt_num}" if is_refund else f"DAŇOVÝ DOKLAD č. {receipt_num}"
                        printer.set(align='center', font='a', width=1, height=1, bold=True)

                        if title_style == "framed":
                            box_line = "+" + "-" * (line_width - 2) + "+"
                            printer.text(box_line + "\n")
                            write_receipt_text(printer, f"|{raw_title.center(line_width - 2)}|\n", strip_diacritics, encoding)
                            printer.text(box_line + "\n")
                        elif title_style == "banner":
                            printer.text(dash_line + "\n")
                            write_receipt_text(printer, f"══ {raw_title} ══\n", strip_diacritics, encoding)
                            printer.text(dash_line + "\n")
                        elif title_style == "classic":
                            printer.text(dash_line + "\n")
                            write_receipt_text(printer, f"{raw_title}\n", strip_diacritics, encoding)
                            printer.text(dash_line + "\n")
                        else:  # minimal
                            write_receipt_text(printer, f"{raw_title}\n", strip_diacritics, encoding)

                        printer.set(align='center', font='a', width=1, height=1, bold=False)
                        if is_refund and orig_num:
                            write_receipt_text(printer, f"Původní doklad: #{orig_num}\n", strip_diacritics, encoding)
                        if is_refund and refund_reason:
                            write_receipt_text(printer, f"Důvod: {refund_reason}\n", strip_diacritics, encoding)

                        ts_val = str(sale_data.get("timestamp", ""))
                        if ts_val:
                            try:
                                dt = datetime.fromisoformat(ts_val.replace("Z", "+00:00"))
                                formatted_ts = dt.strftime("%d.%m.%Y %H:%M:%S")
                            except Exception:
                                formatted_ts = ts_val[:19].replace('T', ' ')
                            write_receipt_text(printer, f"Datum a čas: {formatted_ts}\n", strip_diacritics, encoding)

                        if show_cashier:
                            cashier_name = sale_data.get("cashier") or sale_data.get("cashierName") or "Pokladní"
                            write_receipt_text(printer, f"Obsluha: {cashier_name}\n", strip_diacritics, encoding)

                        printer.text(separator + "\n")

                        # Items Header
                        printer.set(align='left', font='a', width=1, height=1, bold=True)
                        if is_58mm:
                            printer.text(f"{'Položka':<14} {'Ks':^4} {'Cena':>12}\n")
                        else:
                            printer.text(f"{'Položka':<28} {'Ks':^5} {'Cena':>13}\n")
                        printer.text(dash_line + "\n")

                        # Line Items
                        name_w = 14 if is_58mm else 28
                        for item in sale_data.get('items', []):
                            qty = item.get('quantity', 1)
                            disc = item.get('discountPercent') or item.get('discount_percent') or 0
                            price = item.get('price', 0) * (1 - disc / 100)
                            tot = price * qty
                            tot_str = f"{tot:.0f} Kč"
                            name_raw = item.get('name', '')

                            printer.set(align='left', font='a', width=1, height=1, bold=bold_items)
                            if len(name_raw) > name_w:
                                write_receipt_text(printer, f"{name_raw[:line_width]}\n", strip_diacritics, encoding)
                                printer.set(align='left', font='a', width=1, height=1, bold=bold_prices)
                                if is_58mm:
                                    printer.text(f"{'':<14} {qty:^4} {tot_str:>12}\n")
                                else:
                                    printer.text(f"{'':<28} {qty:^5} {tot_str:>13}\n")
                            else:
                                if is_58mm:
                                    write_receipt_text(printer, f"{name_raw:<14}", strip_diacritics, encoding)
                                    printer.set(align='left', font='a', width=1, height=1, bold=bold_prices)
                                    printer.text(f" {qty:^4} {tot_str:>12}\n")
                                else:
                                    write_receipt_text(printer, f"{name_raw:<28}", strip_diacritics, encoding)
                                    printer.set(align='left', font='a', width=1, height=1, bold=bold_prices)
                                    printer.text(f" {qty:^5} {tot_str:>13}\n")

                            printer.set(align='left', font='a', width=1, height=1, bold=False)
                            if show_sku and (item.get('barcode') or item.get('sku')):
                                write_receipt_text(printer, f"  Kód: {item.get('barcode') or item.get('sku')}\n", strip_diacritics, encoding)
                            if item_density == "standard":
                                if show_disc and disc > 0:
                                    write_receipt_text(printer, f"  (-{disc}% sleva)\n", strip_diacritics, encoding)
                                if show_vat:
                                    vat_rate = item.get('vat', 21)
                                    write_receipt_text(printer, f"  DPH {vat_rate}%\n", strip_diacritics, encoding)

                        printer.text(separator + "\n")

                        # Total Banner
                        tot_val_str = f"{sale_data.get('totalAmount', 0):.0f} Kč"
                        tot_label = "STORNO:" if is_refund else "CELKEM K ÚHRADĚ:"
                        printer.set(align='left', font='a', width=1, height=1, bold=bold_total)
                        if is_58mm:
                            write_receipt_text(printer, f"{tot_label:<16} {tot_val_str:>15}\n", strip_diacritics, encoding)
                        else:
                            write_receipt_text(printer, f"{tot_label:<24} {tot_val_str:>23}\n", strip_diacritics, encoding)
                        printer.set(align='left', font='a', width=1, height=1, bold=False)
                        printer.text(dash_line + "\n")

                        # Payment Method & Cash Details
                        pm_label = "HOTOVOST" if pm in ["CASH", "HOTOVOST"] else ("KARTA" if pm in ["CARD", "KARTA"] else ("KOMBINOVANÁ" if pm in ["SPLIT"] else "QR PLATBA"))
                        if is_58mm:
                            write_receipt_text(printer, f"{'Způsob úhrady:':<16} {pm_label:>15}\n", strip_diacritics, encoding)
                        else:
                            write_receipt_text(printer, f"{'Způsob úhrady:':<24} {pm_label:>23}\n", strip_diacritics, encoding)

                        if pm in ["CASH", "HOTOVOST"]:
                            tend = sale_data.get("tenderedAmount") or sale_data.get("tendered_amount") or 0
                            chg = sale_data.get("changeDue") or sale_data.get("change_due") or 0
                            tend_str = f"{tend:.0f} Kč"
                            chg_str = f"{chg:.0f} Kč"
                            if is_58mm:
                                write_receipt_text(printer, f"{'  Přijato:':<16} {tend_str:>15}\n", strip_diacritics, encoding)
                                write_receipt_text(printer, f"{'  Vráceno:':<16} {chg_str:>15}\n", strip_diacritics, encoding)
                            else:
                                write_receipt_text(printer, f"{'  Přijatá hotovost:':<24} {tend_str:>23}\n", strip_diacritics, encoding)
                                write_receipt_text(printer, f"{'  Vráceno:':<24} {chg_str:>23}\n", strip_diacritics, encoding)
                        elif pm == "SPLIT" and sale_data.get("splitDetails"):
                            split = sale_data.get("splitDetails")
                            cash_part = f"{(split.get('cash') or 0):.0f} Kč"
                            card_part = f"{(split.get('card') or 0):.0f} Kč"
                            if is_58mm:
                                write_receipt_text(printer, f"{'  - Hotově:':<16} {cash_part:>15}\n", strip_diacritics, encoding)
                                write_receipt_text(printer, f"{'  - Kartou:':<16} {card_part:>15}\n", strip_diacritics, encoding)
                            else:
                                write_receipt_text(printer, f"{'  - Hotově:':<24} {cash_part:>23}\n", strip_diacritics, encoding)
                                write_receipt_text(printer, f"{'  - Kartou:':<24} {card_part:>23}\n", strip_diacritics, encoding)

                        printer.text(dash_line + "\n")

                        # Tax Summary Breakdown (Rozpis DPH)
                        tax_summary = sale_data.get("taxSummary") or sale_data.get("tax_summary")
                        if tax_matrix_style != "none" and tax_summary and isinstance(tax_summary, dict):
                            write_receipt_text(printer, "Rozpis DPH:\n", strip_diacritics, encoding)
                            if tax_matrix_style == "compact" or is_58mm:
                                printer.text(f"{'Sazba':<6} {'Základ':>12} {'Daň':>12}\n")
                                for t in tax_summary.values():
                                    r_str = f"{t.get('rate')}%"
                                    net_str = f"{t.get('net', 0):.2f}"
                                    tax_str = f"{t.get('tax', 0):.2f}"
                                    printer.text(f"{r_str:<6} {net_str:>12} {tax_str:>12}\n")
                            else:
                                printer.text(f"{'Sazba':<8} {'Základ':>13} {'Daň':>11} {'Brutto':>13}\n")
                                for t in tax_summary.values():
                                    r_str = f"{t.get('rate')}%"
                                    net_str = f"{t.get('net', 0):.2f}"
                                    tax_str = f"{t.get('tax', 0):.2f}"
                                    gross_str = f"{t.get('gross', 0):.2f}"
                                    printer.text(f"{r_str:<8} {net_str:>13} {tax_str:>11} {gross_str:>13}\n")
                            printer.text(dash_line + "\n")

                        # Fiscal / EET block (only print when EET was actively used)
                        fik = sale_data.get("fik") or sale_data.get("fik_code")
                        bkp = sale_data.get("bkp") or sale_data.get("bkp_code")
                        if fik:
                            printer.text(f"EET FIK: {fik}\n")
                        if bkp:
                            printer.text(f"EET BKP: {bkp}\n")

                        # Optional QR Code
                        raw_iban = (store_config.get('bankAccountIban') or store_config.get('bank_account_iban') or '').replace(' ', '').upper()
                        store_name = store_config.get('storeName') or store_config.get('store_name') or 'VoltFlow POS'
                        if qr_type == "spayd" and raw_iban and raw_iban != 'CZ6508000000001234567890':
                            tot_czk = sale_data.get('totalAmount', 0)
                            spayd_payload = f"SPD*1.0*ACC:{raw_iban}*AM:{tot_czk:.2f}*CC:CZK*X-VS:{receipt_num}*MSG:{store_name}"
                            printer.set(align='center')
                            write_receipt_text(printer, "QR Platba (Převod na účet):\n", strip_diacritics, encoding)
                            try:
                                if hasattr(printer, 'qr'):
                                    printer.qr(spayd_payload, size=3)
                            except Exception as qr_err:
                                logger.debug(f"ESC/POS QR print note: {qr_err}")
                        elif qr_type == "url":
                            qr_url = store_config.get("receiptQrCodeUrl") or store_config.get("receipt_qr_code_url")
                            if qr_url:
                                printer.set(align='center')
                                try:
                                    if hasattr(printer, 'qr'):
                                        printer.qr(qr_url, size=3)
                                except Exception as qr_err:
                                    logger.debug(f"ESC/POS QR print note: {qr_err}")

                        printer.text(separator + "\n")

                        # Multi-line Custom Footer
                        footer_raw = store_config.get('receiptFooterLines') or store_config.get('receiptFooter') or "Děkujeme za váš nákup!"
                        printer.set(align='center', bold=bold_footer)
                        for f_line in footer_raw.splitlines():
                            if f_line.strip():
                                write_receipt_text(printer, f"{f_line.strip()}\n", strip_diacritics, encoding)

                        if show_branding:
                            printer.set(align='center', font='a', width=1, height=1, bold=False)
                            write_receipt_text(printer, "Vystaveno v pokladním systému VoltFlow POS\n", strip_diacritics, encoding)

                        # Bottom Margin before cutter
                        for _ in range(bottom_margin):
                            printer.text("\n")

                        # Partial cut between copies or full cut at end
                        try:
                            if copy_idx < copies - 1:
                                printer.cut(mode='PART')
                            else:
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
            if show_logo and logo_base64:
                print("[LOGO: Store Graphical Logo]")
            print(f"Store: {store_config.get('storeName')}")
            print(f"Receipt #: {sale_data.get('receiptNumber')}")
            print(f"Paper Width: {paper_width} mm ({line_width} chars/line)")
            print(f"Top Margin: {top_margin} lines | Bottom Margin: {bottom_margin} lines")
            print(f"Separator Style: {sep_style} | Title Style: {title_style}")
            print(f"Total Amount: {sale_data.get('totalAmount')} Kč")
            print(f"Payment Method: {sale_data.get('paymentMethod')}")
            print(separator)
            return {"success": True, "physical": False, "status": "SIMULATED"}

        except Exception as e:
            logger.error(f"Failed to print thermal receipt: {e}")
            return {"success": False, "physical": False, "status": "ERROR", "error": str(e)}

    def print_daily_summary(self, summary_data: dict, store_config: dict, open_drawer: bool = True) -> dict:
        """
        Prints a concise daily summary slip on thermal receipt paper
        and optionally kicks open the cash drawer for cash counting.
        """
        with _hardware_printer_lock:
            return self._do_print_daily_summary(summary_data, store_config, open_drawer)

    def _do_print_daily_summary(self, summary_data: dict, store_config: dict, open_drawer: bool = True) -> dict:
        paper_width = str(store_config.get("printerPaperWidth", store_config.get("printer_paper_width", "80"))).upper()
        is_58mm = paper_width in ["58", "48"]
        line_width = 32 if is_58mm else 48
        separator = "=" * line_width
        dash_line = "-" * line_width

        logger.info(f"Printing daily summary slip via {self.interface_type}")

        try:
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
                        printer = Usb(0x04b8, 0x0e15, 0)
                elif self.interface_type == "NETWORK" and self.address:
                    from escpos.printer import Network
                    printer = Network(self.address, port=9100, timeout=3.0)
                elif self.interface_type == "SERIAL" and self.address:
                    from escpos.printer import Serial
                    printer = Serial(self.address, baudrate=9600)
            except Exception as conn_err:
                logger.info(f"Physical printer offline for daily summary ({conn_err}), using simulation fallback.")
                printer = None

            if printer:
                try:
                    if hasattr(printer, 'open'):
                        printer.open("VoltFlow_POS_Daily_Summary")
                    try:
                        if hasattr(printer, 'charcode'):
                            printer.charcode('CP852')
                    except Exception:
                        pass

                    # Store Header
                    printer.set(align='center', font='a', width=1, height=1)
                    printer.text(f"{store_config.get('storeName', 'VoltFlow POS')}\n")
                    if store_config.get("street"):
                        printer.text(f"{store_config.get('street')}\n")
                    if store_config.get("city"):
                        printer.text(f"{store_config.get('city')}\n")
                    if store_config.get("ico"):
                        printer.text(f"ICO: {store_config.get('ico')}\n")

                    printer.text(f"{separator}\n")
                    printer.set(align='center', bold=True)
                    printer.text("DENNI PREHLED TRZEB / TONG KET\n")
                    printer.set(align='center', bold=False)
                    date_str = summary_data.get("date", datetime.now().strftime("%d.%m.%Y"))
                    time_str = summary_data.get("time", datetime.now().strftime("%H:%M"))
                    printer.text(f"Datum: {date_str}  Cas: {time_str}\n")
                    printer.text(f"{separator}\n")

                    # Grand Total
                    total_rev = float(summary_data.get("totalRevenue", 0.0))
                    printer.set(align='left', font='a', width=1, height=2)
                    printer.text(f"CELKEM: {total_rev:,.2f} Kc\n".replace(",", " "))
                    printer.set(align='left', font='a', width=1, height=1)
                    printer.text(f"{dash_line}\n")

                    # Cash & Card Breakdown
                    cash_amt = float(summary_data.get("cashAmount", 0.0))
                    card_amt = float(summary_data.get("cardAmount", 0.0))
                    count = int(summary_data.get("salesCount", 0))

                    printer.text(f"Hotovost v pokladne: {cash_amt:,.2f} Kc\n".replace(",", " "))
                    printer.text(f"Platby kartou:       {card_amt:,.2f} Kc\n".replace(",", " "))
                    printer.text(f"Pocet uctenek:       {count}\n")
                    printer.text(f"{dash_line}\n")

                    # Cash Drawer Message & Cut
                    if open_drawer:
                        printer.text("Zasuvka otevrena pro prepocet.\n")
                    printer.text(f"{separator}\n\n\n")

                    printer.cut()
                    if open_drawer:
                        try:
                            printer.cashdraw(2)
                        except Exception:
                            pass
                        try:
                            printer.cashdraw(5)
                        except Exception:
                            pass

                    return {"success": True, "physical": True, "status": "PRINTED"}
                except Exception as print_err:
                    logger.warning(f"Error during physical daily summary print: {print_err}")
                finally:
                    try:
                        if hasattr(printer, 'close'):
                            printer.close()
                    except Exception:
                        pass

            # Simulation fallback
            total_rev = float(summary_data.get("totalRevenue", 0.0))
            cash_amt = float(summary_data.get("cashAmount", 0.0))
            card_amt = float(summary_data.get("cardAmount", 0.0))
            count = int(summary_data.get("salesCount", 0))

            print(separator)
            print("--- PHYSICAL ESC/POS DAILY SUMMARY SIMULATION ---")
            print(f"Store: {store_config.get('storeName', 'VoltFlow POS')}")
            print("DENNI PREHLED TRZEB")
            print(f"Total: {total_rev:.2f} Kc | Cash: {cash_amt:.2f} Kc | Card: {card_amt:.2f} Kc")
            print(f"Count: {count}")
            if open_drawer:
                print("--- CASH DRAWER OPEN SIGNAL SIMULATED ---")
            print(separator)

            return {"success": True, "physical": False, "status": "SIMULATED"}

        except Exception as e:
            logger.error(f"Failed to print daily summary: {e}")
            return {"success": False, "physical": False, "status": "ERROR", "error": str(e)}

    def open_cash_drawer(self) -> dict:
        """
        Sends pulse signal to thermal printer cash drawer RJ11/RJ12 port to kick the drawer open.
        """
        with _hardware_printer_lock:
            return self._do_open_cash_drawer()

    def _do_open_cash_drawer(self) -> dict:
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
                printer = Network(self.address, port=9100, timeout=3.0)
            elif self.interface_type == "SERIAL" and self.address:
                from escpos.printer import Serial
                printer = Serial(self.address, baudrate=9600)

            if printer:
                try:
                    if hasattr(printer, 'open'):
                        printer.open("VoltFlow_POS_Drawer_Kick")
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

    def print_barcode_label(self, item_data: dict, store_config: dict, copies: int = 1) -> dict:
        """
        Prints one or more physical ESC/POS thermal barcode shelf labels.
        Each label contains store name, item name, price, native hardware barcode, and code text.
        """
        with _hardware_printer_lock:
            return self._do_print_barcode_label(item_data, store_config, copies)

    def _do_print_barcode_label(self, item_data: dict, store_config: dict, copies: int = 1) -> dict:
        copies = max(1, min(100, int(copies or 1)))
        store_name = store_config.get("storeName", store_config.get("store_name", "VoltFlow POS"))
        item_name = item_data.get("name", "Položka")
        price = float(item_data.get("price", 0.0))
        vat = item_data.get("vat", 21)
        barcode_val = str(item_data.get("barcode") or item_data.get("id") or "").strip()

        logger.info(f"Printing {copies} barcode label(s) for '{item_name}' (barcode: {barcode_val}) via {self.interface_type}")

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
                printer = Network(self.address, port=9100, timeout=3.0)
            elif self.interface_type == "SERIAL" and self.address:
                from escpos.printer import Serial
                printer = Serial(self.address, baudrate=9600)

            if printer:
                try:
                    if hasattr(printer, 'open'):
                        printer.open("VoltFlow_POS_Label_Print")

                    for _ in range(copies):
                        printer.set(align='center', font='a')
                        if store_name:
                            printer.text(f"{store_name}\n")
                        
                        # Product Name bold
                        printer.set(align='center', bold=True, double_height=True, double_width=False)
                        printer.text(f"{item_name}\n")

                        # Price prominent
                        printer.set(align='center', bold=True, double_height=True, double_width=True)
                        printer.text(f"{price:.2f} Kč\n")

                        # Barcode
                        printer.set(align='center')
                        if barcode_val:
                            # Use EAN13 if 12 or 13 digits, else CODE128
                            if barcode_val.isdigit() and len(barcode_val) in [12, 13]:
                                btype = 'EAN13'
                            else:
                                btype = 'CODE128'
                            try:
                                printer.barcode(barcode_val, btype, height=64, width=2, pos='BELOW', font='A')
                            except Exception as bc_err:
                                logger.warning(f"Native barcode command failed: {bc_err}, falling back to text")
                                printer.text(f"* {barcode_val} *\n")
                        
                        printer.set(align='center', font='b')
                        printer.text(f"DPH {vat}%\n")
                        printer.text("\n\n")
                        printer.cut()

                    return {"success": True, "physical": True, "status": "PRINTED", "copies": copies}
                finally:
                    try:
                        if hasattr(printer, 'close'):
                            printer.close()
                    except Exception:
                        pass

            print(f"--- BARCODE LABEL SIMULATED: {item_name} | {price:.2f} Kč | {barcode_val} (x{copies}) ---")
            return {"success": True, "physical": False, "status": "SIMULATED", "copies": copies}
        except Exception as err:
            logger.error(f"Failed to print barcode label: {err}")
            return {"success": False, "physical": False, "status": "ERROR", "error": str(err)}


