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

    # B2B Invoicing Fields (> 10 000 CZK or customer requested)
    is_invoice = Column(Boolean, default=False, nullable=False, index=True)
    invoice_number = Column(String, nullable=True, index=True)   # e.g. 'FA-2026-0001'
    customer_ico = Column(String, nullable=True, index=True)     # Czech IČO (8 digits)
    customer_dic = Column(String, nullable=True)                # Czech DIČ (e.g. CZ12345678)
    customer_name = Column(String, nullable=True)               # Company name / Sole trader
    customer_address = Column(String, nullable=True)            # Full registered address

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
    quantity = Column(Float, nullable=False, default=1.0)
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

    # Default Margin Coefficient for Cost-Plus pricing
    default_margin_coefficient = Column(Float, default=1.30, nullable=False)

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
    natural_loss_norm = Column(Float, default=0.0, nullable=False)  # Natural loss norm % (§ 25 ZoÚ, e.g. 3.0 for 3%)


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
    stock_quantity = Column(Float, default=0.0, nullable=False)
    track_stock = Column(Boolean, default=False, nullable=False)
    min_stock_alert = Column(Float, default=5.0, nullable=False)
    barcode = Column(String, index=True, nullable=True)
    icon = Column(String, nullable=True)
    image_url = Column(String, nullable=True)
    show_in_presets = Column(Boolean, default=True, nullable=False)
    cost_price = Column(Float, default=0.0, nullable=False)
    unit = Column(String, default="ks", nullable=False)
    is_weighted = Column(Boolean, default=False, nullable=False)
    margin_coefficient = Column(Float, nullable=True)

    stock_movements = relationship("StockMovementModel", back_populates="preset", cascade="all, delete-orphan", passive_deletes=True)


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


class CashMovementModel(Base):
    """DB Model for Cash Drawer Movements (Float In, Payout, Safe Drop)."""
    __tablename__ = "cash_movements"

    id = Column(String, primary_key=True, index=True)
    shift_id = Column(String, index=True, nullable=True)
    movement_type = Column(String, nullable=False)  # 'FLOAT_IN' (vklad), 'PAYOUT' (výběr/dodavatel), 'SAFE_DROP' (odvod do trezoru)
    amount = Column(Float, nullable=False)          # Always positive float
    reason = Column(String, nullable=True)          # e.g. "Ranní vklad do pokladny", "Pekárna hotovost"
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class ShiftSessionModel(Base):
    """DB Model for Shift Sessions and Z-Report Balancing."""
    __tablename__ = "shift_sessions"

    id = Column(String, primary_key=True, index=True)
    shift_number = Column(Integer, default=1)
    opened_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    closed_at = Column(DateTime, nullable=True)
    opening_cash = Column(Float, default=0.0, nullable=False)
    expected_cash = Column(Float, default=0.0, nullable=False)
    actual_cash = Column(Float, default=0.0, nullable=True)
    discrepancy = Column(Float, default=0.0, nullable=True)  # actual - expected (negative = manko, positive = přebytek)
    is_closed = Column(Boolean, default=False, nullable=False)
    z_seq = Column(Integer, default=1, nullable=False)       # Sequential Z-Report closure counter


