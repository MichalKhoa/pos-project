"""PIN locks (Batch G): two switches, no built-in default PIN, PUK or master key.

Covers the stored-settings migration, the config API, PIN verification, the
recovery code and the server-side PIN checks on technician and sale-delete endpoints.
"""
import os
import re
import sys
import tempfile
import shutil
import unittest
from unittest.mock import patch

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from database import Base, SessionLocal
from models import StoreConfigModel
from services.pin_auth import hash_secret
from services.rate_limiter import pin_rate_limiter
from migrations import migrate_pin_settings, run_schema_migrations
from tests.temp_db import TempDbTestCase

RECOVERY_CODE_RE = re.compile(r"^[A-Z2-9]{4}(-[A-Z2-9]{4}){3}$")
ADMIN_PIN = "2580"
CASHIER_PIN = "1470"
SUPPORT_KEY = "support-key-0123456789"


class TestPinSettingsMigration(unittest.TestCase):
    """Existing installs: a default 1234 counts as no PIN; a chosen PIN keeps its lock on."""

    def setUp(self):
        self.tmp = tempfile.mkdtemp(prefix="pos_pin_mig_")
        self.engine = create_engine(f"sqlite:///{os.path.join(self.tmp, 'm.db')}")
        Base.metadata.create_all(bind=self.engine)
        self.Session = sessionmaker(bind=self.engine)

    def tearDown(self):
        self.engine.dispose()
        shutil.rmtree(self.tmp, ignore_errors=True)

    def _row(self, **cols):
        db = self.Session()
        db.add(StoreConfigModel(id=1, pin_policy_version=0, **cols))
        db.commit()
        db.close()

    def _read(self):
        db = self.Session()
        row = db.query(StoreConfigModel).first()
        out = (row.cashier_pin, row.admin_pin, row.lock_screen_enabled, row.admin_pin_enabled, row.pin_policy_version)
        db.close()
        return out

    def test_default_pins_become_unset_and_locks_off(self):
        self._row(cashier_pin="1234", admin_pin=hash_secret("1234"))
        migrate_pin_settings(self.engine)
        self.assertEqual(self._read(), (None, None, False, False, 1))

    def test_chosen_cashier_pin_is_copied_to_admin_and_both_locks_stay_on(self):
        # The old "Change Admin PIN" button saved into cashier_pin.
        self._row(cashier_pin=hash_secret("5678"), admin_pin="1234")
        migrate_pin_settings(self.engine)
        self.assertEqual(self._read(), (hash_secret("5678"), hash_secret("5678"), True, True, 1))

    def test_plaintext_admin_pin_is_hashed(self):
        self._row(cashier_pin="1234", admin_pin="5678")
        migrate_pin_settings(self.engine)
        self.assertEqual(self._read(), (None, hash_secret("5678"), False, True, 1))

    def test_second_run_keeps_owner_choices(self):
        self._row(cashier_pin=hash_secret("5678"), admin_pin=hash_secret("9876"))
        migrate_pin_settings(self.engine)
        db = self.Session()
        row = db.query(StoreConfigModel).first()
        row.lock_screen_enabled = False
        db.commit()
        db.close()
        migrate_pin_settings(self.engine)
        self.assertFalse(self._read()[2])

    def test_old_table_upgraded_by_schema_migrations(self):
        engine = create_engine("sqlite:///:memory:")
        with engine.connect() as conn:
            conn.execute(text("CREATE TABLE store_config (id INTEGER PRIMARY KEY, cashier_pin VARCHAR DEFAULT '1234')"))
            conn.execute(text("INSERT INTO store_config (id, cashier_pin) VALUES (1, '1234')"))
            conn.commit()
        run_schema_migrations(engine=engine)
        with engine.connect() as conn:
            row = conn.execute(text(
                "SELECT cashier_pin, admin_pin, lock_screen_enabled, admin_pin_enabled FROM store_config"
            )).one()
        self.assertIsNone(row[0])
        self.assertIsNone(row[1])
        self.assertFalse(row[2])
        self.assertFalse(row[3])


