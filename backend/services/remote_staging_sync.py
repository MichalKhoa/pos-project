"""
Remote Staging Sync Service for VoltFlow POS Store Register.
Periodically or on boot pulls pending staging batches (products, price adjustments,
supplier intakes) from 24/7 Home Server / Cloud API, commits them to master pos_store.db
with strict idempotency tracking, recalculates Weighted Average Purchase Price (VAP),
and acknowledges completed batches back to the cloud.
"""

import uuid
import logging
from datetime import datetime, timezone
from typing import Optional, Dict, Any, List
import httpx
from sqlalchemy.orm import Session

try:
    from models import (
        StoreConfigModel,
        PresetModel,
        StockMovementModel,
        AppliedSyncEventModel,
    )
    from database import atomic_transaction
except ImportError:
    from backend.models import (
        StoreConfigModel,
        PresetModel,
        StockMovementModel,
        AppliedSyncEventModel,
    )
    from backend.database import atomic_transaction

logger = logging.getLogger("pos-staging-sync")


class RemoteStagingSyncService:
    """Handles bidirectional synchronization between store POS and cloud staging queue."""

    def __init__(self, timeout: float = 10.0):
        self.timeout = timeout

    def sync_pending_batches(
        self,
        db: Session,
        config: Optional[StoreConfigModel] = None,
        client: Optional[httpx.Client] = None,
    ) -> Dict[str, Any]:
        """
        Pulls pending staged batches from cloud and applies them to local pos_store.db.
        """
        if config is None:
            config = db.query(StoreConfigModel).first()

        if not config:
            return {"status": "SKIPPED", "reason": "No store configuration found"}

        if not config.cloud_staging_enabled:
            return {"status": "SKIPPED", "reason": "Cloud staging sync is disabled in config"}

        base_url = (config.cloud_staging_url or "").strip().rstrip("/")
        if not base_url:
            return {"status": "SKIPPED", "reason": "Cloud staging URL is not configured"}

        # Format URL and headers
        pending_url = f"{base_url}/staging/pending"
        ack_url = f"{base_url}/staging/ack"

        headers = {"Accept": "application/json"}
        if config.cloud_staging_token:
            token = config.cloud_staging_token.strip()
            headers["Authorization"] = f"Bearer {token}"
            headers["X-Store-Token"] = token

        # 1. Fetch pending batches from cloud
        own_client = False
        if client is None:
            client = httpx.Client(timeout=self.timeout)
            own_client = True

        try:
            resp = client.get(pending_url, headers=headers)
            if resp.status_code != 200:
                err_msg = f"HTTP {resp.status_code}: {resp.text[:200]}"
                logger.warning(f"Failed to fetch staging batches: {err_msg}")
                config.cloud_staging_last_status = f"ERROR: {err_msg}"
                db.commit()
                return {"status": "ERROR", "error": err_msg}

            data = resp.json()
        except Exception as exc:
            err_msg = str(exc)
            logger.warning(f"Error connecting to cloud staging at {pending_url}: {err_msg}")
            config.cloud_staging_last_status = f"ERROR: {err_msg}"
            db.commit()
            return {"status": "ERROR", "error": err_msg}
        finally:
            if own_client and client:
                client.close()

        pending_products = data.get("products", [])
        pending_prices = data.get("price_changes", [])
        pending_intakes = data.get("intakes", [])

        if not pending_products and not pending_prices and not pending_intakes:
            now_str = datetime.now(timezone.utc).isoformat()
            config.cloud_staging_last_sync = now_str
            config.cloud_staging_last_status = "SUCCESS_EMPTY"
            db.commit()
            return {
                "status": "SUCCESS",
                "message": "No pending batches in cloud queue",
                "applied": {"products": 0, "price_changes": 0, "intakes": 0},
            }

        # 2. Query all existing applied keys to avoid duplicates
        all_keys = [
            item.get("idempotency_key")
            for item in (pending_products + pending_prices + pending_intakes)
            if item.get("idempotency_key")
        ]
        applied_keys_set = set()
        if all_keys:
            rows = (
                db.query(AppliedSyncEventModel.idempotency_key)
                .filter(AppliedSyncEventModel.idempotency_key.in_(all_keys))
                .all()
            )
            applied_keys_set = {r[0] for r in rows}

        now = datetime.now(timezone.utc)
        applied_counts = {"products": 0, "price_changes": 0, "intakes": 0}
        ack_product_ids: List[str] = []
        ack_price_ids: List[str] = []
        ack_intake_ids: List[str] = []

        with atomic_transaction(db):
            # Process Products
            for prd in pending_products:
                prd_id = prd.get("id")
                key = prd.get("idempotency_key")
                if key and key in applied_keys_set:
                    if prd_id:
                        ack_product_ids.append(prd_id)
                    continue

                barcode = (prd.get("barcode") or "").strip()
                name = (prd.get("name") or "").strip()

                preset = None
                if barcode:
                    preset = db.query(PresetModel).filter(PresetModel.barcode == barcode).first()
                if not preset and prd_id:
                    preset = db.query(PresetModel).filter(PresetModel.id == prd_id).first()
                if not preset and name:
                    preset = db.query(PresetModel).filter(PresetModel.name == name).first()

                if preset:
                    if name:
                        preset.name = name
                    if prd.get("price") is not None:
                        preset.price = round(float(prd["price"]), 2)
                    if prd.get("cost_price") is not None:
                        preset.cost_price = round(float(prd["cost_price"]), 2)
                    if prd.get("vat") is not None:
                        preset.vat = int(prd["vat"])
                    if prd.get("category"):
                        preset.category = prd["category"]
                    if prd.get("unit"):
                        preset.unit = prd["unit"]
                    if prd.get("track_stock") is not None:
                        preset.track_stock = bool(prd["track_stock"])
                    if float(preset.stock_quantity or 0.0) == 0.0 and prd.get("stock_quantity") is not None:
                        preset.stock_quantity = float(prd["stock_quantity"])
                    if prd.get("show_in_presets") is not None:
                        preset.show_in_presets = bool(prd["show_in_presets"])
                    if prd.get("color"):
                        preset.color = prd["color"]
                    if prd.get("icon") is not None:
                        preset.icon = prd["icon"]
                    if prd.get("is_weighted") is not None:
                        preset.is_weighted = bool(prd["is_weighted"])
                    if prd.get("is_open_price") is not None:
                        preset.is_open_price = bool(prd["is_open_price"])
                    if prd.get("min_stock_alert") is not None:
                        preset.min_stock_alert = float(prd["min_stock_alert"])
                    if prd.get("margin_coefficient") is not None:
                        preset.margin_coefficient = float(prd["margin_coefficient"])
                else:
                    new_id = prd_id or f"preset_{uuid.uuid4().hex[:8]}"
                    preset = PresetModel(
                        id=new_id,
                        name=name or "Nová položka",
                        price=round(float(prd.get("price", 0.0)), 2),
                        cost_price=round(float(prd.get("cost_price", 0.0)), 2),
                        vat=int(prd.get("vat", 21)),
                        stock_quantity=float(prd.get("stock_quantity", 0.0)),
                        track_stock=bool(prd.get("track_stock", True)),
                        barcode=barcode,
                        unit=prd.get("unit") or "ks",
                        category=prd.get("category") or "custom",
                        show_in_presets=bool(prd.get("show_in_presets", True)),
                        color=prd.get("color") or "#2563eb",
                        icon=prd.get("icon") or "",
                        is_weighted=bool(prd.get("is_weighted", False)),
                        is_open_price=bool(prd.get("is_open_price", False)),
                        min_stock_alert=float(prd.get("min_stock_alert", 5.0)),
                        margin_coefficient=float(prd["margin_coefficient"]) if prd.get("margin_coefficient") is not None else None,
                    )
                    db.add(preset)

                if key:
                    db.add(
                        AppliedSyncEventModel(
                            idempotency_key=key,
                            event_type="PRODUCT",
                            entity_id=prd_id or preset.id,
                            applied_at=now,
                        )
                    )
                    applied_keys_set.add(key)

                if prd_id:
                    ack_product_ids.append(prd_id)
                applied_counts["products"] += 1

            # Process Price Changes
            for pr in pending_prices:
                pr_id = pr.get("id")
                key = pr.get("idempotency_key")
                if key and key in applied_keys_set:
                    if pr_id:
                        ack_price_ids.append(pr_id)
                    continue

                ean = (pr.get("ean") or "").strip()
                pname = (pr.get("product_name") or "").strip()
                new_price = float(pr.get("new_retail_price", 0.0))

                preset = None
                if ean:
                    preset = db.query(PresetModel).filter(PresetModel.barcode == ean).first()
                if not preset and ean:
                    preset = db.query(PresetModel).filter(PresetModel.id == ean).first()
                if not preset and pname:
                    preset = db.query(PresetModel).filter(PresetModel.name == pname).first()

                if preset and new_price > 0:
                    preset.price = round(new_price, 2)

                if key:
                    db.add(
                        AppliedSyncEventModel(
                            idempotency_key=key,
                            event_type="PRICE_CHANGE",
                            entity_id=pr_id or (preset.id if preset else "UNKNOWN"),
                            applied_at=now,
                        )
                    )
                    applied_keys_set.add(key)

                if pr_id:
                    ack_price_ids.append(pr_id)
                applied_counts["price_changes"] += 1

            # Process Intakes
            for it in pending_intakes:
                it_id = it.get("id")
                key = it.get("idempotency_key")
                if key and key in applied_keys_set:
                    if it_id:
                        ack_intake_ids.append(it_id)
                    continue

                supplier_ico = (it.get("supplier_ico") or "").strip() or None
                supplier_name = (it.get("supplier_name") or "").strip() or None
                invoice_number = (it.get("invoice_number") or "").strip() or None

                for item in it.get("items", []):
                    item_name = (item.get("name") or "").strip()
                    item_barcode = (item.get("barcode") or item.get("ean") or "").strip()
                    qty = float(item.get("quantity", 0.0))
                    cost = float(item.get("cost_price", item.get("unit_cost", 0.0)))
                    vat = int(item.get("vat", 21))

                    preset = None
                    if item_barcode:
                        preset = db.query(PresetModel).filter(PresetModel.barcode == item_barcode).first()
                    if not preset and item.get("preset_id"):
                        preset = db.query(PresetModel).filter(PresetModel.id == item["preset_id"]).first()
                    if not preset and item_name:
                        preset = db.query(PresetModel).filter(PresetModel.name == item_name).first()

                    if not preset:
                        # Auto-create preset if item doesn't exist yet
                        preset_id = item.get("preset_id") or f"preset_{uuid.uuid4().hex[:8]}"
                        sell_price = float(item.get("price", item.get("selling_price", cost * 1.30)))
                        preset = PresetModel(
                            id=preset_id,
                            name=item_name or "Naskladněná položka",
                            price=round(sell_price, 2),
                            cost_price=round(cost, 2),
                            vat=vat,
                            stock_quantity=round(qty, 3),
                            track_stock=True,
                            barcode=item_barcode,
                            unit=item.get("unit") or "ks",
                            category="custom",
                        )
                        db.add(preset)
                    else:
                        # Recalculate Weighted Average Purchase Price (VAP) per § 25 ZoÚ
                        cur_stock = float(preset.stock_quantity or 0.0)
                        cur_cost = float(preset.cost_price or 0.0)
                        if cur_stock <= 0 or (cur_stock + qty) <= 0:
                            new_vap = cost
                        else:
                            new_vap = ((cur_stock * cur_cost) + (qty * cost)) / (cur_stock + qty)

                        preset.stock_quantity = round(cur_stock + qty, 3)
                        preset.cost_price = round(new_vap, 2)

                    # Create stock movement record
                    smov = StockMovementModel(
                        id=f"smov_{uuid.uuid4().hex[:12]}",
                        preset_id=preset.id,
                        movement_type="RECEIPT",
                        quantity_delta=round(qty, 3),
                        unit_cost=round(cost, 2),
                        supplier_ico=supplier_ico,
                        supplier_name=supplier_name,
                        document_ref=invoice_number,
                        note=f"Příjemka z cloudu {it_id}",
                        timestamp=now,
                    )
                    db.add(smov)

                if key:
                    db.add(
                        AppliedSyncEventModel(
                            idempotency_key=key,
                            event_type="INTAKE",
                            entity_id=it_id or "INTAKE",
                            applied_at=now,
                        )
                    )
                    applied_keys_set.add(key)

                if it_id:
                    ack_intake_ids.append(it_id)
                applied_counts["intakes"] += 1

        # 3. Send mutual ACK to cloud so items are marked COMMITTED
        ack_success = False
        if ack_product_ids or ack_price_ids or ack_intake_ids:
            client_ack = httpx.Client(timeout=self.timeout)
            try:
                ack_payload = {
                    "product_ids": ack_product_ids,
                    "price_ids": ack_price_ids,
                    "intake_ids": ack_intake_ids,
                }
                ack_res = client_ack.post(ack_url, json=ack_payload, headers=headers)
                if ack_res.status_code == 200:
                    ack_success = True
                else:
                    logger.warning(f"Failed to ACK staging batches to cloud: {ack_res.text[:200]}")
            except Exception as ack_exc:
                logger.warning(f"Error calling staging ACK endpoint: {ack_exc}")
            finally:
                client_ack.close()

        # 4. Update store config record
        now_str = now.isoformat()
        total_applied = sum(applied_counts.values())
        config.cloud_staging_last_sync = now_str
        config.cloud_staging_last_status = "SUCCESS" if (ack_success or not (ack_product_ids or ack_price_ids or ack_intake_ids)) else "APPLIED_LOCAL_ACK_FAILED"
        config.cloud_staging_last_count = total_applied
        db.commit()

        return {
            "status": "SUCCESS",
            "applied": applied_counts,
            "total_applied": total_applied,
            "ack_sent": ack_success,
            "timestamp": now_str,
        }


remote_staging_sync_service = RemoteStagingSyncService()
