import os
import base64
import hashlib
from cryptography.fernet import Fernet


def _get_fernet_key() -> bytes:
    """Derive Fernet 32-byte key from APP_SECRET_KEY env var or stable fallback key."""
    secret = os.getenv("APP_SECRET_KEY", "himmel-pos-eet-secure-seed-v1")
    key_32 = hashlib.sha256(secret.encode("utf-8")).digest()
    return base64.urlsafe_b64encode(key_32)


def encrypt_secret(plain_text: str) -> str:
    """Encrypts plain text string using Fernet symmetric encryption."""
    if not plain_text:
        return ""
    try:
        f = Fernet(_get_fernet_key())
        return f.encrypt(plain_text.encode("utf-8")).decode("utf-8")
    except Exception:
        return plain_text


def decrypt_secret(cipher_text: str) -> str:
    """Decrypts cipher text string; falls back to raw string if unencrypted."""
    if not cipher_text:
        return ""
    try:
        f = Fernet(_get_fernet_key())
        return f.decrypt(cipher_text.encode("utf-8")).decode("utf-8")
    except Exception:
        # Backward compatibility for legacy unencrypted database entries
        return cipher_text


def get_czech_now():
    """Returns current datetime in Czech Republic timezone (Europe/Prague)."""
    try:
        from zoneinfo import ZoneInfo
        return datetime.now(ZoneInfo("Europe/Prague"))
    except Exception:
        from datetime import datetime, timezone
        return datetime.now(timezone.utc)


def parse_iso_timestamp(ts_str: str):
    """
    Safely parses ISO timestamp string into datetime object.
    Falls back to current Czech local time if parsing fails or input is missing.
    """
    from datetime import datetime
    if not ts_str or not isinstance(ts_str, str):
        return get_czech_now()

    try:
        # Normalize ISO Z suffix
        clean_ts = ts_str.replace("Z", "+00:00")
        dt = datetime.fromisoformat(clean_ts)
        # Convert naive datetime to Czech local time
        if dt.tzinfo is None:
            try:
                from zoneinfo import ZoneInfo
                dt = dt.replace(tzinfo=ZoneInfo("Europe/Prague"))
            except Exception:
                pass
        return dt
    except Exception:
        return get_czech_now()


def round_currency(value: float) -> float:
    """
    Safely rounds monetary values to exactly 2 decimal places using Decimal ROUND_HALF_UP.
    Eliminates binary floating-point inaccuracies (e.g., 0.1 + 0.2 = 0.30000000000000004).
    """
    if value is None:
        return 0.0
    try:
        from decimal import Decimal, ROUND_HALF_UP
        d = Decimal(str(value))
        return float(d.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))
    except Exception:
        return round(float(value), 2)