class TestSecurityApi(TempDbTestCase):
    def setUp(self):
        db = SessionLocal()
        db.query(StoreConfigModel).delete()
        db.add(StoreConfigModel(id=1))
        db.commit()
        db.close()
        pin_rate_limiter.attempts.clear()
        env = patch.dict(os.environ, {}, clear=False)
        env.start()
        os.environ.pop("POS_MASTER_ADMIN_KEY", None)
        self.addCleanup(env.stop)

    # helpers
    def _config(self):
        return self.client.get("/api/v1/config").json()

    def _save(self, **fields):
        # Once the Admin PIN switch is on, PIN settings need the Admin PIN; sending it is harmless before.
        return self.client.post("/api/v1/config", json=fields, headers={"X-Admin-PIN": ADMIN_PIN})

    def _save_with(self, headers, **fields):
        return self.client.post("/api/v1/config", json=fields, headers=headers)

    def _stored(self, column):
        db = SessionLocal()
        try:
            return getattr(db.query(StoreConfigModel).first(), column)
        finally:
            db.close()

    def _set_stored(self, **columns):
        db = SessionLocal()
        try:
            config = db.query(StoreConfigModel).first()
            for key, value in columns.items():
                setattr(config, key, value)
            db.commit()
        finally:
            db.close()

    def _admin_on(self):
        res = self._save(adminPin=ADMIN_PIN, adminPinEnabled=True)
        self.assertEqual(res.status_code, 200)
        return res.json().get("recoveryCode")

    # fresh install
    def test_fresh_install_has_no_pins_and_locks_off(self):
        cfg = self._config()
        self.assertFalse(cfg["lockScreenEnabled"])
        self.assertFalse(cfg["adminPinEnabled"])
        self.assertFalse(cfg["hasPin"])
        self.assertFalse(cfg["hasAdminPin"])
        self.assertFalse(cfg["hasRecoveryCode"])
        self.assertNotIn("cashierPin", cfg)
        self.assertNotIn("adminPin", cfg)

    def test_default_1234_is_not_accepted_anywhere(self):
        self.assertEqual(self.client.post("/api/v1/config/verify-pin", json={"pin": "1234"}).status_code, 401)
        self.assertEqual(self.client.post("/api/v1/config/verify-admin-pin", json={"pin": "1234"}).status_code, 401)

    def test_1234_cannot_be_chosen(self):
        self.assertEqual(self._save(adminPin="1234").status_code, 400)
        self.assertEqual(self._save(cashierPin="1234").status_code, 400)

    def test_switch_cannot_be_turned_on_without_its_pin(self):
        self.assertEqual(self._save(lockScreenEnabled=True).status_code, 400)
        self.assertEqual(self._save(adminPinEnabled=True).status_code, 400)
        self.assertFalse(self._config()["lockScreenEnabled"])

    # PIN setup and verification
    def test_first_pin_issues_recovery_code_once(self):
        code = self._admin_on()
        self.assertRegex(code or "", RECOVERY_CODE_RE)
        cfg = self._config()
        self.assertTrue(cfg["adminPinEnabled"])
        self.assertTrue(cfg["hasRecoveryCode"])
        res = self._save(cashierPin=CASHIER_PIN, lockScreenEnabled=True)
        self.assertEqual(res.status_code, 200)
        self.assertNotIn("recoveryCode", res.json())
        self.assertTrue(self._config()["lockScreenEnabled"])

    def test_lock_screen_accepts_cashier_and_admin_pin(self):
        self._admin_on()
        self._save(cashierPin=CASHIER_PIN, lockScreenEnabled=True)
        verify = lambda pin: self.client.post("/api/v1/config/verify-pin", json={"pin": pin}).status_code
        self.assertEqual(verify(CASHIER_PIN), 200)
        self.assertEqual(verify(ADMIN_PIN), 200)
        self.assertEqual(verify("9999"), 401)

    def test_cashier_pin_does_not_open_admin_mode(self):
        self._admin_on()
        self._save(cashierPin=CASHIER_PIN)
        verify = lambda pin: self.client.post("/api/v1/config/verify-admin-pin", json={"pin": pin}).status_code
        self.assertEqual(verify(CASHIER_PIN), 401)
        self.assertEqual(verify(ADMIN_PIN), 200)

    def test_switching_off_keeps_the_pin(self):
        self._admin_on()
        self.assertEqual(self._save(adminPinEnabled=False).status_code, 200)
        cfg = self._config()
        self.assertFalse(cfg["adminPinEnabled"])
        self.assertTrue(cfg["hasAdminPin"])

    # master key
    def test_built_in_master_key_is_gone(self):
        self._admin_on()
        res = self.client.post("/api/v1/config/verify-admin-pin", json={"pin": "VOLTFLOW-ADMIN-MASTER-RECOVERY"})
        self.assertEqual(res.status_code, 401)

    def test_short_environment_master_key_is_ignored(self):
        self._admin_on()
        os.environ["POS_MASTER_ADMIN_KEY"] = "short-key"
        res = self.client.post("/api/v1/config/verify-admin-pin", json={"pin": "short-key"})
        self.assertEqual(res.status_code, 401)

    def test_environment_master_key_opens_admin_mode(self):
        self._admin_on()
        os.environ["POS_MASTER_ADMIN_KEY"] = SUPPORT_KEY
        res = self.client.post("/api/v1/config/verify-admin-pin", json={"pin": SUPPORT_KEY})
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.json()["is_master"])

    # recovery
    def test_old_puk_endpoint_is_removed(self):
        self._admin_on()
        res = self.client.post("/api/v1/config/verify-puk", json={"puk": "VOLTFLOW-RECOVERY-99"})
        self.assertIn(res.status_code, (404, 405))  # no POST route any more
        self.assertTrue(self._config()["hasAdminPin"])

    def test_recovery_code_clears_pins_and_turns_locks_off(self):
        code = self._admin_on()
        self._save(cashierPin=CASHIER_PIN, lockScreenEnabled=True)
        bad = self.client.post("/api/v1/config/verify-recovery", json={"code": "AAAA-BBBB-CCCC-DDDD"})
        self.assertEqual(bad.status_code, 401)
        typed = code.replace("-", "").lower()
        ok = self.client.post("/api/v1/config/verify-recovery", json={"code": typed})
        self.assertEqual(ok.status_code, 200)
        cfg = self._config()
        self.assertEqual(
            (cfg["lockScreenEnabled"], cfg["adminPinEnabled"], cfg["hasPin"], cfg["hasAdminPin"], cfg["hasRecoveryCode"]),
            (False, False, False, False, False),
        )
        again = self.client.post("/api/v1/config/verify-recovery", json={"code": code})
        self.assertEqual(again.status_code, 401)

    def test_recovery_is_rate_limited(self):
        self._admin_on()
        for _ in range(5):
            self.client.post("/api/v1/config/verify-recovery", json={"code": "AAAA-BBBB-CCCC-DDDD"})
        res = self.client.post("/api/v1/config/verify-recovery", json={"code": "AAAA-BBBB-CCCC-DDDD"})
        self.assertEqual(res.status_code, 429)

    def test_new_recovery_code_needs_the_admin_pin(self):
        old = self._admin_on()
        self.assertEqual(self.client.post("/api/v1/config/recovery-code", json={"pin": "9999"}).status_code, 401)
        res = self.client.post("/api/v1/config/recovery-code", json={"pin": ADMIN_PIN})
        self.assertEqual(res.status_code, 200)
        new = res.json()["recoveryCode"]
        self.assertRegex(new, RECOVERY_CODE_RE)
        self.assertNotEqual(new, old)
        self.assertEqual(self.client.post("/api/v1/config/verify-recovery", json={"code": old}).status_code, 401)

    def test_recovery_code_cannot_be_issued_without_any_pin(self):
        res = self.client.post("/api/v1/config/recovery-code", json={"pin": ""})
        self.assertEqual(res.status_code, 400)

    # salted hashes
    def test_new_pins_are_stored_salted_and_still_verify(self):
        self._admin_on()
        self._save(cashierPin=CASHIER_PIN)
        admin_stored, cashier_stored = self._stored("admin_pin"), self._stored("cashier_pin")
        self.assertTrue(admin_stored.startswith("scrypt$"))
        self.assertNotIn(ADMIN_PIN, admin_stored)
        self.assertEqual(self.client.post("/api/v1/config/verify-admin-pin", json={"pin": ADMIN_PIN}).status_code, 200)
        self.assertEqual(self.client.post("/api/v1/config/verify-pin", json={"pin": CASHIER_PIN}).status_code, 200)
        # the same PIN set again gets a different salt
        self._save(adminPin=ADMIN_PIN)
        self.assertNotEqual(self._stored("admin_pin"), admin_stored)

    def test_legacy_sha256_hash_verifies_and_is_upgraded_on_login(self):
        self._set_stored(admin_pin=hash_secret(ADMIN_PIN), admin_pin_enabled=True)
        self.assertEqual(self.client.post("/api/v1/config/verify-admin-pin", json={"pin": "0000"}).status_code, 401)
        self.assertEqual(self._stored("admin_pin"), hash_secret(ADMIN_PIN))  # a wrong PIN changes nothing
        self.assertEqual(self.client.post("/api/v1/config/verify-admin-pin", json={"pin": ADMIN_PIN}).status_code, 200)
        self.assertTrue(self._stored("admin_pin").startswith("scrypt$"))
        self.assertEqual(self.client.post("/api/v1/config/verify-admin-pin", json={"pin": ADMIN_PIN}).status_code, 200)

    def test_technician_check_upgrades_a_legacy_hash_too(self):
        self._set_stored(admin_pin=hash_secret(ADMIN_PIN), admin_pin_enabled=True)
        res = self.client.get("/api/v1/system/logs?lines=50", headers={"X-Admin-PIN": ADMIN_PIN})
        self.assertEqual(res.status_code, 200)
        self.assertTrue(self._stored("admin_pin").startswith("scrypt$"))

    # PIN length
    def test_config_reports_pin_lengths_but_never_the_pin(self):
        self._save(cashierPin="147025", lockScreenEnabled=True)
        self._save(adminPin=ADMIN_PIN, adminPinEnabled=True)
        cfg = self._config()
        self.assertEqual((cfg["cashierPinLength"], cfg["adminPinLength"]), (6, 4))
        self.assertNotIn("147025", str(cfg))

    def test_unknown_length_of_an_old_pin_is_learned_on_first_successful_entry(self):
        self._set_stored(cashier_pin=hash_secret("147025"), lock_screen_enabled=True, cashier_pin_length=None)
        self.assertIsNone(self._config()["cashierPinLength"])
        self.client.post("/api/v1/config/verify-pin", json={"pin": "000000"})
        self.assertIsNone(self._config()["cashierPinLength"])
        self.client.post("/api/v1/config/verify-pin", json={"pin": "147025"})
        self.assertEqual(self._config()["cashierPinLength"], 6)

    def test_recovery_clears_the_stored_lengths(self):
        code = self._admin_on()
        self._save(cashierPin=CASHIER_PIN)
        self.client.post("/api/v1/config/verify-recovery", json={"code": code})
        cfg = self._config()
        self.assertIsNone(cfg["cashierPinLength"])
        self.assertIsNone(cfg["adminPinLength"])

    # C1 for PIN settings
    def test_pin_settings_are_open_while_the_admin_switch_is_off(self):
        self.assertEqual(self._save_with({}, cashierPin=CASHIER_PIN, lockScreenEnabled=True).status_code, 200)

    def test_pin_settings_need_the_admin_pin_once_the_switch_is_on(self):
        self._admin_on()
        attempts = [
            ({}, {"lockScreenEnabled": False}),
            ({"X-Admin-PIN": "0000"}, {"adminPinEnabled": False}),
            ({"X-Admin-PIN": CASHIER_PIN}, {"adminPin": "9999"}),
            ({}, {"cashierPin": "9999"}),
        ]
        for headers, fields in attempts:
            pin_rate_limiter.attempts.clear()
            self.assertEqual(self._save_with(headers, **fields).status_code, 401, fields)
        cfg = self._config()
        self.assertTrue(cfg["adminPinEnabled"])
        self.assertEqual(self.client.post("/api/v1/config/verify-admin-pin", json={"pin": ADMIN_PIN}).status_code, 200)
        self.assertEqual(self._save_with({"X-Admin-PIN": ADMIN_PIN}, adminPinEnabled=False).status_code, 200)
        self.assertFalse(self._config()["adminPinEnabled"])

    def test_other_settings_are_not_gated_by_the_pin_check(self):
        self._admin_on()
        self.assertEqual(self._save_with({}, storeName="Shop").status_code, 200)

    def test_pin_settings_accept_the_environment_master_key(self):
        self._admin_on()
        with patch.dict(os.environ, {"POS_MASTER_ADMIN_KEY": SUPPORT_KEY}):
            res = self._save_with({"X-Admin-PIN": SUPPORT_KEY}, adminPinEnabled=False)
        self.assertEqual(res.status_code, 200)

    def test_pin_settings_check_is_rate_limited(self):
        self._admin_on()
        for _ in range(5):
            self._save_with({"X-Admin-PIN": "0000"}, lockScreenEnabled=False)
        self.assertEqual(self._save_with({"X-Admin-PIN": ADMIN_PIN}, lockScreenEnabled=False).status_code, 429)

    def test_a_refused_pin_change_applies_nothing(self):
        self._admin_on()
        res = self._save_with({}, storeName="Changed", adminPinEnabled=False)
        self.assertEqual(res.status_code, 401)
        self.assertNotEqual(self._config()["storeName"], "Changed")

    # server-side checks on protected endpoints
    def test_technician_endpoint_open_when_admin_pin_switched_off(self):
        self.assertEqual(self.client.get("/api/v1/system/logs?lines=50").status_code, 200)

    def test_technician_endpoint_needs_admin_pin_when_switched_on(self):
        self._admin_on()
        self._save(cashierPin=CASHIER_PIN)
        get = lambda headers: self.client.get("/api/v1/system/logs?lines=50", headers=headers).status_code
        self.assertEqual(get({}), 401)
        self.assertEqual(get({"X-Admin-PIN": CASHIER_PIN}), 401)
        self.assertEqual(get({"X-Admin-PIN": ADMIN_PIN}), 200)

    def test_technician_endpoint_is_rate_limited(self):
        self._admin_on()
        for _ in range(5):
            self.client.get("/api/v1/system/logs?lines=50", headers={"X-Admin-PIN": "0000"})
        res = self.client.get("/api/v1/system/logs?lines=50", headers={"X-Admin-PIN": ADMIN_PIN})
        self.assertEqual(res.status_code, 429)

    def test_sale_purge_follows_the_admin_switch(self):
        self.assertEqual(self.client.delete("/api/v1/sales/purge-all").status_code, 200)
        self._admin_on()
        self._save(cashierPin=CASHIER_PIN)
        purge = lambda headers: self.client.delete("/api/v1/sales/purge-all", headers=headers).status_code
        self.assertEqual(purge({}), 401)
        self.assertEqual(purge({"X-Admin-PIN": CASHIER_PIN}), 401)
        self.assertEqual(purge({"X-Admin-PIN": ADMIN_PIN}), 200)