class StockMovementModel(Base):
    """DB Model for Stock Movement Ledger (§ 7b ZDP)."""
    __tablename__ = "stock_movements"

    id = Column(String, primary_key=True, index=True)
    preset_id = Column(String, ForeignKey("presets.id", ondelete="CASCADE"), index=True, nullable=False)
    movement_type = Column(String, nullable=False, index=True)  # 'RECEIPT', 'SALE', 'RETURN', 'WRITE_OFF', 'ADJUSTMENT'
    quantity_delta = Column(Float, nullable=False)  # Positive for RECEIPT/RETURN, negative for SALE/WRITE_OFF
    unit_cost = Column(Float, default=0.0, nullable=False)  # Purchase cost price without VAT
    supplier_ico = Column(String, nullable=True, index=True)  # Czech IČO
    supplier_name = Column(String, nullable=True)
    document_ref = Column(String, nullable=True)  # Invoice or delivery note number
    note = Column(String, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    preset = relationship("PresetModel", back_populates="stock_movements")


class WriteOffSequenceModel(Base):
    """DB Model for Atomic Write-Off Protocol Sequence Counters per Year."""
    __tablename__ = "write_off_sequences"

    year = Column(Integer, primary_key=True)
    last_seq = Column(Integer, default=0, nullable=False)


class StockWriteOffModel(Base):
    """DB Model for Stock Write-Off / Liquidation Protocols (§ 25 ZoÚ)."""
    __tablename__ = "stock_write_offs"

    id = Column(String, primary_key=True, index=True)
    protocol_number = Column(String, unique=True, index=True, nullable=False)  # e.g. ODP-2026-0001
    reason = Column(String, nullable=False, index=True)  # 'EXSPIRACE', 'ZKAZA', 'ROZBITI', 'KRADEZ', 'OTHER'
    responsible_person = Column(String, nullable=True)  # Cashier / Manager name
    note = Column(String, nullable=True)
    total_cost_value = Column(Float, default=0.0, nullable=False)  # Total cost price sum
    total_retail_value = Column(Float, default=0.0, nullable=False)  # Total selling price sum
    is_tax_deductible = Column(Boolean, default=True, nullable=False)  # True if within norm § 25 ZoÚ, False if theft/culpable
    vat_adjustment_required = Column(Boolean, default=False, nullable=False)  # § 77/78 ZDPH correction indicator
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    items = relationship("StockWriteOffItemModel", back_populates="write_off", cascade="all, delete-orphan")


class StockWriteOffItemModel(Base):
    """DB Model for individual line items in a Write-Off Protocol."""
    __tablename__ = "stock_write_off_items"

    id = Column(String, primary_key=True, index=True)
    write_off_id = Column(String, ForeignKey("stock_write_offs.id", ondelete="CASCADE"), index=True, nullable=False)
    preset_id = Column(String, ForeignKey("presets.id"), nullable=False)
    preset_name = Column(String, nullable=False)
    quantity = Column(Float, nullable=False)
    unit = Column(String, default="ks", nullable=False)
    unit_cost = Column(Float, default=0.0, nullable=False)
    unit_price = Column(Float, default=0.0, nullable=False)
    vat = Column(Integer, default=21, nullable=False)
    total_cost = Column(Float, default=0.0, nullable=False)
    total_price = Column(Float, default=0.0, nullable=False)
    is_norm_loss = Column(Boolean, default=True, nullable=False)

    write_off = relationship("StockWriteOffModel", back_populates="items")


class InvoiceSequenceModel(Base):
    """DB Model for Atomic B2B Invoice Sequence Counters per Year."""
    __tablename__ = "invoice_sequences"

    year = Column(Integer, primary_key=True)
    last_seq = Column(Integer, default=0, nullable=False)


class InventoryAuditSequenceModel(Base):
    """DB Model for Atomic Inventory Audit Protocol Sequence Counters per Year."""
    __tablename__ = "inventory_audit_sequences"

    year = Column(Integer, primary_key=True)
    last_seq = Column(Integer, default=0, nullable=False)


class InventoryAuditModel(Base):
    """DB Model for Physical Inventory Audit Protocols (§ 29, 30 ZoÚ)."""
    __tablename__ = "inventory_audits"

    id = Column(String, primary_key=True, index=True)
    protocol_number = Column(String, unique=True, index=True, nullable=False)  # e.g. INV-2026-0001
    responsible_person = Column(String, nullable=True)
    note = Column(String, nullable=True)
    total_items_counted = Column(Integer, default=0, nullable=False)
    total_surplus_value = Column(Float, default=0.0, nullable=False)    # přebytek v nákupních cenách
    total_shortage_value = Column(Float, default=0.0, nullable=False)   # manko v nákupních cenách
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    items = relationship("InventoryAuditItemModel", back_populates="audit", cascade="all, delete-orphan")


class InventoryAuditItemModel(Base):
    """Line item in a physical inventory audit."""
    __tablename__ = "inventory_audit_items"

    id = Column(String, primary_key=True, index=True)
    audit_id = Column(String, ForeignKey("inventory_audits.id", ondelete="CASCADE"), index=True, nullable=False)
    preset_id = Column(String, ForeignKey("presets.id"), nullable=False)
    preset_name = Column(String, nullable=False)
    system_quantity = Column(Float, nullable=False)      # Evidenční stav
    physical_quantity = Column(Float, nullable=False)    # Skutečný zjištěný stav
    difference = Column(Float, nullable=False)           # physical - system (pos = přebytek, neg = manko)
    unit = Column(String, default="ks", nullable=False)
    unit_cost = Column(Float, default=0.0, nullable=False)  # Pořizovací cena / VAP
    total_cost_impact = Column(Float, default=0.0, nullable=False)  # difference * unit_cost

    audit = relationship("InventoryAuditModel", back_populates="items")


class DepositMovementModel(Base):
    """DB Model for Returnable Deposit Packaging Ledger (Lahve & Přepravky)."""
    __tablename__ = "deposit_movements"

    id = Column(String, primary_key=True, index=True)
    container_type = Column(String, nullable=False, index=True)  # 'BOTTLE_3CZK', 'CRATE_100CZK', etc.
    container_name = Column(String, nullable=False)              # "Pivní lahev 0.5l", "Přepravka piva"
    deposit_value = Column(Float, default=3.0, nullable=False)   # 3.0 or 100.0
    movement_type = Column(String, nullable=False, index=True)   # 'SUPPLIER_INTAKE', 'CUSTOMER_RETURN', 'SUPPLIER_DISPATCH', 'ADJUSTMENT'
    quantity_delta = Column(Float, nullable=False)               # + intake/customer return, - dispatch to brewery
    total_value = Column(Float, nullable=False)                  # quantity_delta * deposit_value
    document_ref = Column(String, nullable=True)                 # Delivery note or receipt ref
    supplier_ico = Column(String, nullable=True)
    note = Column(String, nullable=True)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
