"""Test helper: switch the Admin PIN on in whatever database SessionLocal points at.

There is no default PIN any more, so tests of PIN-protected endpoints set one here.
The previous PIN settings are restored afterwards.
"""
import os
import sys
from contextlib import contextmanager

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from database import SessionLocal
from models import StoreConfigModel
from services.pin_auth import hash_secret
from services.rate_limiter import pin_rate_limiter

TEST_ADMIN_PIN = "2580"


@contextmanager
def admin_pin_on(pin: str = TEST_ADMIN_PIN):
    db = SessionLocal()
    try:
        config = db.query(StoreConfigModel).first()
        if not config:
            config = StoreConfigModel(id=1)
            db.add(config)
        saved = (config.admin_pin, config.admin_pin_enabled)
        config.admin_pin = hash_secret(pin)
        config.admin_pin_enabled = True
        db.commit()
        pin_rate_limiter.attempts.clear()
    finally:
        db.close()
    try:
        yield pin
    finally:
        # Fresh session: a test may have replaced the database file (restore tests).
        db = SessionLocal()
        try:
            config = db.query(StoreConfigModel).first()
            if config:
                config.admin_pin, config.admin_pin_enabled = saved
                db.commit()
        finally:
            db.close()
        pin_rate_limiter.attempts.clear()


def use_admin_pin(test_case, pin: str = TEST_ADMIN_PIN) -> str:
    """unittest helper: Admin PIN on for one test, restored when the test ends."""
    return test_case.enterContext(admin_pin_on(pin))