class TestApplySecuritySettings(unittest.TestCase):
    """The rules shared by POST /config and the standalone settings app."""

    def _config(self):
        from types import SimpleNamespace
        return SimpleNamespace(
            cashier_pin=None, admin_pin=None, cashier_pin_length=None, admin_pin_length=None,
            lock_screen_enabled=False, admin_pin_enabled=False, recovery_code_hash=None,
        )

    def test_first_pin_sets_hash_length_and_returns_a_code_once(self):
        from services.pin_auth import apply_security_settings, pin_matches
        config = self._config()
        code = apply_security_settings(config, cashier_pin="147025", lock_screen=True)
        self.assertRegex(code, RECOVERY_CODE_RE)
        self.assertTrue(pin_matches("147025", config.cashier_pin))
        self.assertEqual(config.cashier_pin_length, 6)
        self.assertTrue(config.lock_screen_enabled)
        self.assertIsNone(apply_security_settings(config, admin_pin=ADMIN_PIN))

    def test_bad_input_raises_and_changes_nothing(self):
        from services.pin_auth import apply_security_settings
        config = self._config()
        for kwargs in ({"cashier_pin": "1234"}, {"admin_pin": "12ab"}, {"lock_screen": True}, {"admin_switch": True}):
            with self.assertRaises(ValueError):
                apply_security_settings(config, **kwargs)
        self.assertIsNone(config.cashier_pin)
        self.assertIsNone(config.recovery_code_hash)
        self.assertFalse(config.lock_screen_enabled)


