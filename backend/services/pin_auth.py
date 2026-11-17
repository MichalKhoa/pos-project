"""Shared PIN, master-key and recovery-code checks.

There is no built-in PIN, PUK or master key. A stored PIN equal to the old factory
default 1234 counts as "no PIN set". The master key works only when the machine's
environment sets POS_MASTER_ADMIN_KEY to at least 16 characters.

New PINs are stored salted (scrypt). Older plain SHA-256 hashes and plaintext values
still verify and are rewritten in the new format on the next successful entry.
The recovery code stays plain SHA-256: it has 80 bits of randomness, so a salt adds nothing.
"""
import hashlib
import hmac
import os
import secrets
from typing import Optional

from fastapi import HTTPException, Request, status
from sqlalchemy.orm import object_session

from services.rate_limiter import pin_rate_limiter

LEGACY_DEFAULT_PIN = "1234"
MASTER_KEY_ENV = "POS_MASTER_ADMIN_KEY"
MASTER_KEY_MIN_LENGTH = 16
# No 0/O or 1/I, so the code is easy to read back from paper.
RECOVERY_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


def hash_secret(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


SALTED_PREFIX = "scrypt$"


def _scrypt(value: str, salt: bytes) -> bytes:
    return hashlib.scrypt(value.encode("utf-8"), salt=salt, n=2 ** 14, r=8, p=1, dklen=32)


def hash_pin(value: str) -> str:
    """Salted hash for storing a new PIN: scrypt$<salt hex>$<hash hex>."""
    salt = os.urandom(16)
    return f"{SALTED_PREFIX}{salt.hex()}${_scrypt(value, salt).hex()}"


def is_salted(value: Optional[str]) -> bool:
    return bool(value) and value.startswith(SALTED_PREFIX)


def _is_sha256_hex(value: Optional[str]) -> bool:
    return bool(value) and len(value) == 64 and all(c in "0123456789abcdef" for c in value)


def is_hashed(value: Optional[str]) -> bool:
    return is_salted(value) or _is_sha256_hex(value)


def pin_is_set(stored: Optional[str]) -> bool:
    return bool(stored) and stored not in (LEGACY_DEFAULT_PIN, hash_secret(LEGACY_DEFAULT_PIN))


def stored_pin_hash(stored: Optional[str]) -> Optional[str]:
    """Hash form of a stored PIN (legacy rows may hold plaintext), or None when unset."""
    if not pin_is_set(stored):
        return None
    return stored if is_hashed(stored) else hash_secret(stored)


def pin_matches(pin: Optional[str], stored: Optional[str]) -> bool:
    if not pin or not pin_is_set(stored):
        return False
    if is_salted(stored):
        try:
            _, salt_hex, hash_hex = stored.split("$")
            expected = bytes.fromhex(hash_hex)
            return hmac.compare_digest(_scrypt(pin, bytes.fromhex(salt_hex)), expected)
        except ValueError:
            return False
    if _is_sha256_hex(stored):
        return hmac.compare_digest(hash_secret(pin), stored)
    return hmac.compare_digest(pin.encode("utf-8"), stored.encode("utf-8"))  # legacy plaintext


def verify_pin_column(pin: Optional[str], config, column: str) -> bool:
    """Check a PIN against config.<column> (cashier_pin or admin_pin).

    On success an old-format value is rewritten salted and an unknown PIN length is learned,
    so later entries can auto-submit at the right length.
    """
    stored = getattr(config, column, None) if config else None
    if not pin_matches(pin, stored):
        return False
    changed = False
    if not is_salted(stored):
        setattr(config, column, hash_pin(pin))
        changed = True
    length_column = f"{column}_length"
    if getattr(config, length_column, None) is None:
        setattr(config, length_column, len(pin))
        changed = True
    if changed:
        session = object_session(config)
        if session is not None:
            session.commit()
    return True


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


def apply_security_settings(config, cashier_pin=None, admin_pin=None, lock_screen=None, admin_switch=None) -> Optional[str]:
    """Set PINs and lock switches on a store_config row. The caller commits.

    Shared by POST /config and the standalone settings app so the rules cannot drift apart.
    Raises ValueError (Czech message) for a bad PIN or a switch whose PIN is not set. The first
    PIN ever set also creates a recovery code; its plain text is returned once, only a hash is kept.
    """
    if cashier_pin is not None:
        if not valid_new_pin(cashier_pin):
            raise ValueError("PIN kód musí mít 4 až 8 číslic a nesmí být 1234.")
        config.cashier_pin = hash_pin(cashier_pin)
        config.cashier_pin_length = len(cashier_pin)
    if admin_pin is not None:
        if not valid_new_pin(admin_pin):
            raise ValueError("Admin PIN kód musí mít 4 až 8 číslic a nesmí být 1234.")
        config.admin_pin = hash_pin(admin_pin)
        config.admin_pin_length = len(admin_pin)
    if lock_screen is not None:
        if lock_screen and not pin_is_set(config.cashier_pin):
            raise ValueError("Nejprve nastavte PIN obsluhy.")
        config.lock_screen_enabled = lock_screen
    if admin_switch is not None:
        if admin_switch and not pin_is_set(config.admin_pin):
            raise ValueError("Nejprve nastavte Admin PIN.")
        config.admin_pin_enabled = admin_switch
    if (cashier_pin is not None or admin_pin is not None) and not config.recovery_code_hash:
        code = new_recovery_code()
        config.recovery_code_hash = recovery_code_hash(code)
        return code
    return None


def client_ip(request: Request) -> str:
    return request.client.host if request.client else "127.0.0.1"


def require_admin_pin(request: Request, config, pin: Optional[str], detail: str) -> None:
    """Pass when the Admin PIN switch is off; otherwise demand the Admin PIN or master key."""
    if not admin_pin_enabled(config):
        return
    ip = client_ip(request)
    pin_rate_limiter.check_rate_limit(ip)
    if master_key_matches(pin) or verify_pin_column(pin, config, "admin_pin"):
        return
    pin_rate_limiter.record_failed_attempt(ip)
    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=detail)


if __name__ == "__main__":
    assert not pin_is_set(None) and not pin_is_set("1234") and not pin_is_set(hash_secret("1234"))
    assert pin_matches("5678", hash_secret("5678")) and pin_matches("5678", "5678")
    salted = hash_pin("5678")
    assert is_salted(salted) and pin_matches("5678", salted) and not pin_matches("5679", salted)
    assert hash_pin("5678") != salted
    assert not pin_matches("1234", "1234") and not pin_matches("", hash_secret("5678"))
    assert not valid_new_pin("1234") and not valid_new_pin("12a4") and valid_new_pin("2580")
    code = new_recovery_code()
    assert recovery_code_matches(code.replace("-", "").lower(), recovery_code_hash(code))
    os.environ[MASTER_KEY_ENV] = "short"
    assert not master_key_matches("short")
    print("pin_auth self-check OK")
