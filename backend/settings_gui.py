import os
import sys
import json
import hashlib
import shutil
import subprocess
import urllib.request
import urllib.error
from pathlib import Path

# Ensure backend directory is in sys.path
BACKEND_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BACKEND_DIR.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

# Ensure pywebview is available
try:
    import webview
except ImportError:
    print("Installing pywebview...")
    subprocess.check_call([sys.executable, "-m", "pip", "install", "pywebview"])
    import webview

# Import DB setup
try:
    from database import SessionLocal, engine
    from models import StoreConfigModel, Base
    Base.metadata.create_all(bind=engine)
except Exception as e:
    print(f"Database initialization warning: {e}")
    SessionLocal = None
    StoreConfigModel = None

ENV_PATH = BACKEND_DIR / ".env"
ENV_EXAMPLE_PATH = BACKEND_DIR / ".env.example"


def hash_pin(pin: str) -> str:
    """SHA-256 hash of PIN string."""
    return hashlib.sha256(pin.encode("utf-8")).hexdigest()


def read_env_file() -> dict:
    """Read key-values from backend/.env into a dictionary."""
    target = ENV_PATH if ENV_PATH.exists() else ENV_EXAMPLE_PATH
    env_vars = {}
    if target.exists():
        with open(target, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    env_vars[k.strip()] = v.strip()
    return env_vars


def write_env_file(env_dict: dict):
    """Write/Update key-values into backend/.env preserving format."""
    lines = []
    existing_keys = set()
    
    if ENV_PATH.exists():
        with open(ENV_PATH, "r", encoding="utf-8") as f:
            for line in f:
                raw_line = line.rstrip("\r\n")
                stripped = raw_line.strip()
                if stripped and not stripped.startswith("#") and "=" in stripped:
                    k, _ = stripped.split("=", 1)
                    k = k.strip()
                    if k in env_dict:
                        lines.append(f"{k}={env_dict[k]}")
                        existing_keys.add(k)
                        continue
                lines.append(raw_line)

    # Append missing keys
    for k, v in env_dict.items():
        if k not in existing_keys:
            lines.append(f"{k}={v}")

    with open(ENV_PATH, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")


class SettingsAPI:
    """JS Bridge exposed to pywebview frontend via window.pywebview.api."""

    def __init__(self):
        self.server_process = None
        self.window = None

    def set_window(self, window):
        self.window = window

    def verify_pin(self, pin: str) -> dict:
        """Validate PIN against stored config PIN hash."""
        if not SessionLocal:
            return {"success": True, "message": "No DB lock"}

        db = SessionLocal()
        try:
            config = db.query(StoreConfigModel).first()
            if not config or not config.cashier_pin:
                return {"success": True, "message": "Default PIN"}

            input_hash = hash_pin(pin)
            stored = config.cashier_pin

            # Support both hashed and legacy raw 4-digit pin
            if stored == input_hash or stored == pin or (stored == hash_pin("1234") and pin == "1234"):
                return {"success": True}
            return {"success": False, "message": "Invalid PIN code"}
        except Exception as e:
            return {"success": False, "message": str(e)}
        finally:
            db.close()

    def get_settings(self) -> dict:
        """Return merged dictionary of .env and store_config database row."""
        env_vars = read_env_file()
        db_config = {}

        if SessionLocal and StoreConfigModel:
            db = SessionLocal()
            try:
                config = db.query(StoreConfigModel).first()
                if not config:
                    config = StoreConfigModel()
                    db.add(config)
                    db.commit()
                    db.refresh(config)

                db_config = {
                    "storeName": config.store_name,
                    "street": config.street,
                    "city": config.city,
                    "ico": config.ico,
                    "dic": config.dic,
                    "registerNo": config.register_no,
                    "defaultVat": config.default_vat,
                    "receiptFooter": config.receipt_footer,
                    "bankAccountIban": config.bank_account_iban,
                    "printerInterface": config.printer_interface,
                    "printerAddress": config.printer_address,
                    "printerPaperWidth": config.printer_paper_width,
                    "eetEnabled": bool(config.eet_enabled),
                    "eetEnvironment": config.eet_environment or "playground",
                    "eetCertPath": config.eet_cert_path or "",
                    "idProvozovny": config.id_provozovny or "11",
                    "idPokl": config.id_pokl or "1",
                    "csobTerminalEnabled": bool(config.csob_terminal_enabled),
                    "csobTerminalIp": config.csob_terminal_ip or "",
                    "csobTerminalPort": config.csob_terminal_port or 8888,
                    "csobTerminalId": config.csob_terminal_id or "",
                    "cashierPin": config.cashier_pin or "",
                    "autoLockMinutes": config.auto_lock_minutes or 15,
                    "directHardwarePrint": bool(config.direct_hardware_print),
                    "defaultLanguage": config.default_language or "cs",
                    "cartPosition": config.cart_position or "left"
                }
            except Exception as e:
                print(f"Error reading store config DB: {e}")
            finally:
                db.close()

        return {
            "env": env_vars,
            "config": db_config
        }

    def save_settings(self, payload: dict) -> dict:
        """Save updated env vars and DB store config."""
        try:
            env_data = payload.get("env", {})
            config_data = payload.get("config", {})

            # 1. Update .env
            if env_data:
                write_env_file(env_data)

            # 2. Update store_config SQLite table
            if config_data and SessionLocal and StoreConfigModel:
                db = SessionLocal()
                try:
                    config = db.query(StoreConfigModel).first()
                    if not config:
                        config = StoreConfigModel()
                        db.add(config)

                    if "storeName" in config_data: config.store_name = config_data["storeName"]
                    if "street" in config_data: config.street = config_data["street"]
                    if "city" in config_data: config.city = config_data["city"]
                    if "ico" in config_data: config.ico = config_data["ico"]
                    if "dic" in config_data: config.dic = config_data["dic"]
                    if "registerNo" in config_data: config.register_no = config_data["registerNo"]
                    if "defaultVat" in config_data: config.default_vat = int(config_data["defaultVat"])
                    if "receiptFooter" in config_data: config.receipt_footer = config_data["receiptFooter"]
                    if "bankAccountIban" in config_data: config.bank_account_iban = config_data["bankAccountIban"]
                    if "printerInterface" in config_data: config.printer_interface = config_data["printerInterface"]
                    if "printerAddress" in config_data: config.printer_address = config_data["printerAddress"]
                    if "printerPaperWidth" in config_data: config.printer_paper_width = str(config_data["printerPaperWidth"])
                    if "eetEnabled" in config_data: config.eet_enabled = bool(config_data["eetEnabled"])
                    if "eetEnvironment" in config_data: config.eet_environment = config_data["eetEnvironment"]
                    if "eetCertPath" in config_data: config.eet_cert_path = config_data["eetCertPath"]
                    if "idProvozovny" in config_data: config.id_provozovny = config_data["idProvozovny"]
                    if "idPokl" in config_data: config.id_pokl = config_data["idPokl"]
                    if "csobTerminalEnabled" in config_data: config.csob_terminal_enabled = bool(config_data["csobTerminalEnabled"])
                    if "csobTerminalIp" in config_data: config.csob_terminal_ip = config_data["csobTerminalIp"]
                    if "csobTerminalPort" in config_data: config.csob_terminal_port = int(config_data["csobTerminalPort"])
                    if "csobTerminalId" in config_data: config.csob_terminal_id = config_data["csobTerminalId"]
                    if "autoLockMinutes" in config_data: config.auto_lock_minutes = int(config_data["autoLockMinutes"])
                    if "directHardwarePrint" in config_data: config.direct_hardware_print = bool(config_data["directHardwarePrint"])
                    if "defaultLanguage" in config_data: config.default_language = config_data["defaultLanguage"]
                    if "cartPosition" in config_data: config.cart_position = config_data["cartPosition"]

                    # Update PIN if provided
                    new_pin = config_data.get("newPin")
                    if new_pin and len(new_pin) >= 4:
                        config.cashier_pin = hash_pin(new_pin)

                    db.commit()
                finally:
                    db.close()

            return {"success": True, "message": "Settings saved successfully"}
        except Exception as e:
            return {"success": False, "message": str(e)}

    def select_eet_cert_file(self) -> dict:
        """Open native Windows file picker for EET PKCS#12 certificate (.p12/.pfx)."""
        if not self.window:
            return {"success": False, "message": "Window context missing"}

        try:
            result = self.window.create_file_dialog(
                webview.OPEN_DIALOG,
                allow_multiple=False,
                file_types=('EET Certificate Files (*.p12;*.pfx)', 'All files (*.*)')
            )

            if result and len(result) > 0:
                return {"success": True, "file_path": result[0]}
            return {"success": False, "message": "No file selected"}
        except Exception as e:
            return {"success": False, "message": str(e)}

    def upload_eet_cert(self, file_path: str, password: str) -> dict:
        """Process, validate and save EET certificate into backend/certs/."""
        if not file_path or not os.path.exists(file_path):
            return {"success": False, "message": "Certifikát nenalezen na zadané cestě."}

        filename = os.path.basename(file_path)
        if not filename.lower().endswith((".p12", ".pfx")):
            return {"success": False, "message": "Soubor musí mít příponu .p12 nebo .pfx"}

        certs_dir = BACKEND_DIR / "certs"
        certs_dir.mkdir(exist_ok=True)
        dest_path = certs_dir / filename

        try:
            shutil.copy2(file_path, dest_path)
        except Exception as e:
            return {"success": False, "message": f"Chyba při kopírování souboru: {e}"}

        # Validate cert if eet_service is available
        cert_info = {}
        try:
            from services import eet_service
            crypto_mgr = eet_service.get_crypto_manager(str(dest_path), password)
            cert_info = crypto_mgr.get_certificate_info()
            if not cert_info.get("loaded"):
                if dest_path.exists():
                    os.remove(dest_path)
                return {"success": False, "message": "Nepodařilo se načíst certifikát. Zkontrolujte prosím heslo."}
        except Exception as e:
            print(f"Notice: Cert validation check skipped: {e}")

        # Update DB Config
        if SessionLocal and StoreConfigModel:
            db = SessionLocal()
            try:
                config = db.query(StoreConfigModel).first()
                if not config:
                    config = StoreConfigModel()
                    db.add(config)

                config.eet_cert_path = str(dest_path)
                if hasattr(config, 'set_encrypted_cert_password'):
                    config.set_encrypted_cert_password(password)
                else:
                    config.eet_cert_password = password

                db.commit()
            except Exception as e:
                return {"success": False, "message": f"Chyba DB: {e}"}
            finally:
                db.close()

        return {
            "success": True,
            "message": f"Certifikát '{filename}' byl úspěšně nahrán a uložen.",
            "cert_path": str(dest_path),
            "cert_info": cert_info
        }

    def get_server_status(self) -> dict:
        """Fast non-blocking check if FastAPI server is responding on configured port."""
        import socket
        env_vars = read_env_file()
        host = env_vars.get("HOST", "127.0.0.1")
        if host == "0.0.0.0":
            host = "127.0.0.1"
        try:
            port = int(env_vars.get("PORT", "8000"))
        except ValueError:
            port = 8000

        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(0.15)
        try:
            result = sock.connect_ex((host, port))
            sock.close()
            if result == 0:
                return {"online": True, "url": f"http://{host}:{port}"}
        except Exception:
            try:
                sock.close()
            except Exception:
                pass

        return {"online": False, "url": f"http://{host}:{port}"}

    def trigger_backup(self) -> dict:
        """Create a manual timestamped backup of pos_store.db."""
        try:
            db_file = PROJECT_ROOT / "pos_store.db"
            if not db_file.exists():
                db_file = BACKEND_DIR / "pos_store.db"

            if not db_file.exists():
                return {"success": False, "message": "pos_store.db file not found"}

            backups_dir = BACKEND_DIR / "backups"
            backups_dir.mkdir(exist_ok=True)

            from datetime import datetime
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            dest = backups_dir / f"manual_backup_{timestamp}.db"

            shutil.copy2(db_file, dest)
            return {"success": True, "message": f"Backup created: {dest.name}"}
        except Exception as e:
            return {"success": False, "message": str(e)}

    def get_logs(self) -> dict:
        """Read last 100 lines of app log files."""
        log_files = [
            BACKEND_DIR / "logs" / "app.log",
            BACKEND_DIR / "logs" / "backend.log"
        ]

        lines = []
        for log_path in log_files:
            if log_path.exists():
                try:
                    with open(log_path, "r", encoding="utf-8", errors="ignore") as f:
                        lines.extend(f.readlines()[-100:])
                except Exception as e:
                    lines.append(f"Error reading {log_path.name}: {e}\n")

        if not lines:
            return {"logs": "No log files found in backend/logs/"}

        return {"logs": "".join(lines)}


def main():
    api = SettingsAPI()
    html_path = BACKEND_DIR / "settings_ui" / "index.html"

    window = webview.create_window(
        title="Himmel POS — Backend Settings",
        url=str(html_path.resolve()),
        js_api=api,
        width=1000,
        height=720,
        resizable=True,
        min_size=(800, 600),
        background_color='#0f172a'
    )

    api.set_window(window)
    webview.start(debug=False)


if __name__ == "__main__":
    main()