class TestRestoreMigratesPins(unittest.TestCase):
    """A restored pre-Batch-G backup must get its PIN settings migrated at once, not at the next restart."""

    def test_old_backup_keeps_chosen_pin_and_lock_after_restore(self):
        import sqlite3
        import zipfile
        from services import backup_service

        tmp = tempfile.mkdtemp(prefix="pos_restore_test_")
        self.addCleanup(shutil.rmtree, tmp, ignore_errors=True)
        live_db = os.path.join(tmp, "live.db")
        backups = os.path.join(tmp, "backups")
        os.makedirs(backups)

        conn = sqlite3.connect(live_db)
        conn.execute("CREATE TABLE placeholder (id INTEGER)")
        conn.commit()
        conn.close()

        old_db = os.path.join(tmp, "pos_store.db")
        conn = sqlite3.connect(old_db)
        conn.execute("CREATE TABLE store_config (id INTEGER PRIMARY KEY, cashier_pin VARCHAR, admin_pin VARCHAR)")
        conn.execute("INSERT INTO store_config (id, cashier_pin, admin_pin) VALUES (1, '5678', '1234')")
        conn.commit()
        conn.close()
        with zipfile.ZipFile(os.path.join(backups, "old.zip"), "w") as zf:
            zf.write(old_db, "pos_store.db")

        temp_engine = create_engine(f"sqlite:///{live_db}")
        self.addCleanup(temp_engine.dispose)
        with patch.object(backup_service, "DB_PATH", live_db), \
                patch.object(backup_service, "BACKUPS_DIR", backups), \
                patch("database.engine", temp_engine):
            res = backup_service.restore_database_from_backup("old.zip")
        self.assertEqual(res["status"], "SUCCESS", res)

        conn = sqlite3.connect(live_db)
        cashier, admin, lock, admin_on = conn.execute(
            "SELECT cashier_pin, admin_pin, lock_screen_enabled, admin_pin_enabled FROM store_config"
        ).fetchone()
        conn.close()
        self.assertEqual(cashier, hash_secret("5678"))
        self.assertEqual(admin, cashier)  # an unset Admin PIN takes the chosen cashier PIN
        self.assertEqual((lock, admin_on), (1, 1))


if __name__ == "__main__":
    unittest.main()
