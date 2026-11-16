"""Base test case that runs API tests against a throw-away SQLite file, never the store DB.

Rebinds the shared SessionLocal for the duration of the class; routers read it per request.
"""
import os
import shutil
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from fastapi.testclient import TestClient
from sqlalchemy import create_engine

from database import Base, SessionLocal
from main import app


class TempDbTestCase(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls._tmp = tempfile.mkdtemp(prefix="pos_test_")
        cls._orig_engine = SessionLocal.kw["bind"]
        cls._engine = create_engine(
            f"sqlite:///{os.path.join(cls._tmp, 'test.db')}",
            connect_args={"check_same_thread": False},
        )
        import models  # noqa: F401  (register tables)
        Base.metadata.create_all(bind=cls._engine)
        SessionLocal.configure(bind=cls._engine)
        cls.client = TestClient(app)

    @classmethod
    def tearDownClass(cls):
        SessionLocal.configure(bind=cls._orig_engine)
        cls._engine.dispose()
        shutil.rmtree(cls._tmp, ignore_errors=True)
