import sys
import unittest
import os

def main():
    root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    backend_tests_dir = os.path.join(root_dir, "backend", "tests")
    sys.path.insert(0, os.path.join(root_dir, "backend"))

    print("=" * 60)
    print("[TESTS] RUNNING HIMMEL POS AUTOMATED TEST SUITE")
    print("=" * 60)

    loader = unittest.TestLoader()
    suite = loader.discover(start_dir=backend_tests_dir, pattern="test_*.py")

    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)

    sys.exit(0 if result.wasSuccessful() else 1)

if __name__ == "__main__":
    main()
