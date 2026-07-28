from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, JSON, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base


class SaleModel(Base):
    """DB Model for Sales Ledger Transactions."""
    __tablename__ = "sales"

    id = Column(String, primary_key=True, index=True)
    receipt_number = Column(String, index=True, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)
    total_amount = Column(Float, nullable=False)
    cart_discount_percent = Column(Float, default=0.0)
    payment_method = Column(String, nullable=False)  # 'cash', 'card', 'qr', 'split'
    split_details = Column(JSON, nullable=True)     # {'cash': 500, 'card': 1000}
    tendered_amount = Column(Float, default=0.0)
    change_due = Column(Float, default=0.0)
    tax_summary = Column(JSON, nullable=False)       # Grouped VAT breakdown
    fik_code = Column(String, nullable=True)          # Czech EET FIK code
    bkp_code = Column(String, nullable=True)          # Czech EET BKP code

    items = relationship("SaleItemModel", back_populates="sale", cascade="all, delete-orphan")


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
    store_name = Column(String, default="Himmel Home s.r.o.")
    street = Column(String, default="Václavské náměstí 15")
    city = Column(String, default="110 00 Praha 1")
    ico = Column(String, default="12345678")
    dic = Column(String, default="CZ12345678")
    register_no = Column(String, default="Pokladna #01")
    default_vat = Column(Integer, default=21)
    receipt_footer = Column(String, default="Děkujeme za váš nákup!")
    printer_interface = Column(String, default="USB") # 'USB', 'NETWORK', 'SERIAL'
    printer_address = Column(String, default="/dev/usb/lp0")
