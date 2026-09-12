"""
Resilient, Decimal-Safe SQLite Snapshot Reader for VoltFlow POS (pos_store.db).

Provides read-only queries with immutable mode, PRAGMA quick_check health validation,
and safe empty fallbacks if the database snapshot is missing or corrupted.
Strictly adheres to Czech accounting domain invariants (Decimal 2 places, Base + VAT = Total).
"""

import os
import sqlite3
import json
import logging
import urllib.request
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional, Dict, Any, List
from contextlib import contextmanager

try:
    from backend_cloud.database import SNAPSHOT_DB_PATH
except ImportError:
    try:
        from database import SNAPSHOT_DB_PATH
    except ImportError:
        default_data = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
        SNAPSHOT_DB_PATH = os.path.join(os.getenv("DATA_DIR", default_data), "snapshot", "pos_store.db")

logger = logging.getLogger("snapshot-service")

TWO_PLACES = Decimal("0.01")


def to_dec(val: Any) -> Decimal:
    """Safely converts input to Decimal, returning Decimal('0.00') on failure."""
    if val is None:
        return Decimal("0.00")
    if isinstance(val, Decimal):
        return val
    try:
        return Decimal(str(val))
    except Exception:
        return Decimal("0.00")


def round_dec(val: Decimal) -> Decimal:
    """Rounds Decimal using Czech standard ROUND_HALF_UP to 2 decimal places."""
    return val.quantize(TWO_PLACES, rounding=ROUND_HALF_UP)


def format_dec(val: Any) -> str:
    """Formats Decimal value to string with exactly 2 decimal places."""
    return str(round_dec(to_dec(val)))


def parse_dt(val: Any) -> Optional[datetime]:
    """Parses SQLite timestamp into standard datetime."""
    if not val:
        return None
    if isinstance(val, datetime):
        return val
    val_str = str(val).strip()
    for fmt in (
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%d %H:%M:%S.%f",
        "%Y-%m-%dT%H:%M:%S.%f",
        "%Y-%m-%d",
    ):
        try:
            raw = val_str[:19] if (" " in val_str or "T" in val_str) else val_str[:10]
            if "T" in raw and "T" not in fmt:
                raw = raw.replace("T", " ")
            return datetime.strptime(raw, fmt)
        except ValueError:
            continue
    return None


