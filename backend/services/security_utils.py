import os
import base64
import hashlib
import logging
from datetime import datetime, timezone
from cryptography.fernet import Fernet

logger = logging.getLogger(__name__)
SECRET_KEY_FILE = ".secret_key"


def _get_fernet_key() -> bytes:
    """Derive Fernet 32-byte key from APP_SECRET_KEY env var or auto-generated persistent key file."""
    secret = os.getenv("APP_SECRET_KEY")
    if not secret:
        if os.path.exists(SECRET_KEY_FILE):
            try:
                with open(SECRET_KEY_FILE, "r", encoding="utf-8") as f:
                    secret = f.read().strip()
            except Exception as e:
                logger.error(f"Failed to read {SECRET_KEY_FILE}: {e}")

        if not secret:
            secret = base64.b64encode(os.urandom(32)).decode("utf-8")
            try:
                with open(SECRET_KEY_FILE, "w", encoding="utf-8") as f:
                    f.write(secret)
                try:
                    os.chmod(SECRET_KEY_FILE, 0o600)
                except Exception:
                    pass
                logger.info(f"Generated new persistent secret key in {SECRET_KEY_FILE}")
            except Exception as e:
                logger.error(f"Failed to persist secret key to {SECRET_KEY_FILE}: {e}")

    key_32 = hashlib.sha256(secret.encode("utf-8")).digest()
    return base64.urlsafe_b64encode(key_32)


def encrypt_secret(plain_text: str) -> str:
    """Encrypts plain text string using Fernet symmetric encryption."""
    if not plain_text:
        return ""
    try:
        f = Fernet(_get_fernet_key())
        return f.encrypt(plain_text.encode("utf-8")).decode("utf-8")
    except Exception as e:
        logger.error(f"Encryption failed: {e}")
        return plain_text


def decrypt_secret(cipher_text: str) -> str:
    """Decrypts cipher text string; falls back to raw string with warning if unencrypted."""
    if not cipher_text:
        return ""
    try:
        f = Fernet(_get_fernet_key())
        return f.decrypt(cipher_text.encode("utf-8")).decode("utf-8")
    except Exception as e:
        logger.warning(f"Decryption failed for secret, returning raw string fallback: {e}")
        return cipher_text


def get_czech_now():
    """Returns current datetime in Czech Republic timezone (Europe/Prague)."""
    try:
        from zoneinfo import ZoneInfo
        return datetime.now(ZoneInfo("Europe/Prague"))
    except Exception:
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
        try:
            return round(float(value), 2)
        except Exception:
            return 0.0


