from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, JSON, Boolean, Index, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base


class SaleModel(Base):
    """DB Model for Sales Ledger Transactions."""
    __tablename__ = "sales"

    id = Column(String, primary_key=True, index=True)
    receipt_number = Column(String, index=True, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    total_amount = Column(Float, nullable=False)
    cart_discount_percent = Column(Float, default=0.0)
    payment_method = Column(String, nullable=False)  # 'cash', 'card', 'qr', 'split'
    split_details = Column(JSON, nullable=True)     # {'cash': 500, 'card': 1000}
    tendered_amount = Column(Float, default=0.0)
    change_due = Column(Float, default=0.0)
    tax_summary = Column(JSON, nullable=False)       # Grouped VAT breakdown
    fik_code = Column(String, nullable=True)          # Czech EET FIK code
    bkp_code = Column(String, nullable=True)          # Czech EET BKP code
    pkp_code = Column(String, nullable=True)          # Czech EET PKP RSA signature
    eet_status = Column(String, default="EVD_OK")     # 'EVD_OK', 'OFFLINE_PENDING', 'VERIFIED_ONLY', 'ERROR'
    eic_popl = Column(String, nullable=True)
    id_provozovny = Column(String, default="11")
    id_pokl = Column(String, default="1")
    is_sent_to_eet = Column(Boolean, default=True)
    eet_retry_count = Column(Integer, default=0)
    is_refund = Column(Boolean, default=False)
    original_receipt_number = Column(String, nullable=True)
    refund_reason = Column(String, nullable=True)
    refund_status = Column(String, default="NONE", index=True)    # 'NONE', 'PARTIAL', 'FULL'
    refunded_amount = Column(Float, default=0.0)

    __table_args__ = (
        Index("ix_sales_timestamp_payment_method", "timestamp", "payment_method"),
    )

    items = relationship("SaleItemModel", back_populates="sale", cascade="all, delete-orphan", lazy="selectin")


class SaleItemModel(Base):
    """DB Model for line items in a transaction."""
    __tablename__ = "sale_items"

    id = Column(Integer, primary_key=True, autoincrement=True)
    sale_id = Column(String, ForeignKey("sales.id"), nullable=False)
    item_id = Column(String, nullable=True)
    name = Column(String, nullable=False)
    price = Column(Float, nullable=False)
    quantity = Column(Integer, nullable=False, default=1)
    vat = Column(Integer, nullable=False, default=21)
    discount_percent = Column(Float, default=0.0)

    sale = relationship("SaleModel", back_populates="items")


class StoreConfigModel(Base):
    """DB Model for Store Register Configuration."""
    __tablename__ = "store_config"

    id = Column(Integer, primary_key=True, default=1)
    store_name = Column(String, default="VoltFlow Store s.r.o.")
    street = Column(String, default="Václavské náměstí 15")
    city = Column(String, default="110 00 Praha 1")
    ico = Column(String, default="12345678")
    dic = Column(String, default="CZ12345678")
    register_no = Column(String, default="Pokladna #01")
    default_vat = Column(Integer, default=21)
    receipt_footer = Column(String, default="Děkujeme za váš nákup!")
    bank_account_iban = Column(String, default="")
    printer_interface = Column(String, default="USB") # 'USB', 'NETWORK', 'SERIAL'
    printer_address = Column(String, default="/dev/usb/lp0")
    printer_paper_width = Column(String, default="80") # '58' or '80' mm

    # EET 2.0 Configuration
    eet_enabled = Column(Boolean, default=False)
    eet_cert_path = Column(String, default="")
    eet_cert_password = Column(String, default="")
    eet_environment = Column(String, default="playground") # 'playground', 'production'
    eet_mode = Column(Integer, default=0) # 0 = standard online, 1 = simplified offline
    id_provozovny = Column(String, default="11")
    id_pokl = Column(String, default="1")

    # CSOB Payment Terminal Ingenico Move 3500 Configuration
    csob_terminal_enabled = Column(Boolean, default=False)
    csob_terminal_ip = Column(String, default="")
    csob_terminal_port = Column(Integer, default=8888)
    csob_terminal_id = Column(String, default="")

    # Cashier Lock & Security Configuration
    cashier_pin = Column(String, default="1234")
    admin_pin = Column(String, default="1234")
    auto_lock_minutes = Column(Integer, default=15)

    # Hardware Direct Silent Printing vs Browser Debug Preview
    direct_hardware_print = Column(Boolean, default=True)

    # Default POS Language Configuration ('cs', 'vi', 'en')
    default_language = Column(String, default="cs")

    # Register Layout Configuration ('left' or 'right' for cart column)
    cart_position = Column(String, default="left")

    # Customer Display Custom Greeting & Auto Sleep Settings
    customer_display_title = Column(String, default="Vítejte u nás")
    customer_display_auto_sleep = Column(Boolean, default=True)
    customer_display_standby_delay = Column(Integer, default=10)

    # Automatic Receipt Printing on Finished Transactions
    auto_print_receipt = Column(Boolean, default=False)

    # Preset Grid Columns / Density Setting ('auto', '3', '4', '5', '6')
    preset_grid_columns = Column(String, default="auto")

    # Preset Tile Density / Button Size ('compact', 'standard', 'large')
    preset_density = Column(String, default="standard")

    # Preset Button Aesthetic Style ('left-stripe' or 'color-fill')
    preset_button_style = Column(String, default="left-stripe")

    # Show/Hide VAT Rate on Preset Tiles (Useful for non-VAT retailers)
    show_preset_vat = Column(Boolean, default=True)

    # Receipt Overhaul Customization Fields
    receipt_top_margin = Column(Integer, default=1)
    receipt_bottom_margin = Column(Integer, default=3)
    receipt_copies = Column(Integer, default=1)
    receipt_encoding = Column(String, default="CP852")
    strip_diacritics = Column(Boolean, default=False)
    receipt_separator_style = Column(String, default="dashed")
    receipt_separator_spacing = Column(String, default="standard")
    receipt_title_style = Column(String, default="banner")
    receipt_bold_store_name = Column(Boolean, default=True)
    receipt_bold_item_names = Column(Boolean, default=True)
    receipt_bold_prices = Column(Boolean, default=True)
    receipt_bold_total = Column(Boolean, default=True)
    receipt_bold_footer = Column(Boolean, default=False)
    receipt_show_store_contact = Column(Boolean, default=True)
    receipt_store_phone = Column(String, default="")
    receipt_store_email = Column(String, default="")
    receipt_vat_payer_status = Column(String, default="payer")
    receipt_item_density = Column(String, default="standard")
    receipt_show_item_sku = Column(Boolean, default=False)
    receipt_show_item_vat = Column(Boolean, default=True)
    receipt_show_item_discount = Column(Boolean, default=True)
    receipt_tax_matrix_style = Column(String, default="detailed")
    receipt_qr_code_type = Column(String, default="none")
    receipt_qr_code_url = Column(String, default="")
    receipt_show_logo = Column(Boolean, default=False)
    receipt_logo_base64 = Column(Text, default="")
    receipt_custom_header = Column(String, default="")
    receipt_footer_lines = Column(String, default="Děkujeme za váš nákup!\nReklamace možná do 14 dnů s účtenkou.")
    receipt_show_branding = Column(Boolean, default=True)
    receipt_show_cashier = Column(Boolean, default=True)
    receipt_show_barcode = Column(Boolean, default=True)

    # Cloud Backup Configuration (S3 / Cloudflare R2 / MinIO)
    cloud_backup_enabled = Column(Boolean, default=False)
    cloud_backup_endpoint = Column(String, default="")
    cloud_backup_bucket = Column(String, default="himmel-pos-backups")
    cloud_backup_access_key = Column(String, default="")
    cloud_backup_secret_key = Column(String, default="")
    cloud_backup_prefix = Column(String, default="store_01")
    cloud_backup_retention_days = Column(Integer, default=30)
    cloud_backup_last_sync = Column(String, default="")
    cloud_backup_last_status = Column(String, default="")
    cloud_backup_last_error = Column(String, default="")

    def get_decrypted_cert_password(self) -> str:
        """Returns decrypted EET certificate password."""
        from services.security_utils import decrypt_secret
        return decrypt_secret(self.eet_cert_password or "")

    def set_encrypted_cert_password(self, password: str):
        """Encrypts and stores EET certificate password."""
        from services.security_utils import encrypt_secret
        self.eet_cert_password = encrypt_secret(password)

    def get_decrypted_cloud_secret(self) -> str:
        """Returns decrypted Cloud S3 Secret Access Key."""
        from services.security_utils import decrypt_secret
        return decrypt_secret(self.cloud_backup_secret_key or "")

    def set_encrypted_cloud_secret(self, secret: str):
        """Encrypts and stores Cloud S3 Secret Access Key."""
        from services.security_utils import encrypt_secret
        self.cloud_backup_secret_key = encrypt_secret(secret)



class CategoryModel(Base):
    """DB Model for Product Categories."""
    __tablename__ = "categories"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    position = Column(Integer, default=0)


class PresetModel(Base):
    """DB Model for Quick Item Presets."""
    __tablename__ = "presets"

    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    price = Column(Float, nullable=False, default=0.0)
    category = Column(String, nullable=False, default="custom")
    vat = Column(Integer, default=21)
    color = Column(String, nullable=True)
    is_open_price = Column(Boolean, default=False)
    is_general = Column(Boolean, default=False, nullable=False)
    position = Column(Integer, default=0)
    stock_quantity = Column(Integer, default=0, nullable=False)
    track_stock = Column(Boolean, default=False, nullable=False)
    min_stock_alert = Column(Integer, default=5, nullable=False)
    barcode = Column(String, index=True, nullable=True)
    icon = Column(String, nullable=True)
    image_url = Column(String, nullable=True)
    show_in_presets = Column(Boolean, default=True, nullable=False)
    cost_price = Column(Float, default=0.0, nullable=False)


class ReceiptSequenceModel(Base):
    """DB Model for Atomic Receipt Sequence Counters per Year."""
    __tablename__ = "receipt_sequences"

    year = Column(Integer, primary_key=True)
    last_seq = Column(Integer, default=0, nullable=False)


class EetAuditLogModel(Base):
    """DB Model for immutable EET 2.0 transaction audit logs."""
    __tablename__ = "eet_audit_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    sale_id = Column(String, ForeignKey("sales.id"), nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)
    action = Column(String, nullable=False)     # 'FIRST_SEND', 'RETRY_SEND', 'VERIFY'
    status = Column(String, nullable=False)     # 'EVD_OK', 'OFFLINE_PENDING', 'ERROR'
    bkp = Column(String, nullable=True)
    fik = Column(String, nullable=True)
    request_hash = Column(String, nullable=True)
    error_message = Column(String, nullable=True)


