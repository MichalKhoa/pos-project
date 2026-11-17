"""Shared PIN, master-key and recovery-code checks.

There is no built-in PIN, PUK or master key. A stored PIN equal to the old factory
default 1234 counts as "no PIN set". The master key works only when the machine's
environment sets POS_MASTER_ADMIN_KEY to at least 16 characters.
"""
import hashlib
import hmac
import os
import secrets
from typing import Optional

from fastapi import HTTPException, Request, status

from services.rate_limiter import pin_rate_limiter

LEGACY_DEFAULT_PIN = "1234"
MASTER_KEY_ENV = "POS_MASTER_ADMIN_KEY"
MASTER_KEY_MIN_LENGTH = 16
# No 0/O or 1/I, so the code is easy to read back from paper.
RECOVERY_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def hash_secret(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def is_hashed(value: Optional[str]) -> bool:
    return bool(value) and len(value) == 64 and all(c in "0123456789abcdef" for c in value)


def pin_is_set(stored: Optional[str]) -> bool:
    return bool(stored) and stored not in (LEGACY_DEFAULT_PIN, hash_secret(LEGACY_DEFAULT_PIN))


def stored_pin_hash(stored: Optional[str]) -> Optional[str]:
    """Hash form of a stored PIN (legacy rows may hold plaintext), or None when unset."""
    if not pin_is_set(stored):
        return None
    return stored if is_hashed(stored) else hash_secret(stored)


def pin_matches(pin: Optional[str], stored: Optional[str]) -> bool:
    expected = stored_pin_hash(stored)
    if not pin or expected is None:
        return False
    return hmac.compare_digest(hash_secret(pin), expected)


def valid_new_pin(pin: str) -> bool:
    return pin.isdigit() and 4 <= len(pin) <= 8 and pin != LEGACY_DEFAULT_PIN


def master_key_matches(value: Optional[str]) -> bool:
    key = os.getenv(MASTER_KEY_ENV, "")
    if len(key) < MASTER_KEY_MIN_LENGTH or not value:
        return False
    return hmac.compare_digest(value.strip().encode("utf-8"), key.encode("utf-8"))


def lock_screen_enabled(config) -> bool:
    return bool(config and config.lock_screen_enabled and pin_is_set(config.cashier_pin))


def admin_pin_enabled(config) -> bool:
    return bool(config and config.admin_pin_enabled and pin_is_set(config.admin_pin))


def new_recovery_code() -> str:
    chars = "".join(secrets.choice(RECOVERY_ALPHABET) for _ in range(16))
    return "-".join(chars[i:i + 4] for i in range(0, 16, 4))


def recovery_code_hash(code: str) -> str:
    """Hash of the code ignoring case, spaces and dashes."""
    return hash_secret("".join(c for c in code.upper() if c.isalnum()))


def recovery_code_matches(code: Optional[str], stored_hash: Optional[str]) -> bool:
    if not code or not stored_hash:
        return False
    return hmac.compare_digest(recovery_code_hash(code), stored_hash)


def client_ip(request: Request) -> str:
    return request.client.host if request.client else "127.0.0.1"


def require_admin_pin(request: Request, config, pin: Optional[str], detail: str) -> None:
    """Pass when the Admin PIN switch is off; otherwise demand the Admin PIN or master key."""
    if not admin_pin_enabled(config):
        return
    ip = client_ip(request)
    pin_rate_limiter.check_rate_limit(ip)
    if master_key_matches(pin) or pin_matches(pin, config.admin_pin):
        return
    pin_rate_limiter.record_failed_attempt(ip)
    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=detail)


if __name__ == "__main__":
    assert not pin_is_set(None) and not pin_is_set("1234") and not pin_is_set(hash_secret("1234"))
    assert pin_matches("5678", hash_secret("5678")) and pin_matches("5678", "5678")
    assert not pin_matches("1234", "1234") and not pin_matches("", hash_secret("5678"))
    assert not valid_new_pin("1234") and not valid_new_pin("12a4") and valid_new_pin("2580")
    code = new_recovery_code()
    assert recovery_code_matches(code.replace("-", "").lower(), recovery_code_hash(code))
    os.environ[MASTER_KEY_ENV] = "short"
    assert not master_key_matches("short")
    print("pin_auth self-check OK")
