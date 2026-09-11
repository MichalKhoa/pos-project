import os
import glob
import logging
import threading
import time
from datetime import datetime
from typing import Optional

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
            show_barcode = bool(store_config.get("receiptShowBarcode", store_config.get("receipt_show_barcode", True)))
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
                        is_inv = bool(sale_data.get("isInvoice") or sale_data.get("is_invoice") or sale_data.get("invoice_number"))
                        inv_num_val = sale_data.get("invoiceNumber") or sale_data.get("invoice_number") or ""

                        if is_inv:
                            # ==================== FORMAL B2B INVOICE THERMAL LAYOUT ====================
                            inv_title = f"OPRAVNÝ DAŇOVÝ DOKLAD č. {inv_num_val}" if is_refund else f"FAKTURA - DAŇOVÝ DOKLAD č. {inv_num_val or receipt_num}"
                            printer.set(align='center', font='a', width=1, height=1, bold=True)
                            printer.text(separator + "\n")
                            write_receipt_text(printer, f"{inv_title}\n", strip_diacritics, encoding)
                            printer.text(separator + "\n")

                            # DODAVATEL Box
                            printer.set(align='left', font='a', width=1, height=1, bold=True)
                            write_receipt_text(printer, "DODAVATEL:\n", strip_diacritics, encoding)
                            printer.set(align='left', font='a', width=1, height=1, bold=False)
                            s_name = store_config.get('storeName', 'VoltFlow POS')
                            write_receipt_text(printer, f" {s_name}\n", strip_diacritics, encoding)
                            s_street = store_config.get('street', '')
                            s_city = store_config.get('city', '')
                            if s_street or s_city:
                                write_receipt_text(printer, f" {s_street}, {s_city}\n", strip_diacritics, encoding)
                            write_receipt_text(printer, f" IČO: {ico_str}   DIČ: {dic_str} ({vat_badge})\n", strip_diacritics, encoding)
                            write_receipt_text(printer, " Zapsán v živnostenském rejstříku\n", strip_diacritics, encoding)
                            raw_iban = (store_config.get('bankAccountIban') or store_config.get('bank_account_iban') or '').strip()
                            if raw_iban:
                                write_receipt_text(printer, f" Účet: {raw_iban}\n", strip_diacritics, encoding)

                            printer.text(dash_line + "\n")

                            # ODBĚRATEL Box
                            printer.set(align='left', font='a', width=1, height=1, bold=True)
                            write_receipt_text(printer, "ODBĚRATEL:\n", strip_diacritics, encoding)
                            printer.set(align='left', font='a', width=1, height=1, bold=False)
                            c_name = sale_data.get("customerName") or sale_data.get("customer_name") or ""
                            c_addr = sale_data.get("customerAddress") or sale_data.get("customer_address") or ""
                            c_ico = sale_data.get("customerIco") or sale_data.get("customer_ico") or ""
                            c_dic = sale_data.get("customerDic") or sale_data.get("customer_dic") or ""
                            if c_name:
                                write_receipt_text(printer, f" {c_name}\n", strip_diacritics, encoding)
                            if c_addr:
                                write_receipt_text(printer, f" {c_addr}\n", strip_diacritics, encoding)
                            id_line = f" IČO: {c_ico}"
                            if c_dic:
                                id_line += f"   DIČ: {c_dic}"
                            write_receipt_text(printer, f"{id_line}\n", strip_diacritics, encoding)

                            printer.text(dash_line + "\n")

                            # Invoice Dates & Metadata
                            vs_num = "".join(filter(str.isdigit, str(inv_num_val or receipt_num)))
                            write_receipt_text(printer, f"Evidenční číslo:  {receipt_num}\n", strip_diacritics, encoding)
                            if vs_num:
                                write_receipt_text(printer, f"Variabilní symb.: {vs_num}\n", strip_diacritics, encoding)
                            ts_val = str(sale_data.get("timestamp", ""))
                            if ts_val:
                                try:
                                    dt = datetime.fromisoformat(ts_val.replace("Z", "+00:00"))
                                    formatted_ts = dt.strftime("%d.%m.%Y %H:%M:%S")
                                except Exception:
                                    formatted_ts = ts_val[:19].replace('T', ' ')
                            else:
                                formatted_ts = datetime.now().strftime("%d.%m.%Y %H:%M:%S")
                            write_receipt_text(printer, f"Datum vystavení:  {formatted_ts}\n", strip_diacritics, encoding)
                            write_receipt_text(printer, f"DUZP:             {formatted_ts[:10]}\n", strip_diacritics, encoding)
                            pm_label = "HOTOVOST" if pm in ["CASH", "HOTOVOST"] else ("KARTA" if pm in ["CARD", "KARTA"] else ("KOMBINOVANÁ" if pm in ["SPLIT"] else "PŘEVOD"))
                            write_receipt_text(printer, f"Způsob úhrady:    {pm_label}\n", strip_diacritics, encoding)
                            if is_refund and orig_num:
                                write_receipt_text(printer, f"Původní faktura:  #{orig_num}\n", strip_diacritics, encoding)
                            if is_refund and refund_reason:
                                write_receipt_text(printer, f"Důvod opravy:     {refund_reason}\n", strip_diacritics, encoding)

                            printer.text(separator + "\n")

                            # Itemized Line Items for Invoice (showing unit price ex VAT and VAT %)
                            printer.set(align='left', font='a', width=1, height=1, bold=True)
                            if is_58mm:
                                printer.text(f"{'Položka':<16} {'Ks':^4} {'Celkem':>10}\n")
                            else:
                                printer.text(f"{'Položka':<20} {'Ks':^4} {'b.DPH':>7} {'DPH':>4} {'Celk.':>8}\n")
                            printer.text(dash_line + "\n")

                            for item in sale_data.get('items', []):
                                qty = float(item.get('quantity', 1))
                                disc = float(item.get('discountPercent') or item.get('discount_percent') or 0)
                                price_inc = float(item.get('price', 0)) * (1 - disc / 100)
                                vat_rate = float(item.get('vat', 21))
                                price_ex = price_inc / (1.0 + vat_rate / 100.0)
                                tot_inc = price_inc * qty
                                name_raw = item.get('name', '')
                                unit_val = item.get('unit') or ('kg' if (item.get('is_weighted') or item.get('isWeighted')) else 'ks')

                                printer.set(align='left', font='a', width=1, height=1, bold=True)
                                write_receipt_text(printer, f"{name_raw[:line_width]}\n", strip_diacritics, encoding)
                                printer.set(align='left', font='a', width=1, height=1, bold=False)

                                qty_str = f"{qty:.0f}" if qty % 1 == 0 else f"{qty:.2f}"
                                if is_58mm:
                                    sub_line = f"  {qty_str}{unit_val} x {price_ex:.2f} b.D. ({vat_rate:.0f}%)"
                                    tot_str = f"{tot_inc:.2f} Kč"
                                    space_w = max(1, line_width - len(sub_line) - len(tot_str))
                                    printer.text(f"{sub_line}{' ' * space_w}{tot_str}\n")
                                else:
                                    printer.text(f"  {qty_str:>3} {unit_val:<2} x {price_ex:>6.2f} b.D. | DPH {vat_rate:>2.0f}% | {tot_inc:>7.2f}Kč\n")

                            printer.text(separator + "\n")

                            # Total & Payment status
                            tot_val_str = f"{sale_data.get('totalAmount', 0):.2f} Kč"
                            tot_label = "CELKEM K VRÁCENÍ:" if is_refund else "CELKEM K ÚHRADĚ:"
                            printer.set(align='left', font='a', width=1, height=1, bold=True)
                            if is_58mm:
                                write_receipt_text(printer, f"{tot_label:<16} {tot_val_str:>15}\n", strip_diacritics, encoding)
                            else:
                                write_receipt_text(printer, f"{tot_label:<24} {tot_val_str:>23}\n", strip_diacritics, encoding)
                            printer.set(align='left', font='a', width=1, height=1, bold=False)
                            printer.text(dash_line + "\n")
                            write_receipt_text(printer, f"Stav úhrady: UHRAZENO NA POKLADNĚ ({pm_label})\n", strip_diacritics, encoding)
                            printer.text(dash_line + "\n")

                            # Rekapitulace DPH table (§ 29 ZoDPH)
                            tax_summary = sale_data.get("taxSummary") or sale_data.get("tax_summary")
                            if tax_summary and isinstance(tax_summary, dict):
                                write_receipt_text(printer, "REKAPITULACE DPH (§ 29 ZoDPH):\n", strip_diacritics, encoding)
                                if is_58mm:
                                    printer.text(f"{'Sazba':<6} {'Základ':>12} {'Daň':>12}\n")
                                    for t in tax_summary.values():
                                        r_str = f"{t.get('rate')}%"
                                        net_str = f"{t.get('net', 0):.2f}"
                                        tax_str = f"{t.get('tax', 0):.2f}"
                                        printer.text(f"{r_str:<6} {net_str:>12} {tax_str:>12}\n")
                                else:
                                    printer.text(f"{'Sazba':<8} {'Základ':>13} {'Daň':>11} {'Celkem':>13}\n")
                                    for t in tax_summary.values():
                                        r_str = f"{t.get('rate')}%"
                                        net_str = f"{t.get('net', 0):.2f}"
                                        tax_str = f"{t.get('tax', 0):.2f}"
                                        gross_str = f"{t.get('gross', 0):.2f}"
                                        printer.text(f"{r_str:<8} {net_str:>13} {tax_str:>11} {gross_str:>13}\n")
                                printer.text(dash_line + "\n")

                            # Statutory footer
                            printer.set(align='center', font='a', width=1, height=1, bold=False)
                            write_receipt_text(printer, "Daňový doklad dle § 29 zákona č. 235/2004 Sb.\n", strip_diacritics, encoding)
                            write_receipt_text(printer, "Dodavatel je zapsán v živnostenském rejstříku.\n", strip_diacritics, encoding)
                            write_receipt_text(printer, "Vystaveno v systému VoltFlow POS\n", strip_diacritics, encoding)

                        else:
                            # ==================== RETAIL RECEIPT LAYOUT ====================
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
                                qty = float(item.get('quantity', 1))
                                disc = item.get('discountPercent') or item.get('discount_percent') or 0
                                price = item.get('price', 0) * (1 - disc / 100)
                                tot = price * qty
                                tot_str = f"{tot:.0f} Kč"
                                name_raw = item.get('name', '')
                                unit_val = item.get('unit') or ('kg' if (item.get('is_weighted') or item.get('isWeighted')) else 'ks')
                                is_weighted = bool(item.get('is_weighted') or item.get('isWeighted') or (qty % 1 != 0) or (unit_val in ['kg', 'g']))

                                if is_weighted:
                                    printer.set(align='left', font='a', width=1, height=1, bold=bold_items)
                                    write_receipt_text(printer, f"{name_raw[:line_width]}\n", strip_diacritics, encoding)

                                    detail_line = f"  {qty:.3f} {unit_val} × {price:.2f} Kč"
                                    tot_val_str = f"{tot:.2f} Kč" if tot % 1 != 0 else f"{tot:.0f} Kč"
                                    space_w = max(1, line_width - len(detail_line) - len(tot_val_str))
                                    formatted_calc = f"{detail_line}{' ' * space_w}{tot_val_str}\n"

                                    printer.set(align='left', font='a', width=1, height=1, bold=bold_prices)
                                    write_receipt_text(printer, formatted_calc, strip_diacritics, encoding)
                                else:
                                    qty_int = int(qty)
                                    printer.set(align='left', font='a', width=1, height=1, bold=bold_items)
                                    if len(name_raw) > name_w:
                                        write_receipt_text(printer, f"{name_raw[:line_width]}\n", strip_diacritics, encoding)
                                        printer.set(align='left', font='a', width=1, height=1, bold=bold_prices)
                                        if is_58mm:
                                            printer.text(f"{'':<14} {qty_int:^4} {tot_str:>12}\n")
                                        else:
                                            printer.text(f"{'':<28} {qty_int:^5} {tot_str:>13}\n")
                                    else:
                                        if is_58mm:
                                            write_receipt_text(printer, f"{name_raw:<14}", strip_diacritics, encoding)
                                            printer.set(align='left', font='a', width=1, height=1, bold=bold_prices)
                                            printer.text(f" {qty_int:^4} {tot_str:>12}\n")
                                        else:
                                            write_receipt_text(printer, f"{name_raw:<28}", strip_diacritics, encoding)
                                            printer.set(align='left', font='a', width=1, height=1, bold=bold_prices)
                                            printer.text(f" {qty_int:^5} {tot_str:>13}\n")

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

                            # Receipt Barcode for fast refund / return scanning
                            if show_barcode and receipt_num:
                                printer.set(align='center')
                                try:
                                    if hasattr(printer, 'barcode'):
                                        printer.barcode(receipt_num, 'CODE128', height=50, width=2, pos='BELOW', align_ct=True)
                                    else:
                                        write_receipt_text(printer, f"||| {receipt_num} |||\n", strip_diacritics, encoding)
                                except Exception as bc_err:
                                    logger.debug(f"ESC/POS Barcode print note: {bc_err}")
                                    try:
                                        write_receipt_text(printer, f"||| {receipt_num} |||\n", strip_diacritics, encoding)
                                    except Exception:
                                        pass

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

    def print_cash_movement_slip(self, movement_data: dict, store_config: dict) -> dict:
        """Prints a physical 58mm/80mm thermal receipt for a cash drawer movement (Float In, Payout, Safe Drop)."""
        with _hardware_printer_lock:
            return self._do_print_cash_movement_slip(movement_data, store_config)

    def _do_print_cash_movement_slip(self, movement_data: dict, store_config: dict) -> dict:
        paper_width = str(store_config.get("printerPaperWidth", store_config.get("printer_paper_width", "80"))).upper()
        is_58mm = paper_width in ["58", "48"]
        line_width = 32 if is_58mm else 48
        separator = "=" * line_width
        dash_line = "-" * line_width

        m_type = str(movement_data.get("movement_type", "FLOAT_IN")).upper()
        amount = float(movement_data.get("amount", 0.0))
        reason = str(movement_data.get("reason", "") or "").strip()
        created_at = movement_data.get("created_at") or datetime.now().strftime("%d.%m.%Y %H:%M")
        shift_num = movement_data.get("shift_number", 1)

        type_labels = {
            "FLOAT_IN": "VKLAD DO POKLADNY",
            "PAYOUT": "VYBER Z POKLADNY (VYDAJ)",
            "SAFE_DROP": "ODVOD DO TREZORU"
        }
        type_title = type_labels.get(m_type, "POHYB HOTOVOSTI")

        logger.info(f"Printing cash movement slip ({m_type}: {amount:.2f} Kc) via {self.interface_type}")

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
                logger.info(f"Physical printer offline for cash movement slip ({conn_err}), using simulation fallback.")
                printer = None

            if printer:
                try:
                    if hasattr(printer, 'open'):
                        printer.open("VoltFlow_POS_Cash_Movement")
                    try:
                        if hasattr(printer, 'charcode'):
                            printer.charcode('CP852')
                    except Exception:
                        pass

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
                    printer.text(f"{type_title}\n")
                    printer.set(align='center', bold=False)
                    printer.text(f"Smena c.: {shift_num}   Cas: {created_at}\n")
                    printer.text(f"{dash_line}\n")

                    sign_char = "+" if m_type == "FLOAT_IN" else "-"
                    printer.set(align='center', font='a', width=2, height=2, bold=True)
                    printer.text(f"{sign_char} {amount:,.2f} Kc\n".replace(",", " "))

                    printer.set(align='left', font='a', width=1, height=1, bold=False)
                    if reason:
                        printer.text(f"Duvod: {reason}\n")
                    printer.text(f"{dash_line}\n")
                    printer.text("Podpis pokladnika:\n\n\n")
                    printer.text("...............................\n")
                    printer.text(f"{separator}\n\n\n")

                    printer.cut()
                    return {"success": True, "physical": True, "status": "PRINTED"}
                except Exception as print_err:
                    logger.warning(f"Error printing cash movement slip: {print_err}")
                finally:
                    try:
                        if hasattr(printer, 'close'):
                            printer.close()
                    except Exception:
                        pass

            # Simulation fallback
            print(separator)
            print(f"--- PHYSICAL ESC/POS CASH MOVEMENT SLIP ({type_title}) ---")
            print(f"Store: {store_config.get('storeName', 'VoltFlow POS')}")
            print(f"Amount: {amount:,.2f} Kc | Reason: {reason}")
            print(f"Shift: {shift_num} | Time: {created_at}")
            print(separator)
            return {"success": True, "physical": False, "status": "SIMULATED"}
        except Exception as e:
            logger.error(f"Failed to print cash movement slip: {e}")
            return {"success": False, "physical": False, "status": "ERROR", "error": str(e)}

    def print_z_report(self, z_report_data: dict, store_config: dict, open_drawer: bool = True) -> dict:
        """Prints official Z-Report thermal closing slip and optionally kicks open the cash drawer."""
        with _hardware_printer_lock:
            return self._do_print_z_report(z_report_data, store_config, open_drawer)

    def _do_print_z_report(self, z_report_data: dict, store_config: dict, open_drawer: bool = True) -> dict:
        paper_width = str(store_config.get("printerPaperWidth", store_config.get("printer_paper_width", "80"))).upper()
        is_58mm = paper_width in ["58", "48"]
        line_width = 32 if is_58mm else 48
        separator = "=" * line_width
        dash_line = "-" * line_width

        shift = z_report_data.get("shift", {})
        z_seq = z_report_data.get("z_seq", shift.get("z_seq", 1))
        shift_num = z_report_data.get("shift_number", shift.get("shift_number", 1))
        opened_at = shift.get("opened_at", "")
        closed_at = shift.get("closed_at", datetime.now().strftime("%d.%m.%Y %H:%M"))

        opening_cash = float(shift.get("opening_cash", 0.0))
        cash_sales = float(shift.get("total_cash_sales", 0.0))
        cash_refunds = float(shift.get("total_cash_refunds", 0.0))
        float_in = float(shift.get("float_in", 0.0))
        payouts = float(shift.get("payouts", 0.0))
        safe_drops = float(shift.get("safe_drops", 0.0))
        expected_cash = float(shift.get("expected_cash", 0.0))
        actual_cash = float(shift.get("actual_cash", 0.0))
        discrepancy = float(shift.get("discrepancy", 0.0))

        total_rev = float(z_report_data.get("total_revenue", 0.0))
        card_sales = float(z_report_data.get("card_sales", 0.0))
        qr_sales = float(z_report_data.get("qr_sales", 0.0))
        receipts_count = int(z_report_data.get("receipts_count", 0))

        logger.info(f"Printing Z-Report #{z_seq} (Shift #{shift_num}) via {self.interface_type}")

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
                logger.info(f"Physical printer offline for Z-Report ({conn_err}), using simulation fallback.")
                printer = None

            if printer:
                try:
                    if hasattr(printer, 'open'):
                        printer.open("VoltFlow_POS_Z_Report")
                    try:
                        if hasattr(printer, 'charcode'):
                            printer.charcode('CP852')
                    except Exception:
                        pass

                    printer.set(align='center', font='a', width=1, height=1)
                    printer.text(f"{store_config.get('storeName', 'VoltFlow POS')}\n")
                    if store_config.get("street"):
                        printer.text(f"{store_config.get('street')}\n")
                    if store_config.get("city"):
                        printer.text(f"{store_config.get('city')}\n")
                    if store_config.get("ico"):
                        printer.text(f"ICO: {store_config.get('ico')}\n")

                    printer.text(f"{separator}\n")
                    printer.set(align='center', font='a', width=2, height=1, bold=True)
                    printer.text("DENNI Z-UZAVERKA\n")
                    printer.set(align='center', font='a', width=1, height=1, bold=False)
                    printer.text(f"Z-Uzaverka c.: {z_seq:04d}   Smena c.: {shift_num}\n")
                    printer.text(f"Otevreno: {opened_at}\n")
                    printer.text(f"Uzavreno: {closed_at}\n")
                    printer.text(f"{separator}\n")

                    printer.set(align='center', bold=True)
                    printer.text("SOUHRN TRZEB SMENY\n")
                    printer.set(align='left', bold=False)
                    printer.text(f"Trzba celkem:       {total_rev:,.2f} Kc\n".replace(",", " "))
                    printer.text(f"Hotovost:           {cash_sales:,.2f} Kc\n".replace(",", " "))
                    printer.text(f"Platby kartou:      {card_sales:,.2f} Kc\n".replace(",", " "))
                    if qr_sales:
                        printer.text(f"QR platby:          {qr_sales:,.2f} Kc\n".replace(",", " "))
                    printer.text(f"Pocet uctenek:      {receipts_count}\n")
                    printer.text(f"{dash_line}\n")

                    printer.set(align='center', bold=True)
                    printer.text("STAV POKLADNY / ZASUVKY\n")
                    printer.set(align='left', bold=False)
                    printer.text(f"Pocatecni hotovost: {opening_cash:,.2f} Kc\n".replace(",", " "))
                    printer.text(f"Trzba hotovost (+): {cash_sales:,.2f} Kc\n".replace(",", " "))
                    printer.text(f"Vratky hotovost (-):{cash_refunds:,.2f} Kc\n".replace(",", " "))
                    printer.text(f"Vklady (+):         {float_in:,.2f} Kc\n".replace(",", " "))
                    printer.text(f"Vybery (-):         {payouts:,.2f} Kc\n".replace(",", " "))
                    printer.text(f"Odvody trezor (-):  {safe_drops:,.2f} Kc\n".replace(",", " "))
                    printer.text(f"{dash_line}\n")

                    printer.set(align='left', bold=True)
                    printer.text(f"Ocekavana hotovost: {expected_cash:,.2f} Kc\n".replace(",", " "))
                    printer.text(f"Skutecna hotovost:  {actual_cash:,.2f} Kc\n".replace(",", " "))

                    disc_label = "V PORADKU" if abs(discrepancy) < 0.01 else ("PREBYTEK" if discrepancy > 0 else "MANKO")
                    printer.text(f"Rozdil ({disc_label}): {discrepancy:,.2f} Kc\n".replace(",", " "))
                    printer.set(align='left', bold=False)
                    printer.text(f"{separator}\n")

                    notes = z_report_data.get("notes") or shift.get("notes")
                    if notes:
                        printer.text(f"Poznamka: {notes}\n{dash_line}\n")

                    printer.text("Podpis pokladnika / vedouciho:\n\n\n")
                    printer.text("...............................\n")
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
                    logger.warning(f"Error printing Z-Report: {print_err}")
                finally:
                    try:
                        if hasattr(printer, 'close'):
                            printer.close()
                    except Exception:
                        pass

            # Simulation fallback
            print(separator)
            print(f"--- PHYSICAL ESC/POS Z-REPORT #{z_seq:04d} SIMULATION ---")
            print(f"Store: {store_config.get('storeName', 'VoltFlow POS')}")
            print(f"Expected: {expected_cash:,.2f} Kc | Actual: {actual_cash:,.2f} Kc | Discrepancy: {discrepancy:,.2f} Kc")
            print(f"Total Revenue: {total_rev:,.2f} Kc | Sales count: {receipts_count}")
            if open_drawer:
                print("--- CASH DRAWER OPEN SIGNAL SIMULATED ---")
            print(separator)

            return {"success": True, "physical": False, "status": "SIMULATED"}
        except Exception as e:
            logger.error(f"Failed to print Z-Report: {e}")
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

    def print_barcode_label(self, item_data: dict, store_config: dict, copies: int = 1, validity_date: Optional[str] = None) -> dict:
        """
        Prints one or more physical ESC/POS thermal barcode shelf labels.
        Each label contains store name, item name, price, native hardware barcode, and code text.
        """
        with _hardware_printer_lock:
            return self._do_print_barcode_label(item_data, store_config, copies, validity_date)

    def _do_print_barcode_label(self, item_data: dict, store_config: dict, copies: int = 1, validity_date: Optional[str] = None) -> dict:
        copies = max(1, min(100, int(copies or 1)))
        store_name = store_config.get("storeName", store_config.get("store_name", "VoltFlow POS"))
        item_name = item_data.get("name", "Položka")
        price = float(item_data.get("price", 0.0))
        vat = item_data.get("vat", 21)
        barcode_val = str(item_data.get("barcode") or item_data.get("id") or "").strip()
        unit = item_data.get("unit") or ("kg" if (item_data.get("is_weighted") or item_data.get("isWeighted")) else "ks")
        is_weighted = bool(item_data.get("is_weighted") or item_data.get("isWeighted") or unit in ["kg", "g"])

        # Determine date of price validity: Platnost od: DD.MM.YYYY
        val_date_raw = validity_date or item_data.get("validityDate") or item_data.get("validity_date")
        if val_date_raw:
            try:
                if "." in str(val_date_raw) and len(str(val_date_raw).split(".")) == 3:
                    validity_str = str(val_date_raw).strip()
                else:
                    dt = datetime.fromisoformat(str(val_date_raw).replace("Z", "+00:00"))
                    validity_str = dt.strftime("%d.%m.%Y")
            except Exception:
                validity_str = str(val_date_raw).strip()
        else:
            validity_str = datetime.now().strftime("%d.%m.%Y")

        logger.info(f"Printing {copies} barcode label(s) for '{item_name}' (barcode: {barcode_val}) via {self.interface_type}")

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
                logger.info(f"Physical printer offline ({conn_err}), using simulation fallback.")
                printer = None

            if printer:
                try:
                    if hasattr(printer, 'open'):
                        printer.open("VoltFlow_POS_Label_Print")
                except Exception as open_err:
                    logger.warning(f"Failed to open label printer device ({open_err}), falling back to simulation.")
                    printer = None

            if printer:
                try:

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

                        # Unit and weighted price reference
                        printer.set(align='center', font='b')
                        printer.text(f"1 {unit}\n")
                        if is_weighted:
                            printer.text(f"Cena za 1 kg: {price:.2f} Kč\n")

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
                        printer.text(f"Platnost od: {validity_str}\n")
                        printer.text("\n\n")
                        printer.cut()

                    return {"success": True, "physical": True, "status": "PRINTED", "copies": copies, "validityDate": validity_str, "unit": unit, "isWeighted": is_weighted}
                finally:
                    try:
                        if hasattr(printer, 'close'):
                            printer.close()
                    except Exception:
                        pass

            sim_str = f"--- BARCODE LABEL SIMULATED: {item_name} | {price:.2f} Kč | 1 {unit}"
            if is_weighted:
                sim_str += f" | Cena za 1 kg: {price:.2f} Kč"
            sim_str += f" | Platnost od: {validity_str} | {barcode_val} (x{copies}) ---"
            print(sim_str)
            return {"success": True, "physical": False, "status": "SIMULATED", "copies": copies, "validityDate": validity_str, "unit": unit, "isWeighted": is_weighted}
        except Exception as err:
            logger.error(f"Failed to print barcode label: {err}")
            return {"success": False, "physical": False, "status": "ERROR", "error": str(err)}

    def print_write_off_protocol(self, protocol_data: dict, store_config: dict) -> dict:
        """
        Prints a formal stock write-off & liquidation protocol slip (§ 25 ZoÚ / § 77, 78 ZDPH).
        Includes protocol number, date, responsible person, reason, item table, tax deductible status,
        and employee signature line.
        """
        with _hardware_printer_lock:
            return self._do_print_write_off_protocol(protocol_data, store_config)

    def _do_print_write_off_protocol(self, protocol_data: dict, store_config: dict) -> dict:
        paper_width = str(store_config.get("printerPaperWidth", store_config.get("printer_paper_width", "80"))).upper()
        is_58mm = paper_width in ["58", "48"]
        line_width = 32 if is_58mm else 48
        name_width = 16 if is_58mm else 26

        sep_line = "-" * line_width
        double_line = "=" * line_width
        encoding = store_config.get("receiptEncoding", "CP852")
        strip_diacritics = bool(store_config.get("stripDiacritics", False))

        store_name = store_config.get("storeName") or store_config.get("store_name") or "VoltFlow POS"
        store_ico = store_config.get("ico") or ""
        protocol_num = protocol_data.get("protocol_number") or protocol_data.get("protocolNumber") or "ODP-XXXX"
        reason = protocol_data.get("reason", "EXSPIRACE")
        reason_labels = {
            "EXSPIRACE": "Exspirace (Projité zboží)",
            "ZKAZA": "Zkáza / Poškození",
            "ROZBITI": "Rozbití při manipulaci",
            "KRADEZ": "Krádež / Nezjištěné manko",
            "OTHER": "Jiné důvody"
        }
        reason_desc = reason_labels.get(reason, reason)
        person = protocol_data.get("responsible_person") or protocol_data.get("responsiblePerson") or "Obsluha pokladny"
        is_deductible = bool(protocol_data.get("is_tax_deductible", protocol_data.get("isTaxDeductible", True)))
        vat_adjust = bool(protocol_data.get("vat_adjustment_required", protocol_data.get("vatAdjustmentRequired", False)))
        total_cost = float(protocol_data.get("total_cost_value", protocol_data.get("totalCostValue", 0.0)))
        total_retail = float(protocol_data.get("total_retail_value", protocol_data.get("totalRetailValue", 0.0)))
        items = protocol_data.get("items", [])

        ts_raw = protocol_data.get("timestamp")
        try:
            if isinstance(ts_raw, str):
                ts = datetime.fromisoformat(ts_raw.replace("Z", ""))
            elif isinstance(ts_raw, datetime):
                ts = ts_raw
            else:
                ts = datetime.now()
            date_str = ts.strftime("%d.%m.%Y %H:%M")
        except Exception:
            date_str = str(ts_raw or "")

        logger.info(f"Printing write-off protocol slip {protocol_num} via {self.interface_type}")

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
            logger.info(f"Physical printer offline ({conn_err}), using simulation fallback.")
            printer = None

        if printer:
            try:
                if hasattr(printer, 'open'):
                    printer.open(f"VoltFlow_POS_WriteOff_{protocol_num}")
            except Exception as open_err:
                logger.warning(f"Failed to open printer device ({open_err}), falling back to simulation.")
                printer = None

        if printer:
            try:
                try:
                    if hasattr(printer, 'charcode'):
                        printer.charcode(encoding if encoding in ['CP852', 'CP1250'] else 'CP852')
                except Exception:
                    pass

                # Header
                printer.set(align='center', font='a', bold=True)
                write_receipt_text(printer, f"{store_name}\n", strip_diacritics, encoding)
                if store_ico:
                    printer.set(align='center', font='b')
                    write_receipt_text(printer, f"IČO: {store_ico}\n", strip_diacritics, encoding)

                printer.text(double_line + "\n")
                printer.set(align='center', bold=True, double_height=True)
                write_receipt_text(printer, "PROTOKOL O LIKVIDACI\n", strip_diacritics, encoding)
                printer.set(align='center', bold=True)
                write_receipt_text(printer, "A ODPISU ZÁSOB (§ 25 ZoÚ)\n", strip_diacritics, encoding)
                printer.set(align='center', font='a', bold=True)
                write_receipt_text(printer, f"Číslo dokladu: {protocol_num}\n", strip_diacritics, encoding)
                printer.text(sep_line + "\n")

                # Meta details
                printer.set(align='left', font='a')
                write_receipt_text(printer, f"Datum: {date_str}\n", strip_diacritics, encoding)
                write_receipt_text(printer, f"Důvod: {reason_desc}\n", strip_diacritics, encoding)
                write_receipt_text(printer, f"Odpovědná osoba: {person}\n", strip_diacritics, encoding)

                # Items table header
                printer.text(sep_line + "\n")
                if is_58mm:
                    printer.set(align='left', font='b', bold=True)
                    write_receipt_text(printer, f"{'POLOŽKA':<16}{'MN.':>6}{'CENA':>10}\n", strip_diacritics, encoding)
                else:
                    printer.set(align='left', font='a', bold=True)
                    write_receipt_text(printer, f"{'POLOŽKA':<24}{'MNOŽSTVÍ':>10}{'NÁKUP CELK.':>14}\n", strip_diacritics, encoding)
                printer.text(sep_line + "\n")

                # Items rows
                printer.set(align='left', font='b' if is_58mm else 'a')
                for it in items:
                    p_name = (it.get("preset_name") or it.get("presetName") or "Položka")[:name_width]
                    qty = float(it.get("quantity", 0))
                    unit = it.get("unit", "ks")
                    cost_tot = float(it.get("total_cost", it.get("totalCost", 0)))
                    qty_str = f"{qty:g} {unit}"
                    cost_str = f"{cost_tot:.2f} Kč"

                    if is_58mm:
                        line = f"{p_name:<16}{qty_str:>6}{cost_str:>10}\n"
                    else:
                        line = f"{p_name:<24}{qty_str:>10}{cost_str:>14}\n"
                    write_receipt_text(printer, line, strip_diacritics, encoding)

                printer.text(sep_line + "\n")

                # Totals & Accounting evaluation
                printer.set(align='left', font='a', bold=True)
                write_receipt_text(printer, f"Nákupní hodnota celkem: {total_cost:.2f} Kč\n", strip_diacritics, encoding)
                printer.set(align='left', font='b')
                write_receipt_text(printer, f"Prodejní hodnota s DPH: {total_retail:.2f} Kč\n", strip_diacritics, encoding)
                printer.text(sep_line + "\n")

                # Tax evaluation notice
                printer.set(align='left', font='a', bold=True)
                if is_deductible:
                    write_receipt_text(printer, "DAŇOVÝ REŽIM: DAŇOVĚ UZNATELNÝ\n", strip_diacritics, encoding)
                    printer.set(align='left', font='b')
                    write_receipt_text(printer, "(Přirozený úbytek v normě dle § 25 odst. 2 ZoÚ)\n", strip_diacritics, encoding)
                else:
                    write_receipt_text(printer, "DAŇOVÝ REŽIM: NEDAŇOVÝ ODPIS / MANKO\n", strip_diacritics, encoding)
                    printer.set(align='left', font='b')
                    if vat_adjust:
                        write_receipt_text(printer, "⚠️ Nutná korekce odpočtu DPH dle § 77/78 ZDPH!\n", strip_diacritics, encoding)

                printer.text(double_line + "\n")
                printer.set(align='left', font='b')
                write_receipt_text(printer, "\n\nPodpis odpovědné osoby: ........................\n\n", strip_diacritics, encoding)
                write_receipt_text(printer, "Schválil (vedoucí prodejny): ....................\n\n", strip_diacritics, encoding)

                printer.text("\n\n")
                printer.cut()

                return {
                    "success": True,
                    "physical": True,
                    "status": "PRINTED",
                    "protocol_number": protocol_num
                }
            finally:
                try:
                    if hasattr(printer, 'close'):
                        printer.close()
                except Exception:
                    pass

        # Simulation fallback
        sim_str = f"=== WRITE-OFF PROTOCOL SIMULATED: {protocol_num} | {reason_desc} | Nákup: {total_cost:.2f} Kč | Deductible: {is_deductible} ==="
        print(sim_str)
        return {
            "success": True,
            "physical": False,
            "status": "SIMULATED",
            "protocol_number": protocol_num
        }

    def print_inventory_protocol(self, protocol_data: dict, store_config: dict) -> dict:
        """
        Prints a formal physical stock inventory protocol slip (§ 29, 30 ZoÚ).
        Includes protocol number, date, responsible person, item discrepancy list,
        surplus/shortage summary, and employee signature lines.
        """
        with _hardware_printer_lock:
            return self._do_print_inventory_protocol(protocol_data, store_config)

    def _do_print_inventory_protocol(self, protocol_data: dict, store_config: dict) -> dict:
        paper_width = str(store_config.get("printerPaperWidth", store_config.get("printer_paper_width", "80"))).upper()
        is_58mm = paper_width in ["58", "48"]
        line_width = 32 if is_58mm else 48
        name_width = 16 if is_58mm else 24

        sep_line = "-" * line_width
        double_line = "=" * line_width
        encoding = store_config.get("receiptEncoding", "CP852")
        strip_diacritics = bool(store_config.get("stripDiacritics", False))

        store_name = store_config.get("storeName") or store_config.get("store_name") or "VoltFlow POS"
        store_ico = store_config.get("ico") or ""
        protocol_num = protocol_data.get("protocol_number") or protocol_data.get("protocolNumber") or "INV-XXXX"
        person = protocol_data.get("responsible_person") or protocol_data.get("responsiblePerson") or "Komise / Vedoucí prodejny"
        total_items = protocol_data.get("total_items_counted", 0)
        total_surplus = float(protocol_data.get("total_surplus_value", protocol_data.get("totalSurplusValue", 0.0)))
        total_shortage = float(protocol_data.get("total_shortage_value", protocol_data.get("totalShortageValue", 0.0)))
        net_diff = total_surplus - total_shortage
        items = protocol_data.get("items", [])

        ts_raw = protocol_data.get("timestamp")
        try:
            if isinstance(ts_raw, str):
                ts = datetime.fromisoformat(ts_raw.replace("Z", ""))
            elif isinstance(ts_raw, datetime):
                ts = ts_raw
            else:
                ts = datetime.now()
            date_str = ts.strftime("%d.%m.%Y %H:%M")
        except Exception:
            date_str = str(ts_raw or "")

        logger.info(f"Printing inventory audit protocol slip {protocol_num} via {self.interface_type}")

        printer = None
        try:
            if os.name == 'nt' and (self.interface_type in ["WIN32", "USB"] or self.address.startswith('/dev/')):
                from escpos.printer import Win32Raw
                target_name = self.address if not self.address.startswith('/dev/') else ""
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
        except Exception as e:
            logger.info(f"Printer offline ({e}), simulating inventory protocol.")
            printer = None

        if printer:
            try:
                if hasattr(printer, 'open'):
                    printer.open(f"VoltFlow_Inventory_{protocol_num}")
            except Exception:
                printer = None

        if printer:
            try:
                if hasattr(printer, 'charcode'):
                    printer.charcode(encoding if encoding in ['CP852', 'CP1250'] else 'CP852')
            except Exception:
                pass

            try:
                printer.set(align='center', font='a', width=1, height=1, bold=True)
                write_receipt_text(printer, f"{store_name}\n", strip_diacritics, encoding)
                if store_ico:
                    printer.set(align='center', font='a', width=1, height=1, bold=False)
                    write_receipt_text(printer, f"IČO: {store_ico}\n", strip_diacritics, encoding)
                write_receipt_text(printer, f"{double_line}\n", strip_diacritics, encoding)

                printer.set(align='center', font='a', width=2, height=1, bold=True)
                write_receipt_text(printer, "PROTOKOL O INVENTUŘE\n", strip_diacritics, encoding)
                printer.set(align='center', font='a', width=1, height=1, bold=False)
                write_receipt_text(printer, f"č. {protocol_num} (§ 29, 30 ZoÚ)\n", strip_diacritics, encoding)
                write_receipt_text(printer, f"{double_line}\n", strip_diacritics, encoding)

                printer.set(align='left', font='a', width=1, height=1, bold=False)
                write_receipt_text(printer, f"Datum a čas:  {date_str}\n", strip_diacritics, encoding)
                write_receipt_text(printer, f"Odpov. osoba: {person}\n", strip_diacritics, encoding)
                write_receipt_text(printer, f"Položek celk: {total_items}\n", strip_diacritics, encoding)
                write_receipt_text(printer, f"{sep_line}\n", strip_diacritics, encoding)

                for it in items:
                    p_name = it.get("preset_name") or it.get("presetName") or "Neznámá"
                    diff = float(it.get("difference", 0.0))
                    phys = float(it.get("physical_quantity", it.get("physicalQuantity", 0.0)))
                    sys_q = float(it.get("system_quantity", it.get("systemQuantity", 0.0)))
                    unit = it.get("unit", "ks")
                    cost_imp = float(it.get("total_cost_impact", it.get("totalCostImpact", 0.0)))

                    diff_str = f"+{diff:.1f}" if diff > 0 else f"{diff:.1f}"
                    printer.set(align='left', font='a', bold=True)
                    write_receipt_text(printer, f"{p_name[:name_width]}\n", strip_diacritics, encoding)
                    printer.set(align='left', font='a', bold=False)
                    line_detail = f"  Evid:{sys_q:.1f} Fyz:{phys:.1f} Diff:{diff_str}{unit} ({cost_imp:+.2f} Kc)\n"
                    write_receipt_text(printer, line_detail, strip_diacritics, encoding)

                write_receipt_text(printer, f"{sep_line}\n", strip_diacritics, encoding)
                printer.set(align='left', font='a', bold=False)
                write_receipt_text(printer, f"Celkový přebytek:  +{total_surplus:.2f} Kč\n", strip_diacritics, encoding)
                write_receipt_text(printer, f"Celkové manko:     -{total_shortage:.2f} Kč\n", strip_diacritics, encoding)
                printer.set(align='left', font='a', bold=True)
                write_receipt_text(printer, f"Čistá bilance:     {net_diff:+.2f} Kč\n", strip_diacritics, encoding)
                write_receipt_text(printer, f"{double_line}\n\n", strip_diacritics, encoding)

                write_receipt_text(printer, "Podpis odpovědné osoby: ...................\n\n", strip_diacritics, encoding)
                printer.cut()
                return {
                    "success": True,
                    "physical": True,
                    "status": "PRINTED",
                    "protocol_number": protocol_num
                }
            finally:
                try:
                    if hasattr(printer, 'close'):
                        printer.close()
                except Exception:
                    pass

        sim_str = f"=== INVENTORY PROTOCOL SIMULATED: {protocol_num} | Položek: {total_items} | Přebytek: +{total_surplus:.2f} Kč | Manko: -{total_shortage:.2f} Kč ==="
        print(sim_str)
        return {
            "success": True,
            "physical": False,
            "status": "SIMULATED",
            "protocol_number": protocol_num
        }

    def print_tax_report(self, report_type: str, report_data: dict, store_config: dict) -> dict:
        """
        Prints thermal summary of DPFO (Příloha č. 1) or VAT statement (DPH Přehled)
        on 80mm or 58mm thermal receipt paper.
        """
        with _hardware_printer_lock:
            return self._do_print_tax_report(report_type, report_data, store_config)

    def _do_print_tax_report(self, report_type: str, report_data: dict, store_config: dict) -> dict:
        paper_width = str(store_config.get("printerPaperWidth", store_config.get("printer_paper_width", "80"))).upper()
        is_58mm = paper_width in ["58", "48"]
        line_width = 32 if is_58mm else 48
        sep_line = "-" * line_width
        double_line = "=" * line_width
        encoding = store_config.get("receiptEncoding", "CP852")
        strip_diacritics = bool(store_config.get("stripDiacritics", False))

        store_name = store_config.get("storeName") or store_config.get("store_name") or "VoltFlow POS"
        store_ico = store_config.get("ico") or ""
        store_dic = store_config.get("dic") or ""
        year = report_data.get("year", datetime.now().year)

        logger.info(f"Printing tax report '{report_type}' for year {year} via {self.interface_type}")

        printer = None
        try:
            if os.name == 'nt' and (self.interface_type in ["WIN32", "USB"] or self.address.startswith('/dev/')):
                from escpos.printer import Win32Raw
                target_name = self.address if not self.address.startswith('/dev/') else ""
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
        except Exception as e:
            logger.info(f"Printer offline ({e}), simulating tax report.")
            printer = None

        if printer:
            try:
                if hasattr(printer, 'open'):
                    printer.open(f"VoltFlow_TaxReport_{report_type}_{year}")
            except Exception:
                printer = None

        if printer:
            try:
                if hasattr(printer, 'charcode'):
                    printer.charcode(encoding if encoding in ['CP852', 'CP1250'] else 'CP852')
            except Exception:
                pass

            try:
                # Store Header
                printer.set(align='center', font='a', width=1, height=1, bold=True)
                write_receipt_text(printer, f"{store_name}\n", strip_diacritics, encoding)
                id_str = f"IČO: {store_ico}" + (f"  DIČ: {store_dic}" if store_dic else "")
                if id_str.strip():
                    printer.set(align='center', font='a', width=1, height=1, bold=False)
                    write_receipt_text(printer, f"{id_str}\n", strip_diacritics, encoding)
                write_receipt_text(printer, f"{double_line}\n", strip_diacritics, encoding)

                if report_type == "dpfo":
                    # DPFO Příloha č. 1 Slip
                    printer.set(align='center', font='a', width=1, height=1, bold=True)
                    write_receipt_text(printer, "VÝKAZ PRO DPFO - PŘÍLOHA 1\n", strip_diacritics, encoding)
                    write_receipt_text(printer, f"Zdaňovací období: ROK {year}\n", strip_diacritics, encoding)
                    printer.set(align='center', font='a', width=1, height=1, bold=False)
                    write_receipt_text(printer, "Druh činnosti: Maloobchod (§ 7)\n", strip_diacritics, encoding)
                    write_receipt_text(printer, f"{double_line}\n", strip_diacritics, encoding)

                    inc = float(report_data.get("taxable_income", 0.0))
                    exp = float(report_data.get("tax_deductible_expenses", 0.0))
                    base = float(report_data.get("net_tax_base", 0.0))
                    p_inv = float(report_data.get("inventory_purchases", 0.0))
                    p_op = float(report_data.get("operating_expenses", 0.0))

                    printer.set(align='left', font='a', width=1, height=1, bold=True)
                    write_receipt_text(printer, "1. PŘÍJMY A VÝDAJE (§ 7b ZDP):\n", strip_diacritics, encoding)
                    printer.set(align='left', font='a', width=1, height=1, bold=False)
                    write_receipt_text(printer, f" Zdanitelné příjmy:  {inc:>12.2f} Kč\n", strip_diacritics, encoding)
                    write_receipt_text(printer, f" Uznatelné výdaje:   {exp:>12.2f} Kč\n", strip_diacritics, encoding)
                    if p_inv > 0:
                        write_receipt_text(printer, f"  - Nákup zásob:     {p_inv:>12.2f} Kč\n", strip_diacritics, encoding)
                    if p_op > 0:
                        write_receipt_text(printer, f"  - Provozní výdaje: {p_op:>12.2f} Kč\n", strip_diacritics, encoding)
                    write_receipt_text(printer, f"{sep_line}\n", strip_diacritics, encoding)
                    printer.set(align='left', font='a', width=1, height=1, bold=True)
                    write_receipt_text(printer, f" DÍLČÍ ZÁKLAD DANĚ:  {base:>12.2f} Kč\n", strip_diacritics, encoding)
                    write_receipt_text(printer, f"{sep_line}\n", strip_diacritics, encoding)

                    # Table D Inventory Rollback
                    b_inv = float(report_data.get("beginning_inventory", 0.0))
                    e_inv = float(report_data.get("ending_inventory", 0.0))
                    c_inv = float(report_data.get("inventory_change", 0.0))
                    w_inv = float(report_data.get("inventory_write_offs", 0.0))

                    write_receipt_text(printer, "2. TABULKA D - ZÁSOBY (§ 7b/1):\n", strip_diacritics, encoding)
                    printer.set(align='left', font='a', width=1, height=1, bold=False)
                    write_receipt_text(printer, f" Stav k 1.1.{year}:    {b_inv:>12.2f} Kč\n", strip_diacritics, encoding)
                    write_receipt_text(printer, f" Stav k 31.12.{year}:  {e_inv:>12.2f} Kč\n", strip_diacritics, encoding)
                    write_receipt_text(printer, f" Změna stavu zásob:  {c_inv:>+12.2f} Kč\n", strip_diacritics, encoding)
                    if w_inv > 0:
                        write_receipt_text(printer, f" Manka a škody:      {w_inv:>12.2f} Kč\n", strip_diacritics, encoding)

                else:
                    # VAT Overview Slip
                    period = report_data.get("period", "FULL_YEAR")
                    printer.set(align='center', font='a', width=1, height=1, bold=True)
                    write_receipt_text(printer, "PŘEHLED DPH (DPH PŘIZNÁNÍ)\n", strip_diacritics, encoding)
                    write_receipt_text(printer, f"Období: {period} / Rok {year}\n", strip_diacritics, encoding)
                    write_receipt_text(printer, f"{double_line}\n", strip_diacritics, encoding)

                    out_vat = report_data.get("output_vat", {})
                    in_vat = report_data.get("input_vat", {})
                    net_liab = float(report_data.get("net_vat_liability", 0.0))

                    r21 = out_vat.get("rate_21", {})
                    r12 = out_vat.get("rate_12", {})
                    r0 = out_vat.get("rate_0", {})
                    tot_out = float(out_vat.get("total_output_tax", 0.0))
                    tot_in = float(in_vat.get("total_input_tax", 0.0))

                    printer.set(align='left', font='a', width=1, height=1, bold=True)
                    write_receipt_text(printer, "1. DAŇ NA VÝSTUPU (TRŽBY):\n", strip_diacritics, encoding)
                    printer.set(align='left', font='a', width=1, height=1, bold=False)
                    write_receipt_text(printer, f" Základ 21%: {float(r21.get('base', 0)):>9.2f} | Daň: {float(r21.get('tax', 0)):>8.2f}\n", strip_diacritics, encoding)
                    write_receipt_text(printer, f" Základ 12%: {float(r12.get('base', 0)):>9.2f} | Daň: {float(r12.get('tax', 0)):>8.2f}\n", strip_diacritics, encoding)
                    if float(r0.get('base', 0)) > 0:
                        write_receipt_text(printer, f" Osvobozeno 0%:       {float(r0.get('base', 0)):>12.2f} Kč\n", strip_diacritics, encoding)
                    write_receipt_text(printer, f"{sep_line}\n", strip_diacritics, encoding)
                    printer.set(align='left', font='a', width=1, height=1, bold=True)
                    write_receipt_text(printer, f" CELKEM VÝSTUP:      {tot_out:>12.2f} Kč\n", strip_diacritics, encoding)
                    write_receipt_text(printer, f"{sep_line}\n", strip_diacritics, encoding)

                    write_receipt_text(printer, "2. ODPOČET NA VSTUPU (NÁKUPY):\n", strip_diacritics, encoding)
                    printer.set(align='left', font='a', width=1, height=1, bold=False)
                    write_receipt_text(printer, f" Uplatněný odpočet:  {tot_in:>12.2f} Kč\n", strip_diacritics, encoding)
                    write_receipt_text(printer, f"{double_line}\n", strip_diacritics, encoding)

                    printer.set(align='left', font='a', width=1, height=1, bold=True)
                    liab_label = "VLASTNÍ DAŇOVÁ POVINNOST:" if net_liab >= 0 else "NADMĚRNÝ ODPOČET:"
                    write_receipt_text(printer, f"{liab_label}\n", strip_diacritics, encoding)
                    write_receipt_text(printer, f"  {abs(net_liab):>18.2f} Kč\n", strip_diacritics, encoding)

                write_receipt_text(printer, f"{double_line}\n", strip_diacritics, encoding)
                printer.set(align='center', font='a', width=1, height=1, bold=False)
                now_str = datetime.now().strftime("%d.%m.%Y %H:%M:%S")
                write_receipt_text(printer, f"Vystaveno: {now_str}\n", strip_diacritics, encoding)
                write_receipt_text(printer, "Podpis / razítko: .................\n\n", strip_diacritics, encoding)
                printer.cut()
                return {
                    "success": True,
                    "physical": True,
                    "status": "PRINTED",
                    "report_type": report_type,
                    "year": year
                }
            finally:
                try:
                    if hasattr(printer, 'close'):
                        printer.close()
                except Exception:
                    pass

        sim_str = f"=== TAX REPORT SIMULATED ({report_type.upper()}) | Rok: {year} ==="
        print(sim_str)
        return {
            "success": True,
            "physical": False,
            "status": "SIMULATED",
            "report_type": report_type,
            "year": year
        }


