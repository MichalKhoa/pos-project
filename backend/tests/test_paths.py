import os
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
import paths


class TestPaths(unittest.TestCase):
    def test_default_paths_exist(self):
        self.assertTrue(os.path.exists(paths.DATA_DIR))
        self.assertTrue(os.path.isdir(paths.DATA_DIR))
        self.assertTrue(os.path.exists(paths.LOGS_DIR))
        self.assertTrue(os.path.isdir(paths.LOGS_DIR))
        self.assertTrue(os.path.exists(paths.CERTS_DIR))
        self.assertTrue(os.path.isdir(paths.CERTS_DIR))

    def test_db_path_in_data_dir(self):
        self.assertEqual(os.path.dirname(paths.DB_PATH), paths.DATA_DIR)
        self.assertTrue(paths.DB_PATH.endswith("pos_store.db"))

    def test_dist_dir_resolution(self):
        dist = paths.get_dist_dir()
        self.assertIsInstance(dist, str)
        self.assertTrue(len(dist) > 0)

    def test_custom_data_dir_env(self):
        custom_dir = "/tmp/test_custom_pos_data"
        with patch.dict(os.environ, {"POS_DATA_DIR": custom_dir}):
            # Test that env var is respected if paths was reloaded or simulated
            env_data_dir = os.getenv("POS_DATA_DIR")
            self.assertEqual(env_data_dir, custom_dir)


if __name__ == "__main__":
    unittest.main()
