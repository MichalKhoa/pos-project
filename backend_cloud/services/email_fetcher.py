"""
VoltFlow POS — Automated Email IMAP Poller for Supplier Invoices
Polls designated mailbox (e.g. faktury@obchod.cz) over TLS.
Parses .isdoc/.isdocx attachments via isdoc_parser, and image/PDF attachments via ocr_service.
"""

import os
import io
import email
from email import policy
import imaplib
import logging
from typing import List, Dict, Any, Optional

from services.isdoc_parser import parse_isdoc_bytes
from services.ocr_service import parse_invoice_with_vision

logger = logging.getLogger(__name__)

IMAP_HOST = os.getenv("POS_IMAP_HOST", "")
IMAP_PORT = int(os.getenv("POS_IMAP_PORT", "993"))
IMAP_USER = os.getenv("POS_IMAP_USER", "")
IMAP_PASSWORD = os.getenv("POS_IMAP_PASSWORD", "")
IMAP_MAILBOX = os.getenv("POS_IMAP_MAILBOX", "INBOX")


def extract_attachments_from_email_bytes(raw_bytes: bytes) -> List[Dict[str, Any]]:
    """
    Parses an RFC822 email payload and extracts attachments.
    Returns list of {'filename': str, 'content_type': str, 'data': bytes, 'subject': str, 'sender': str}.
    """
    msg = email.message_from_bytes(raw_bytes, policy=policy.default)
    attachments = []
    subject = msg.get("Subject", "")
    sender = msg.get("From", "")

    for part in msg.walk():
        if part.is_multipart():
            continue

        filename = part.get_filename()
        content_type = part.get_content_type()
        
        # If it's an attachment or has a known invoice extension
        if filename or content_type in ["application/pdf", "application/xml", "image/jpeg", "image/png"]:
            data = part.get_payload(decode=True)
            if data:
                attachments.append({
                    "filename": filename or "unknown_attachment",
                    "content_type": content_type,
                    "data": data,
                    "subject": subject,
                    "sender": sender,
                })

    return attachments


def process_attachment(filename: str, content_type: str, data: bytes) -> Optional[Dict[str, Any]]:
    """
    Routes attachment to either ISDOC XML parser or OCR Vision parser.
    """
    lower_name = filename.lower()
    
    # 1. ISDOC XML / ISDOCX Archive
    if lower_name.endswith((".isdoc", ".isdocx")) or (lower_name.endswith(".xml") and b"isdoc" in data[:500].lower()):
        try:
            parsed = parse_isdoc_bytes(data)
            parsed["filename"] = filename
            return parsed
        except Exception as e:
            logger.warning(f"Failed to parse ISDOC attachment '{filename}': {e}")
            return None

    # 2. Image / PDF scan fallback
    is_image = lower_name.endswith((".jpg", ".jpeg", ".png", ".webp")) or "image" in content_type
    is_pdf = lower_name.endswith(".pdf") or "pdf" in content_type

    if is_image or is_pdf:
        mime = content_type if content_type else ("application/pdf" if is_pdf else "image/jpeg")
        try:
            parsed = parse_invoice_with_vision(data, mime_type=mime)
            parsed["filename"] = filename
            return parsed
        except Exception as e:
            logger.warning(f"Failed to parse OCR attachment '{filename}': {e}")
            return None

    return None


class EmailInvoiceFetcher:
    def __init__(
        self,
        host: str = IMAP_HOST,
        port: int = IMAP_PORT,
        user: str = IMAP_USER,
        password: str = IMAP_PASSWORD,
        mailbox: str = IMAP_MAILBOX,
    ):
        self.host = host
        self.port = port
        self.user = user
        self.password = password
        self.mailbox = mailbox

    def poll_invoices(self, mark_seen: bool = True) -> List[Dict[str, Any]]:
        """
        Connects to IMAP server, checks for UNSEEN messages, extracts and parses invoice attachments.
        """
        if not self.host or not self.user:
            logger.info("IMAP credentials not configured. Skipping automated email poll.")
            return []

        results = []
        try:
            mail = imaplib.IMAP4_SSL(self.host, self.port)
            mail.login(self.user, self.password)
            mail.select(self.mailbox)

            status, search_data = mail.search(None, "UNSEEN")
            if status != "OK" or not search_data[0]:
                mail.logout()
                return []

            msg_ids = search_data[0].split()
            for msg_id in msg_ids:
                res, data = mail.fetch(msg_id, "(RFC822)")
                if res != "OK":
                    continue

                raw_email = data[0][1]
                attachments = extract_attachments_from_email_bytes(raw_email)
                
                for att in attachments:
                    parsed_invoice = process_attachment(
                        filename=att["filename"],
                        content_type=att["content_type"],
                        data=att["data"]
                    )
                    if parsed_invoice:
                        parsed_invoice["email_sender"] = att["sender"]
                        parsed_invoice["email_subject"] = att["subject"]
                        results.append(parsed_invoice)

                if mark_seen:
                    mail.store(msg_id, "+FLAGS", "\\Seen")

            mail.close()
            mail.logout()
        except Exception as e:
            logger.error(f"Error while polling IMAP server: {e}")

        return results