class SnapshotService:
    """
    Reader service for pos_store.db SQLite snapshots.
    Guarantees non-locking read access with immutable=1 and mode=ro.
    """

    def __init__(self, db_path: Optional[str] = None):
        self.db_path = db_path or SNAPSHOT_DB_PATH

    def _get_uri(self) -> str:
        """Constructs SQLite file URI with ro and immutable flags."""
        abs_path = os.path.abspath(self.db_path)
        url_path = urllib.request.pathname2url(abs_path)
        return f"file:{url_path}?mode=ro&immutable=1"

    @contextmanager
    def get_connection(self):
        """Context manager providing a read-only SQLite connection."""
        uri = self._get_uri()
        conn = sqlite3.connect(uri, uri=True, timeout=5.0)
        conn.row_factory = sqlite3.Row
        try:
            yield conn
        finally:
            conn.close()

    def _table_exists(self, conn: sqlite3.Connection, table_name: str) -> bool:
        """Checks if a table exists in the SQLite snapshot."""
        try:
            cursor = conn.cursor()
            cursor.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?", (table_name,))
            return cursor.fetchone() is not None
        except Exception:
            return False

    def is_available(self) -> bool:
        """
        Validates whether the snapshot DB exists, is non-zero in size, and passes quick_check.
        Returns False if missing, empty, or corrupted.
        """
        if not self.db_path or not os.path.exists(self.db_path) or not os.path.isfile(self.db_path):
            return False
        try:
            if os.path.getsize(self.db_path) == 0:
                return False
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("PRAGMA quick_check;")
                row = cursor.fetchone()
                if not row or row[0] != "ok":
                    return False
            return True
        except Exception:
            return False

    def check_health(self) -> Dict[str, Any]:
        """
        Checks health of the snapshot file.
        Returns {"available": bool, "last_sync": str, "file_size": int, "error": Optional[str]}
        """
        if not self.db_path or not os.path.exists(self.db_path):
            return {
                "available": False,
                "last_sync": "",
                "file_size": 0,
                "error": "Snapshot database file does not exist",
            }
        if not os.path.isfile(self.db_path):
            return {
                "available": False,
                "last_sync": "",
                "file_size": 0,
                "error": "Snapshot database path is not a file",
            }
        file_size = os.path.getsize(self.db_path)
        if file_size == 0:
            return {
                "available": False,
                "last_sync": "",
                "file_size": 0,
                "error": "Snapshot database file is 0 bytes (empty)",
            }

        mtime = os.path.getmtime(self.db_path)
        last_sync = datetime.fromtimestamp(mtime, tz=timezone.utc).isoformat()

        try:
            with self.get_connection() as conn:
                cursor = conn.cursor()
                cursor.execute("PRAGMA quick_check;")
                row = cursor.fetchone()
                if not row or row[0] != "ok":
                    return {
                        "available": False,
                        "last_sync": last_sync,
                        "file_size": file_size,
                        "error": f"Database corruption detected: {row}",
                    }
                # Check for cloud backup sync time if available in store_config
                if self._table_exists(conn, "store_config"):
                    try:
                        cursor.execute("SELECT cloud_backup_last_sync FROM store_config LIMIT 1")
                        cfg = cursor.fetchone()
                        if cfg and cfg["cloud_backup_last_sync"]:
                            last_sync = cfg["cloud_backup_last_sync"]
                    except Exception:
                        pass
            return {
                "available": True,
                "last_sync": last_sync,
                "file_size": file_size,
                "error": None,
            }
        except Exception as e:
            return {
                "available": False,
                "last_sync": last_sync,
                "file_size": file_size,
                "error": str(e),
            }

    def get_kpi_summary(self) -> Dict[str, Any]:
        """
        Calculates high-level financial KPIs: gross revenue, net revenue, realized gross profit,
        margins, receipt count, AOV, and live cash drawer balance.
        """
        health = self.check_health()
        default_kpi = {
            "gross_revenue": "0.00",
            "net_revenue": "0.00",
            "realized_gross_profit": "0.00",
            "margin_percent": "0.00",
            "margins": "0.00",
            "receipt_count": 0,
            "total_receipt_count": 0,
            "aov": "0.00",
            "cash_drawer_balance": "0.00",
            "last_sync_time": health["last_sync"],
        }
        if not self.is_available():
            return default_kpi

        try:
            with self.get_connection() as conn:
                if not self._table_exists(conn, "sales"):
                    return default_kpi

                cursor = conn.cursor()
                cursor.execute(
                    """
                    SELECT id, receipt_number, timestamp, total_amount,
                           payment_method, split_details, tax_summary,
                           is_refund, refunded_amount
                    FROM sales
                    """
                )
                sales = cursor.fetchall()

                # Sale items map
                items_by_sale: Dict[str, List[sqlite3.Row]] = {}
                if self._table_exists(conn, "sale_items"):
                    cursor.execute("SELECT sale_id, item_id, name, price, quantity, vat FROM sale_items")
                    for it in cursor.fetchall():
                        items_by_sale.setdefault(it["sale_id"], []).append(it)

                # Presets map for COGS
                presets_by_id: Dict[str, sqlite3.Row] = {}
                presets_by_name: Dict[str, sqlite3.Row] = {}
                if self._table_exists(conn, "presets"):
                    cursor.execute("SELECT id, name, cost_price FROM presets")
                    for p in cursor.fetchall():
                        presets_by_id[p["id"]] = p
                        presets_by_name[p["name"]] = p

                gross_sales = Decimal("0.00")
                total_refunds = Decimal("0.00")
                receipt_count = 0
                net_sales = Decimal("0.00")
                total_cogs = Decimal("0.00")

                for s in sales:
                    total_amt = to_dec(s["total_amount"])
                    ref_amt = to_dec(s["refunded_amount"])
                    is_ref = bool(s["is_refund"])

                    tax_sum = None
                    if s["tax_summary"]:
                        if isinstance(s["tax_summary"], str):
                            try:
                                tax_sum = json.loads(s["tax_summary"])
                            except Exception:
                                pass
                        elif isinstance(s["tax_summary"], dict):
                            tax_sum = s["tax_summary"]

                    sale_net = Decimal("0.00")
                    extracted = False
                    if tax_sum and isinstance(tax_sum, dict):
                        for rate_key in (21, "21", 12, "12", 0, "0"):
                            entry = tax_sum.get(rate_key)
                            if isinstance(entry, dict):
                                n = to_dec(entry.get("net", entry.get("base", 0.0)))
                                sale_net += n
                                extracted = True

                    if not extracted:
                        s_items = items_by_sale.get(s["id"], [])
                        if s_items:
                            for it in s_items:
                                i_gross = round_dec(to_dec(it["price"]) * to_dec(it["quantity"]))
                                i_vat = it["vat"] if it["vat"] is not None else 21
                                if i_vat == 21:
                                    i_net = round_dec(i_gross / Decimal("1.21"))
                                elif i_vat == 12:
                                    i_net = round_dec(i_gross / Decimal("1.12"))
                                else:
                                    i_net = i_gross
                                sale_net += i_net
                        else:
                            sale_net = round_dec(total_amt / Decimal("1.21"))

                    # COGS for this sale
                    sale_cogs = Decimal("0.00")
                    s_items = items_by_sale.get(s["id"], [])
                    for it in s_items:
                        it_qty = to_dec(it["quantity"])
                        p = presets_by_id.get(it["item_id"]) or presets_by_name.get(it["name"])
                        if p and p["cost_price"]:
                            sale_cogs += round_dec(it_qty * to_dec(p["cost_price"]))

                    if is_ref:
                        total_refunds += abs(total_amt)
                        net_sales -= abs(sale_net)
                        total_cogs -= abs(sale_cogs)
                    else:
                        receipt_count += 1
                        gross_sales += total_amt
                        total_refunds += abs(ref_amt)
                        if total_amt > Decimal("0.00") and ref_amt > Decimal("0.00"):
                            refund_ratio = min(Decimal("1.00"), ref_amt / total_amt)
                            sale_net -= round_dec(sale_net * refund_ratio)
                        net_sales += sale_net
                        total_cogs += sale_cogs

                gross_revenue = max(Decimal("0.00"), round_dec(gross_sales - total_refunds))
                net_revenue = max(Decimal("0.00"), round_dec(net_sales))
                total_cogs = max(Decimal("0.00"), round_dec(total_cogs))
                realized_gross_profit = round_dec(net_revenue - total_cogs)

                if net_revenue > Decimal("0.00"):
                    margin_pct = round_dec((realized_gross_profit / net_revenue) * Decimal("100.00"))
                else:
                    margin_pct = Decimal("0.00")

                aov = (
                    round_dec(gross_revenue / Decimal(receipt_count))
                    if receipt_count > 0
                    else Decimal("0.00")
                )

                # Cash drawer balance computation
                cash_drawer_balance = Decimal("0.00")
                if self._table_exists(conn, "shift_sessions"):
                    cursor.execute(
                        """
                        SELECT id, opening_cash, opened_at
                        FROM shift_sessions
                        WHERE is_closed = 0
                        ORDER BY opened_at DESC
                        LIMIT 1
                        """
                    )
                    open_shift = cursor.fetchone()
                    if open_shift:
                        opening_cash = to_dec(open_shift["opening_cash"])
                        shift_opened = open_shift["opened_at"]

                        cursor.execute(
                            """
                            SELECT total_amount, payment_method, split_details, is_refund
                            FROM sales
                            WHERE timestamp >= ?
                            """,
                            (shift_opened,),
                        )
                        shift_sales = cursor.fetchall()

                        shift_cash_sales = Decimal("0.00")
                        shift_cash_refunds = Decimal("0.00")
                        for ss in shift_sales:
                            pm = (ss["payment_method"] or "cash").lower()
                            amt = to_dec(ss["total_amount"])
                            c_part = Decimal("0.00")
                            if pm in ("cash", "hotovost"):
                                c_part = amt
                            elif pm == "split" and ss["split_details"]:
                                sp = {}
                                if isinstance(ss["split_details"], str):
                                    try:
                                        sp = json.loads(ss["split_details"])
                                    except Exception:
                                        pass
                                elif isinstance(ss["split_details"], dict):
                                    sp = ss["split_details"]
                                c_part = to_dec(sp.get("cash", sp.get("hotovost", 0.0)))

                            if bool(ss["is_refund"]):
                                shift_cash_refunds += abs(c_part)
                            else:
                                shift_cash_sales += c_part

                        float_in = Decimal("0.00")
                        payouts = Decimal("0.00")
                        safe_drops = Decimal("0.00")
                        if self._table_exists(conn, "cash_movements"):
                            cursor.execute(
                                """
                                SELECT movement_type, amount
                                FROM cash_movements
                                WHERE shift_id = ?
                                """,
                                (open_shift["id"],),
                            )
                            for m in cursor.fetchall():
                                m_type = (m["movement_type"] or "").upper()
                                m_amt = to_dec(m["amount"])
                                if m_type == "FLOAT_IN":
                                    float_in += m_amt
                                elif m_type == "PAYOUT":
                                    payouts += m_amt
                                elif m_type == "SAFE_DROP":
                                    safe_drops += m_amt

                        cash_drawer_balance = round_dec(
                            opening_cash
                            + shift_cash_sales
                            - shift_cash_refunds
                            + float_in
                            - payouts
                            - safe_drops
                        )
                    else:
                        cursor.execute(
                            """
                            SELECT actual_cash, expected_cash
                            FROM shift_sessions
                            ORDER BY closed_at DESC, opened_at DESC
                            LIMIT 1
                            """
                        )
                        last_shift = cursor.fetchone()
                        if last_shift:
                            if last_shift["actual_cash"] is not None:
                                cash_drawer_balance = round_dec(to_dec(last_shift["actual_cash"]))
                            else:
                                cash_drawer_balance = round_dec(to_dec(last_shift["expected_cash"]))

                return {
                    "gross_revenue": format_dec(gross_revenue),
                    "net_revenue": format_dec(net_revenue),
                    "realized_gross_profit": format_dec(realized_gross_profit),
                    "margin_percent": format_dec(margin_pct),
                    "margins": format_dec(margin_pct),
                    "receipt_count": receipt_count,
                    "total_receipt_count": receipt_count,
                    "aov": format_dec(aov),
                    "cash_drawer_balance": format_dec(cash_drawer_balance),
                    "last_sync_time": health["last_sync"],
                }
        except Exception as e:
            logger.error(f"Error calculating KPI summary: {e}")
            return default_kpi

    def get_payment_splits(self) -> Dict[str, str]:
        """
        Calculates net revenue distribution across payment methods (cash, card, qr, split).
        """
        default_splits = {
            "cash": "0.00",
            "card": "0.00",
            "qr": "0.00",
            "split": "0.00",
            "total": "0.00",
        }
        if not self.is_available():
            return default_splits

        try:
            with self.get_connection() as conn:
                if not self._table_exists(conn, "sales"):
                    return default_splits

                cursor = conn.cursor()
                cursor.execute(
                    """
                    SELECT total_amount, payment_method, split_details, is_refund, refunded_amount
                    FROM sales
                    """
                )
                rows = cursor.fetchall()

                cash_dec = Decimal("0.00")
                card_dec = Decimal("0.00")
                qr_dec = Decimal("0.00")
                split_dec = Decimal("0.00")

                for r in rows:
                    amt = to_dec(r["total_amount"])
                    ref_amt = to_dec(r["refunded_amount"])
                    pm = (r["payment_method"] or "cash").lower()
                    is_ref = bool(r["is_refund"])

                    if is_ref:
                        factor = Decimal("-1.00")
                        amt = abs(amt)
                    else:
                        factor = Decimal("1.00")
                        amt = amt - ref_amt

                    if pm in ("cash", "hotovost"):
                        cash_dec += factor * amt
                    elif pm in ("card", "karta"):
                        card_dec += factor * amt
                    elif pm in ("qr", "qr_platba", "bank"):
                        qr_dec += factor * amt
                    elif pm == "split":
                        sp = {}
                        if r["split_details"]:
                            if isinstance(r["split_details"], str):
                                try:
                                    sp = json.loads(r["split_details"])
                                except Exception:
                                    pass
                            elif isinstance(r["split_details"], dict):
                                sp = r["split_details"]
                        if sp:
                            c_part = to_dec(sp.get("cash", sp.get("hotovost", 0.0)))
                            k_part = to_dec(sp.get("card", sp.get("karta", 0.0)))
                            q_part = to_dec(sp.get("qr", 0.0))
                            cash_dec += factor * c_part
                            card_dec += factor * k_part
                            qr_dec += factor * q_part
                        else:
                            split_dec += factor * amt
                    else:
                        cash_dec += factor * amt

                tot = cash_dec + card_dec + qr_dec + split_dec
                return {
                    "cash": format_dec(cash_dec),
                    "card": format_dec(card_dec),
                    "qr": format_dec(qr_dec),
                    "split": format_dec(split_dec),
                    "total": format_dec(tot),
                }
        except Exception as e:
            logger.error(f"Error calculating payment splits: {e}")
            return default_splits

    def get_zreports(self, limit: int = 50) -> List[Dict[str, Any]]:
        """
        Returns recent Z-Reports / shift session summaries.
        """
        if not self.is_available():
            return []
        try:
            with self.get_connection() as conn:
                if not self._table_exists(conn, "shift_sessions"):
                    return []
                cursor = conn.cursor()
                cursor.execute(
                    """
                    SELECT id, shift_number, z_seq, opened_at, closed_at,
                           opening_cash, expected_cash, actual_cash, discrepancy, is_closed
                    FROM shift_sessions
                    ORDER BY z_seq DESC, opened_at DESC
                    LIMIT ?
                    """,
                    (limit,),
                )
                rows = cursor.fetchall()
                return [
                    {
                        "id": r["id"],
                        "shift_number": r["shift_number"],
                        "z_seq": r["z_seq"],
                        "opened_at": str(r["opened_at"]) if r["opened_at"] else None,
                        "closed_at": str(r["closed_at"]) if r["closed_at"] else None,
                        "opening_cash": format_dec(r["opening_cash"]),
                        "expected_cash": format_dec(r["expected_cash"]),
                        "actual_cash": format_dec(r["actual_cash"]) if r["actual_cash"] is not None else None,
                        "discrepancy": format_dec(r["discrepancy"]) if r["discrepancy"] is not None else None,
                        "is_closed": bool(r["is_closed"]),
                    }
                    for r in rows
                ]
        except Exception as e:
            logger.error(f"Error retrieving zreports: {e}")
            return []

    def get_catalog(
        self,
        search: Optional[str] = None,
        category: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> Dict[str, Any]:
        """
        Returns catalog products from presets table with optional search and category filters.
        """
        default_catalog = {"items": [], "total": 0}
        if not self.is_available():
            return default_catalog

        try:
            with self.get_connection() as conn:
                if not self._table_exists(conn, "presets"):
                    return default_catalog

                cursor = conn.cursor()
                where_clauses = []
                params = []
                if search:
                    where_clauses.append("(name LIKE ? OR barcode LIKE ?)")
                    patt = f"%{search.strip()}%"
                    params.extend([patt, patt])
                if category:
                    where_clauses.append("category = ?")
                    params.append(category.strip())

                where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""

                cursor.execute(f"SELECT COUNT(*) FROM presets {where_sql}", tuple(params))
                total = cursor.fetchone()[0]

                cursor.execute(
                    f"""
                    SELECT id, name, price, cost_price, vat, category,
                           stock_quantity, track_stock, barcode, unit, margin_coefficient
                    FROM presets
                    {where_sql}
                    ORDER BY name ASC
                    LIMIT ? OFFSET ?
                    """,
                    tuple(params + [limit, offset]),
                )
                rows = cursor.fetchall()
                items = [
                    {
                        "id": r["id"],
                        "name": r["name"],
                        "price": format_dec(r["price"]),
                        "cost_price": format_dec(r["cost_price"]),
                        "vat": int(r["vat"]) if r["vat"] is not None else 21,
                        "category": r["category"] or "custom",
                        "stock_quantity": float(r["stock_quantity"] or 0.0),
                        "track_stock": bool(r["track_stock"]),
                        "barcode": r["barcode"] or "",
                        "unit": r["unit"] or "ks",
                        "margin_coefficient": (
                            float(r["margin_coefficient"])
                            if r["margin_coefficient"] is not None
                            else None
                        ),
                    }
                    for r in rows
                ]
                return {"items": items, "total": total}
        except Exception as e:
            logger.error(f"Error retrieving catalog: {e}")
            return default_catalog

    def get_top_profit(self, limit: int = 10) -> List[Dict[str, Any]]:
        """
        Returns items generating the highest total profit.
        """
        if not self.is_available():
            return []

        try:
            with self.get_connection() as conn:
                if not self._table_exists(conn, "sale_items") or not self._table_exists(conn, "sales"):
                    return []

                cursor = conn.cursor()
                query = """
                    SELECT si.name, si.item_id, si.price, si.quantity, si.vat,
                           p.cost_price
                    FROM sale_items si
                    JOIN sales s ON si.sale_id = s.id
                    LEFT JOIN presets p ON (si.item_id = p.id OR si.name = p.name)
                    WHERE s.is_refund = 0
                """
                cursor.execute(query)
                rows = cursor.fetchall()

                profits: Dict[str, Dict[str, Any]] = {}
                for r in rows:
                    name = r["name"]
                    qty = to_dec(r["quantity"])
                    gross_unit = to_dec(r["price"])
                    vat = int(r["vat"]) if r["vat"] is not None else 21
                    cost = to_dec(r["cost_price"]) if r["cost_price"] is not None else Decimal("0.00")

                    if vat == 21:
                        net_unit = round_dec(gross_unit / Decimal("1.21"))
                    elif vat == 12:
                        net_unit = round_dec(gross_unit / Decimal("1.12"))
                    else:
                        net_unit = gross_unit

                    line_profit = round_dec((net_unit - cost) * qty)
                    line_rev = round_dec(gross_unit * qty)

                    if name not in profits:
                        profits[name] = {
                            "profit": Decimal("0.00"),
                            "quantity": Decimal("0.00"),
                            "revenue": Decimal("0.00"),
                        }
                    profits[name]["profit"] += line_profit
                    profits[name]["quantity"] += qty
                    profits[name]["revenue"] += line_rev

                sorted_items = sorted(
                    profits.items(),
                    key=lambda x: x[1]["profit"],
                    reverse=True,
                )[:limit]

                return [
                    {
                        "product": name,
                        "profit": format_dec(data["profit"]),
                        "quantity": float(data["quantity"]),
                        "revenue": format_dec(data["revenue"]),
                    }
                    for name, data in sorted_items
                ]
        except Exception as e:
            logger.error(f"Error calculating top profit: {e}")
            return []

    def get_volume_drivers(self, limit: int = 10) -> List[Dict[str, Any]]:
        """
        Returns top products by sales volume (quantity sold).
        """
        if not self.is_available():
            return []

        try:
            with self.get_connection() as conn:
                if not self._table_exists(conn, "sale_items") or not self._table_exists(conn, "sales"):
                    return []

                cursor = conn.cursor()
                query = """
                    SELECT si.name, SUM(si.quantity) as total_qty, SUM(si.price * si.quantity) as total_rev
                    FROM sale_items si
                    JOIN sales s ON si.sale_id = s.id
                    WHERE s.is_refund = 0
                    GROUP BY si.name
                    ORDER BY total_qty DESC
                    LIMIT ?
                """
                cursor.execute(query, (limit,))
                rows = cursor.fetchall()
                return [
                    {
                        "product": r["name"],
                        "quantity": float(r["total_qty"] or 0.0),
                        "revenue": format_dec(r["total_rev"]),
                    }
                    for r in rows
                ]
        except Exception as e:
            logger.error(f"Error calculating volume drivers: {e}")
            return []

    def get_dead_stock(self, days: int = 30, as_of: Optional[datetime] = None) -> List[Dict[str, Any]]:
        """
        Identifies inventory with positive stock quantity that has not sold in the specified days.
        """
        if not self.is_available():
            return []

        try:
            ref_time = as_of or datetime.now()
            with self.get_connection() as conn:
                if not self._table_exists(conn, "presets"):
                    return []

                cursor = conn.cursor()
                cursor.execute(
                    """
                    SELECT id, name, cost_price, stock_quantity, track_stock
                    FROM presets
                    WHERE stock_quantity > 0
                    """
                )
                presets = cursor.fetchall()

                last_sales: Dict[str, datetime] = {}
                if self._table_exists(conn, "sale_items") and self._table_exists(conn, "sales"):
                    cursor.execute(
                        """
                        SELECT si.item_id, si.name, MAX(s.timestamp) as max_ts
                        FROM sale_items si
                        JOIN sales s ON si.sale_id = s.id
                        WHERE s.is_refund = 0
                        GROUP BY si.item_id, si.name
                        """
                    )
                    for r in cursor.fetchall():
                        ts = parse_dt(r["max_ts"])
                        if ts:
                            if r["item_id"]:
                                last_sales[r["item_id"]] = max(last_sales.get(r["item_id"], ts), ts)
                            if r["name"]:
                                last_sales[r["name"]] = max(last_sales.get(r["name"], ts), ts)

                dead_list = []
                for p in presets:
                    p_id = p["id"]
                    p_name = p["name"]
                    last_dt = last_sales.get(p_id) or last_sales.get(p_name)

                    if last_dt is None:
                        days_in_stock = days
                    else:
                        days_in_stock = max(0, (ref_time - last_dt).days)

                    if days_in_stock >= days:
                        stock_qty = float(p["stock_quantity"] or 0.0)
                        cost = to_dec(p["cost_price"])
                        idle_capital = round_dec(to_dec(stock_qty) * cost)
                        dead_list.append({
                            "product": p_name,
                            "stock_quantity": stock_qty,
                            "days_in_stock": days_in_stock,
                            "cost_price": format_dec(cost),
                            "idle_capital": format_dec(idle_capital),
                        })

                dead_list.sort(key=lambda x: to_dec(x["idle_capital"]), reverse=True)
                return dead_list
        except Exception as e:
            logger.error(f"Error calculating dead stock: {e}")
            return []

    def get_margin_alerts(self) -> List[Dict[str, Any]]:
        """
        Identifies products with negative margins or low margins (<10%).
        """
        if not self.is_available():
            return []

        try:
            with self.get_connection() as conn:
                if not self._table_exists(conn, "presets"):
                    return []

                cursor = conn.cursor()
                cursor.execute(
                    """
                    SELECT id, name, price, cost_price, vat
                    FROM presets
                    WHERE cost_price > 0 AND price > 0
                    """
                )
                rows = cursor.fetchall()
                alerts = []
                for r in rows:
                    price = to_dec(r["price"])
                    cost = to_dec(r["cost_price"])
                    vat = int(r["vat"]) if r["vat"] is not None else 21

                    if vat == 21:
                        net_selling = round_dec(price / Decimal("1.21"))
                    elif vat == 12:
                        net_selling = round_dec(price / Decimal("1.12"))
                    else:
                        net_selling = price

                    profit = net_selling - cost
                    if net_selling > Decimal("0.00"):
                        margin_pct = round_dec((profit / net_selling) * Decimal("100.00"))
                    else:
                        margin_pct = Decimal("-100.00")

                    if profit <= Decimal("0.00"):
                        alerts.append({
                            "product": r["name"],
                            "price": format_dec(price),
                            "cost_price": format_dec(cost),
                            "vat": vat,
                            "margin_percent": format_dec(margin_pct),
                            "issue": "NEGATIVE_MARGIN",
                        })
                    elif margin_pct < Decimal("10.00"):
                        alerts.append({
                            "product": r["name"],
                            "price": format_dec(price),
                            "cost_price": format_dec(cost),
                            "vat": vat,
                            "margin_percent": format_dec(margin_pct),
                            "issue": "LOW_MARGIN",
                        })
                alerts.sort(key=lambda x: to_dec(x["margin_percent"]))
                return alerts
        except Exception as e:
            logger.error(f"Error calculating margin alerts: {e}")
            return []

    def get_hourly_heatmap(self) -> Dict[str, List[int]]:
        """
        Returns distribution of transactions by day of week (monday-sunday) and hour of day (0-23).
        """
        days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
        default_heatmap = {d: [0] * 24 for d in days}
        if not self.is_available():
            return default_heatmap

        try:
            with self.get_connection() as conn:
                if not self._table_exists(conn, "sales"):
                    return default_heatmap

                cursor = conn.cursor()
                cursor.execute("SELECT timestamp FROM sales WHERE is_refund = 0")
                rows = cursor.fetchall()

                heatmap = {d: [0] * 24 for d in days}
                for r in rows:
                    dt = parse_dt(r["timestamp"])
                    if dt:
                        d_name = days[dt.weekday()]
                        h = dt.hour
                        if 0 <= h < 24:
                            heatmap[d_name][h] += 1
                return heatmap
        except Exception as e:
            logger.error(f"Error calculating hourly heatmap: {e}")
            return default_heatmap

    def get_dph_summary(
        self,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
    ) -> Dict[str, str]:
        """
        Calculates tax bases and VAT amounts for Czech tiers (21%, 12%, 0%).
        Strictly guarantees: Base + VAT strictly equals Total.
        """
        default_dph = {
            "base_21": "0.00",
            "tax_21": "0.00",
            "base_12": "0.00",
            "tax_12": "0.00",
            "base_0": "0.00",
            "tax_0": "0.00",
            "total_base": "0.00",
            "total_tax": "0.00",
            "total_gross": "0.00",
        }
        if not self.is_available():
            return default_dph

        try:
            with self.get_connection() as conn:
                if not self._table_exists(conn, "sales"):
                    return default_dph

                cursor = conn.cursor()
                where_clauses = []
                params = []
                if start_date:
                    where_clauses.append("timestamp >= ?")
                    params.append(start_date)
                if end_date:
                    where_clauses.append("timestamp <= ?")
                    params.append(end_date)

                where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""
                cursor.execute(
                    f"""
                    SELECT id, total_amount, tax_summary, is_refund, refunded_amount, timestamp
                    FROM sales
                    {where_sql}
                    """,
                    tuple(params),
                )
                sales = cursor.fetchall()

                has_items = self._table_exists(conn, "sale_items")
                items_by_sale: Dict[str, List[sqlite3.Row]] = {}
                if has_items and sales:
                    sale_ids = [s["id"] for s in sales]
                    for i in range(0, len(sale_ids), 500):
                        chunk = sale_ids[i:i + 500]
                        placeholders = ",".join("?" * len(chunk))
                        cursor.execute(
                            f"SELECT sale_id, price, quantity, vat FROM sale_items WHERE sale_id IN ({placeholders})",
                            tuple(chunk),
                        )
                        for it in cursor.fetchall():
                            items_by_sale.setdefault(it["sale_id"], []).append(it)

                base_21 = Decimal("0.00")
                tax_21 = Decimal("0.00")
                base_12 = Decimal("0.00")
                tax_12 = Decimal("0.00")
                base_0 = Decimal("0.00")
                tax_0 = Decimal("0.00")

                for s in sales:
                    is_ref = bool(s["is_refund"])
                    factor = Decimal("-1.00") if is_ref else Decimal("1.00")

                    tax_sum = None
                    if s["tax_summary"]:
                        if isinstance(s["tax_summary"], str):
                            try:
                                tax_sum = json.loads(s["tax_summary"])
                            except Exception:
                                pass
                        elif isinstance(s["tax_summary"], dict):
                            tax_sum = s["tax_summary"]

                    extracted = False
                    if tax_sum and isinstance(tax_sum, dict):
                        e21 = tax_sum.get(21) or tax_sum.get("21")
                        if isinstance(e21, dict):
                            b = round_dec(to_dec(e21.get("net", e21.get("base", 0.0))))
                            t = round_dec(to_dec(e21.get("tax", e21.get("vat", 0.0))))
                            base_21 += factor * b
                            tax_21 += factor * t
                            extracted = True

                        e12 = tax_sum.get(12) or tax_sum.get("12")
                        if isinstance(e12, dict):
                            b = round_dec(to_dec(e12.get("net", e12.get("base", 0.0))))
                            t = round_dec(to_dec(e12.get("tax", e12.get("vat", 0.0))))
                            base_12 += factor * b
                            tax_12 += factor * t
                            extracted = True

                        e0 = tax_sum.get(0) or tax_sum.get("0")
                        if isinstance(e0, dict):
                            b = round_dec(to_dec(e0.get("net", e0.get("base", 0.0))))
                            t = round_dec(to_dec(e0.get("tax", e0.get("vat", 0.0))))
                            base_0 += factor * b
                            tax_0 += factor * t
                            extracted = True

                    if not extracted:
                        s_items = items_by_sale.get(s["id"], [])
                        if s_items:
                            for it in s_items:
                                i_gross = round_dec(to_dec(it["price"]) * to_dec(it["quantity"]))
                                i_vat = it["vat"] if it["vat"] is not None else 21
                                if i_vat == 21:
                                    i_net = round_dec(i_gross / Decimal("1.21"))
                                    i_tax = i_gross - i_net
                                    base_21 += factor * i_net
                                    tax_21 += factor * i_tax
                                elif i_vat == 12:
                                    i_net = round_dec(i_gross / Decimal("1.12"))
                                    i_tax = i_gross - i_net
                                    base_12 += factor * i_net
                                    tax_12 += factor * i_tax
                                else:
                                    base_0 += factor * i_gross
                        else:
                            tot = round_dec(to_dec(s["total_amount"]))
                            net = round_dec(tot / Decimal("1.21"))
                            tax = tot - net
                            base_21 += factor * net
                            tax_21 += factor * tax

                tot_base = base_21 + base_12 + base_0
                tot_tax = tax_21 + tax_12 + tax_0
                tot_gross = tot_base + tot_tax

                return {
                    "base_21": format_dec(base_21),
                    "tax_21": format_dec(tax_21),
                    "base_12": format_dec(base_12),
                    "tax_12": format_dec(tax_12),
                    "base_0": format_dec(base_0),
                    "tax_0": format_dec(tax_0),
                    "total_base": format_dec(tot_base),
                    "total_tax": format_dec(tot_tax),
                    "total_gross": format_dec(tot_gross),
                }
        except Exception as e:
            logger.error(f"Error calculating DPH summary: {e}")
            return default_dph

    def get_pohoda_records(
        self,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """
        Extracts sales records with VAT breakdown and line items for Stormware POHODA XML export.
        """
        if not self.is_available():
            return []

        try:
            with self.get_connection() as conn:
                if not self._table_exists(conn, "sales"):
                    return []

                cursor = conn.cursor()
                where_clauses = []
                params = []
                if start_date:
                    where_clauses.append("timestamp >= ?")
                    params.append(start_date)
                if end_date:
                    where_clauses.append("timestamp <= ?")
                    params.append(end_date)

                where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""

                cursor.execute(
                    f"""
                    SELECT id, receipt_number, timestamp, total_amount, payment_method,
                           tax_summary, is_refund, refunded_amount,
                           is_invoice, invoice_number, customer_ico, customer_dic,
                           customer_name, customer_address
                    FROM sales
                    {where_sql}
                    ORDER BY timestamp ASC
                    """,
                    tuple(params),
                )
                sales = cursor.fetchall()

                has_items = self._table_exists(conn, "sale_items")
                items_by_sale: Dict[str, List[sqlite3.Row]] = {}
                if has_items and sales:
                    sale_ids = [s["id"] for s in sales]
                    for i in range(0, len(sale_ids), 500):
                        chunk = sale_ids[i:i + 500]
                        placeholders = ",".join("?" * len(chunk))
                        cursor.execute(
                            f"""
                            SELECT sale_id, item_id, name, price, quantity, vat
                            FROM sale_items
                            WHERE sale_id IN ({placeholders})
                            """,
                            tuple(chunk),
                        )
                        for it in cursor.fetchall():
                            items_by_sale.setdefault(it["sale_id"], []).append(it)

                records = []
                for s in sales:
                    tot = round_dec(to_dec(s["total_amount"]))
                    price_high = Decimal("0.00")
                    price_high_vat = Decimal("0.00")
                    price_low = Decimal("0.00")
                    price_low_vat = Decimal("0.00")
                    price_none = Decimal("0.00")

                    tax_sum = None
                    if s["tax_summary"]:
                        if isinstance(s["tax_summary"], str):
                            try:
                                tax_sum = json.loads(s["tax_summary"])
                            except Exception:
                                pass
                        elif isinstance(s["tax_summary"], dict):
                            tax_sum = s["tax_summary"]

                    extracted = False
                    if tax_sum and isinstance(tax_sum, dict):
                        e21 = tax_sum.get(21) or tax_sum.get("21")
                        if isinstance(e21, dict):
                            price_high = round_dec(to_dec(e21.get("net", e21.get("base", 0.0))))
                            price_high_vat = round_dec(to_dec(e21.get("tax", e21.get("vat", 0.0))))
                            extracted = True
                        e12 = tax_sum.get(12) or tax_sum.get("12")
                        if isinstance(e12, dict):
                            price_low = round_dec(to_dec(e12.get("net", e12.get("base", 0.0))))
                            price_low_vat = round_dec(to_dec(e12.get("tax", e12.get("vat", 0.0))))
                            extracted = True
                        e0 = tax_sum.get(0) or tax_sum.get("0")
                        if isinstance(e0, dict):
                            price_none = round_dec(to_dec(e0.get("net", e0.get("base", 0.0))))
                            extracted = True

                    s_items = items_by_sale.get(s["id"], [])
                    if not extracted:
                        if s_items:
                            for it in s_items:
                                gross = round_dec(to_dec(it["price"]) * to_dec(it["quantity"]))
                                vat = it["vat"] if it["vat"] is not None else 21
                                if vat == 21:
                                    net = round_dec(gross / Decimal("1.21"))
                                    price_high += net
                                    price_high_vat += (gross - net)
                                elif vat == 12:
                                    net = round_dec(gross / Decimal("1.12"))
                                    price_low += net
                                    price_low_vat += (gross - net)
                                else:
                                    price_none += gross
                        else:
                            price_high = round_dec(tot / Decimal("1.21"))
                            price_high_vat = tot - price_high

                    price_total = (
                        price_high + price_high_vat + price_low + price_low_vat + price_none
                    )

                    formatted_items = [
                        {
                            "item_id": it["item_id"],
                            "name": it["name"],
                            "price": format_dec(it["price"]),
                            "quantity": float(it["quantity"]),
                            "vat": int(it["vat"]) if it["vat"] is not None else 21,
                        }
                        for it in s_items
                    ]

                    records.append({
                        "id": s["id"],
                        "receipt_number": s["receipt_number"],
                        "timestamp": str(s["timestamp"]) if s["timestamp"] else "",
                        "date": str(s["timestamp"])[:10] if s["timestamp"] else "",
                        "total_amount": format_dec(tot),
                        "payment_method": s["payment_method"] or "cash",
                        "is_refund": bool(s["is_refund"]),
                        "refunded_amount": format_dec(s["refunded_amount"]),
                        "is_invoice": bool(s["is_invoice"]),
                        "invoice_number": s["invoice_number"] or "",
                        "customer_ico": s["customer_ico"] or "",
                        "customer_dic": s["customer_dic"] or "",
                        "customer_name": s["customer_name"] or "",
                        "customer_address": s["customer_address"] or "",
                        "price_high": format_dec(price_high),
                        "price_high_vat": format_dec(price_high_vat),
                        "price_low": format_dec(price_low),
                        "price_low_vat": format_dec(price_low_vat),
                        "price_none": format_dec(price_none),
                        "price_total": format_dec(price_total),
                        "items": formatted_items,
                    })
                return records
        except Exception as e:
            logger.error(f"Error retrieving pohoda records: {e}")
            return []


# Global singleton instance pointing to default SNAPSHOT_DB_PATH
snapshot_service = SnapshotService()

# Convenience module-level functions
def is_available() -> bool:
    return snapshot_service.is_available()

def check_health() -> Dict[str, Any]:
    return snapshot_service.check_health()

def get_kpi_summary() -> Dict[str, Any]:
    return snapshot_service.get_kpi_summary()

def get_payment_splits() -> Dict[str, str]:
    return snapshot_service.get_payment_splits()

def get_zreports(limit: int = 50) -> List[Dict[str, Any]]:
    return snapshot_service.get_zreports(limit=limit)

def get_catalog(
    search: Optional[str] = None,
    category: Optional[str] = None,
    limit: int = 100,
    offset: int = 0,
) -> Dict[str, Any]:
    return snapshot_service.get_catalog(search=search, category=category, limit=limit, offset=offset)

def get_top_profit(limit: int = 10) -> List[Dict[str, Any]]:
    return snapshot_service.get_top_profit(limit=limit)

def get_volume_drivers(limit: int = 10) -> List[Dict[str, Any]]:
    return snapshot_service.get_volume_drivers(limit=limit)

def get_dead_stock(days: int = 30, as_of: Optional[datetime] = None) -> List[Dict[str, Any]]:
    return snapshot_service.get_dead_stock(days=days, as_of=as_of)

def get_margin_alerts() -> List[Dict[str, Any]]:
    return snapshot_service.get_margin_alerts()

def get_hourly_heatmap() -> Dict[str, List[int]]:
    return snapshot_service.get_hourly_heatmap()

def get_dph_summary(start_date: Optional[str] = None, end_date: Optional[str] = None) -> Dict[str, str]:
    return snapshot_service.get_dph_summary(start_date=start_date, end_date=end_date)

def get_pohoda_records(start_date: Optional[str] = None, end_date: Optional[str] = None) -> List[Dict[str, Any]]:
    return snapshot_service.get_pohoda_records(start_date=start_date, end_date=end_date)
