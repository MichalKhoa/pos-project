"""
VoltFlow POS — Cloud Vision OCR Fallback for Scanned Invoices & Photos
Calls remote Gemini Flash / OpenRouter Vision API.
Zero local AI/OCR runtime on Home Server (<1% CPU, <60MB RAM invariant).
"""

import os
import json
import base64
import logging
from typing import Dict, Any, Optional

import requests

logger = logging.getLogger(__name__)

OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY", "")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

INVOICE_EXTRACTION_PROMPT = """
You are an expert Czech accounting assistant. Extract supplier invoice fields from this receipt/invoice photo into valid JSON.
Format MUST strictly match this JSON schema:
{
  "document_id": "Invoice number or Receipt ID",
  "issue_date": "YYYY-MM-DD",
  "due_date": "YYYY-MM-DD",
  "supplier": {
    "name": "Supplier company name",
    "ico": "Czech IČO (8 digits)",
    "dic": "Czech DIČ (e.g. CZ12345678)",
    "address": "Supplier street and city"
  },
  "items": [
    {
      "name": "Product name",
      "ean": "Barcode if visible, else empty string",
      "quantity": 1.0,
      "unit_price_ex_vat": 10.0,
      "unit_price_inc_vat": 12.1,
      "vat_rate": 21.0,
      "total_ex_vat": 10.0
    }
  ],
  "total_ex_vat": 100.0,
  "total_inc_vat": 121.0,
  "payable_amount": 121.0
}
Return ONLY valid raw JSON, without markdown fences or additional commentary.
"""


def parse_invoice_with_vision(image_bytes: bytes, mime_type: str = "image/jpeg") -> Dict[str, Any]:
    """
    Parses an invoice image using Gemini Flash or OpenRouter Vision.
    If no API key is set, returns a structured fallback draft.
    """
    b64_img = base64.b64encode(image_bytes).decode("utf-8")

    # 1. Try Gemini API directly if key is present
    if GEMINI_API_KEY:
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={GEMINI_API_KEY}"
            payload = {
                "contents": [
                    {
                        "parts": [
                            {"text": INVOICE_EXTRACTION_PROMPT},
                            {
                                "inline_data": {
                                    "mime_type": mime_type,
                                    "data": b64_img
                                }
                            }
                        ]
                    }
                ],
                "generationConfig": {
                    "response_mime_type": "application/json"
                }
            }
            res = requests.post(url, json=payload, timeout=30)
            if res.status_code == 200:
                data = res.json()
                text = data["candidates"][0]["content"]["parts"][0]["text"]
                parsed = json.loads(text)
                parsed["source"] = "OCR_GEMINI"
                return parsed
            else:
                logger.warning(f"Gemini Vision API returned status {res.status_code}: {res.text}")
        except Exception as e:
            logger.error(f"Gemini Vision API error: {e}")

    # 2. Try OpenRouter Vision API if key is present
    if OPENROUTER_API_KEY:
        try:
            url = "https://openrouter.ai/api/v1/chat/completions"
            headers = {
                "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                "Content-Type": "application/json"
            }
            payload = {
                "model": "google/gemini-2.0-flash-001",
                "messages": [
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": INVOICE_EXTRACTION_PROMPT},
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:{mime_type};base64,{b64_img}"
                                }
                            }
                        ]
                    }
                ],
                "response_format": {"type": "json_object"}
            }
            res = requests.post(url, headers=headers, json=payload, timeout=30)
            if res.status_code == 200:
                data = res.json()
                content = data["choices"][0]["message"]["content"]
                parsed = json.loads(content)
                parsed["source"] = "OCR_OPENROUTER"
                return parsed
            else:
                logger.warning(f"OpenRouter API returned status {res.status_code}: {res.text}")
        except Exception as e:
            logger.error(f"OpenRouter Vision API error: {e}")

    # 3. Fallback mock / offline response if no remote API key is configured
    return {
        "source": "OCR_FALLBACK",
        "document_id": "OCR-SCAN-DRAFT",
        "issue_date": "",
        "due_date": "",
        "supplier": {
            "name": "Nerozpoznaný dodavatel (z fotky)",
            "ico": "",
            "dic": "",
            "address": ""
        },
        "customer": {
            "name": "",
            "ico": "",
            "dic": ""
        },
        "items": [
            {
                "line_id": "1",
                "name": "Naskenovaná položka k revizi",
                "ean": "",
                "quantity": 1.0,
                "unit_price_ex_vat": 0.0,
                "unit_price_inc_vat": 0.0,
                "vat_rate": 21.0,
                "total_ex_vat": 0.0,
                "retail_price": 0.0
            }
        ],
        "total_ex_vat": 0.0,
        "total_inc_vat": 0.0,
        "payable_amount": 0.0,
        "note": "Žádný Vision API klíč nebyl nalezen (OPENROUTER_API_KEY / GEMINI_API_KEY). Vytvořen koncept k ručnímu vyplnění."
    }
