import os
import json
import uuid
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session

try:
    from backend_cloud.database import get_staging_db, StagedIntakeModel, StagedPriceChangeModel, StagedProductModel
except ImportError:
    from database import get_staging_db, StagedIntakeModel, StagedPriceChangeModel, StagedProductModel

try:
    from backend_cloud.services.isdoc_parser import parse_isdoc_bytes
    from backend_cloud.services.ocr_service import parse_invoice_with_vision
    from backend_cloud.services.email_fetcher import EmailInvoiceFetcher
    from backend_cloud.routers.auth import verify_pos_token
except ImportError:
    from services.isdoc_parser import parse_isdoc_bytes
    from services.ocr_service import parse_invoice_with_vision
    from services.email_fetcher import EmailInvoiceFetcher
    from routers.auth import verify_pos_token

router = APIRouter(
    prefix="/api/v1/staging",
    tags=["Staging"]
)


@router.post("/upload-invoice")
async def upload_invoice(
    file: UploadFile = File(...),
    db: Session = Depends(get_staging_db)
):
    """
    Accepts .isdoc, .isdocx, .xml, .pdf or image file.
    Parses document and stages into pending_staging_queue with status PENDING_REVIEW.
    """
    data = await file.read()
    filename = file.filename or "invoice_upload"
    lower_name = filename.lower()

    parsed = None
    source = "UNKNOWN"

    try:
        if lower_name.endswith((".isdoc", ".isdocx")) or (lower_name.endswith(".xml") and b"isdoc" in data[:500].lower()):
            parsed = parse_isdoc_bytes(data)
            source = "ISDOC"
        elif lower_name.endswith((".pdf", ".jpg", ".jpeg", ".png", ".webp")):
            mime = file.content_type or ("application/pdf" if lower_name.endswith(".pdf") else "image/jpeg")
            parsed = parse_invoice_with_vision(data, mime_type=mime)
            source = parsed.get("source", "OCR")
        else:
            # Attempt ISDOC parse as fallback
            try:
                parsed = parse_isdoc_bytes(data)
                source = "ISDOC"
            except Exception:
                raise HTTPException(status_code=400, detail="Nepodporovaný formát souboru. Podporovány jsou .isdoc, .isdocx, .xml, .pdf, .jpg, .png.")
    except Exception as e:
        raise HTTPException(status_code=422, detail=f"Chyba při zpracování dokladu: {str(e)}")

    intake_id = f"INT-{uuid.uuid4().hex[:8].upper()}"
    supplier = parsed.get("supplier", {})
    items = parsed.get("items", [])

    staged = StagedIntakeModel(
        id=intake_id,
        idempotency_key=str(uuid.uuid4()),
        supplier_name=supplier.get("name", ""),
        supplier_ico=supplier.get("ico", ""),
        supplier_dic=supplier.get("dic", ""),
        invoice_number=parsed.get("document_id", ""),
        issue_date=parsed.get("issue_date", ""),
        due_date=parsed.get("due_date", ""),
        status="PENDING_REVIEW",
        source=source,
        total_ex_vat=float(parsed.get("total_ex_vat", 0.0)),
        total_inc_vat=float(parsed.get("total_inc_vat", 0.0) or parsed.get("payable_amount", 0.0)),
        items_json=json.dumps(items),
        raw_payload=json.dumps(parsed),
        created_at=datetime.now(timezone.utc)
    )

    db.add(staged)
    db.commit()
    db.refresh(staged)

    return {
        "status": "success",
        "intake_id": staged.id,
        "source": staged.source,
        "invoice_number": staged.invoice_number,
        "supplier": supplier,
        "items": items,
        "total_ex_vat": staged.total_ex_vat,
        "total_inc_vat": staged.total_inc_vat,
    }


@router.post("/fetch-emails")
def fetch_emails(db: Session = Depends(get_staging_db)):
    """
    Manually triggers IMAP poller for faktury@... mailbox.
    Stages discovered invoices into queue.
    """
    fetcher = EmailInvoiceFetcher()
    results = fetcher.poll_invoices(mark_seen=True)
    created_ids = []

    for parsed in results:
        intake_id = f"INT-{uuid.uuid4().hex[:8].upper()}"
        supplier = parsed.get("supplier", {})
        items = parsed.get("items", [])

        staged = StagedIntakeModel(
            id=intake_id,
            idempotency_key=str(uuid.uuid4()),
            supplier_name=supplier.get("name", ""),
            supplier_ico=supplier.get("ico", ""),
            supplier_dic=supplier.get("dic", ""),
            invoice_number=parsed.get("document_id", ""),
            issue_date=parsed.get("issue_date", ""),
            due_date=parsed.get("due_date", ""),
            status="PENDING_REVIEW",
            source=f"EMAIL_{parsed.get('source', 'ISDOC')}",
            total_ex_vat=float(parsed.get("total_ex_vat", 0.0)),
            total_inc_vat=float(parsed.get("total_inc_vat", 0.0) or parsed.get("payable_amount", 0.0)),
            items_json=json.dumps(items),
            raw_payload=json.dumps(parsed),
            created_at=datetime.now(timezone.utc)
        )
        db.add(staged)
        created_ids.append(intake_id)

    db.commit()
    return {"status": "success", "fetched_count": len(created_ids), "intake_ids": created_ids}


@router.get("/intakes")
def list_intakes(db: Session = Depends(get_staging_db)):
    """
    Returns list of all staged intakes for dashboard.
    """
    intakes = db.query(StagedIntakeModel).order_by(StagedIntakeModel.created_at.desc()).all()
    results = []
    for it in intakes:
        items = json.loads(it.items_json) if it.items_json else []
        results.append({
            "id": it.id,
            "supplier": f"{it.supplier_name} ({it.supplier_ico})" if it.supplier_ico else it.supplier_name,
            "supplier_name": it.supplier_name,
            "supplier_ico": it.supplier_ico,
            "invoice_number": it.invoice_number,
            "date": it.issue_date or (it.created_at.strftime("%Y-%m-%d") if it.created_at else ""),
            "due_date": it.due_date,
            "status": it.status,
            "source": it.source,
            "items_count": len(items),
            "items": items,
            "total": it.total_inc_vat,
            "created_at": it.created_at.isoformat() if it.created_at else None
        })
    return results


@router.post("/intakes")
def create_intake(payload: dict, db: Session = Depends(get_staging_db)):
    """
    Creates or saves a draft intake manually from the Web UI.
    """
    intake_id = payload.get("id") or f"INT-{uuid.uuid4().hex[:8].upper()}"
    items = payload.get("items", [])
    
    staged = StagedIntakeModel(
        id=intake_id,
        idempotency_key=str(uuid.uuid4()),
        supplier_name=payload.get("supplier_name", ""),
        supplier_ico=payload.get("supplier_ico", ""),
        supplier_dic=payload.get("supplier_dic", ""),
        invoice_number=payload.get("invoice_number", ""),
        issue_date=payload.get("issue_date", ""),
        due_date=payload.get("due_date", ""),
        status=payload.get("status", "PENDING_STORE_SYNC"),
        source=payload.get("source", "MANUAL"),
        total_ex_vat=float(payload.get("total_ex_vat", 0.0)),
        total_inc_vat=float(payload.get("total_inc_vat", 0.0)),
        items_json=json.dumps(items),
        created_at=datetime.now(timezone.utc)
    )
    db.merge(staged)
    db.commit()

    return {"status": "success", "message": "Intake saved successfully", "id": intake_id}


@router.post("/intakes/{intake_id}/approve")
def approve_intake(intake_id: str, payload: Optional[dict] = None, db: Session = Depends(get_staging_db)):
    """
    Approves a PENDING_REVIEW intake, updates any modified items, and sets status to PENDING_STORE_SYNC.
    """
    intake = db.query(StagedIntakeModel).filter(StagedIntakeModel.id == intake_id).first()
    if not intake:
        raise HTTPException(status_code=404, detail="Intake not found")

    if payload:
        if "items" in payload:
            intake.items_json = json.dumps(payload["items"])
        if "total_inc_vat" in payload:
            intake.total_inc_vat = float(payload["total_inc_vat"])
        if "total_ex_vat" in payload:
            intake.total_ex_vat = float(payload["total_ex_vat"])

    intake.status = "PENDING_STORE_SYNC"
    db.commit()
    return {"status": "success", "message": f"Intake {intake_id} approved for POS sync"}


@router.delete("/intakes/{intake_id}")
def delete_intake(intake_id: str, db: Session = Depends(get_staging_db)):
    """
    Deletes or dismisses a staged intake.
    """
    intake = db.query(StagedIntakeModel).filter(StagedIntakeModel.id == intake_id).first()
    if not intake:
        raise HTTPException(status_code=404, detail="Intake not found")
    db.delete(intake)
    db.commit()
    return {"status": "success", "message": f"Intake {intake_id} removed"}


@router.get("/pending")
def get_pending(
    db: Session = Depends(get_staging_db),
    _pos_auth=Depends(verify_pos_token)
):
    """
    Polled by Store POS on boot. Returns all intakes and price changes with PENDING_STORE_SYNC.
    """
    pending_intakes = db.query(StagedIntakeModel).filter(StagedIntakeModel.status == "PENDING_STORE_SYNC").all()
    pending_prices = db.query(StagedPriceChangeModel).filter(StagedPriceChangeModel.status == "PENDING_STORE_SYNC").all()

    intakes_data = []
    for it in pending_intakes:
        intakes_data.append({
            "id": it.id,
            "idempotency_key": it.idempotency_key,
            "supplier_name": it.supplier_name,
            "supplier_ico": it.supplier_ico,
            "invoice_number": it.invoice_number,
            "issue_date": it.issue_date,
            "items": json.loads(it.items_json) if it.items_json else [],
            "total_inc_vat": it.total_inc_vat
        })

    prices_data = []
    for pr in pending_prices:
        prices_data.append({
            "id": pr.id,
            "idempotency_key": pr.idempotency_key,
            "ean": pr.ean,
            "product_name": pr.product_name,
            "new_retail_price": pr.new_retail_price
        })

    pending_products = db.query(StagedProductModel).filter(StagedProductModel.status == "PENDING_STORE_SYNC").all()
    products_data = []
    for prd in pending_products:
        products_data.append({
            "id": prd.id,
            "idempotency_key": prd.idempotency_key,
            "name": prd.name,
            "barcode": prd.barcode,
            "price": prd.price,
            "cost_price": prd.cost_price,
            "vat": prd.vat,
            "stock_quantity": prd.stock_quantity,
            "track_stock": prd.track_stock,
            "category": prd.category,
            "unit": prd.unit,
            "show_in_presets": getattr(prd, "show_in_presets", True),
            "color": getattr(prd, "color", "#2563eb"),
            "icon": getattr(prd, "icon", ""),
            "is_weighted": getattr(prd, "is_weighted", False),
            "is_open_price": getattr(prd, "is_open_price", False),
            "min_stock_alert": getattr(prd, "min_stock_alert", 5.0),
            "margin_coefficient": getattr(prd, "margin_coefficient", None),
        })

    return {
        "intakes": intakes_data,
        "price_changes": prices_data,
        "products": products_data
    }


@router.post("/price-changes")
def create_staged_price_change(payload: dict, db: Session = Depends(get_staging_db)):
    """
    Stages a retail price adjustment for a product by EAN.
    """
    ean = (payload.get("ean") or "").strip()
    if not ean:
        raise HTTPException(status_code=400, detail="Čárový kód (EAN) je povinný")

    new_price = float(payload.get("new_retail_price", payload.get("new_price", 0.0)))
    old_price = float(payload.get("old_retail_price", payload.get("old_price", 0.0)))

    change_id = f"PRC-{uuid.uuid4().hex[:8].upper()}"
    staged = StagedPriceChangeModel(
        id=change_id,
        idempotency_key=str(uuid.uuid4()),
        ean=ean,
        product_name=(payload.get("product_name") or "").strip(),
        old_retail_price=old_price,
        new_retail_price=new_price,
        status="PENDING_STORE_SYNC",
        created_at=datetime.now(timezone.utc)
    )
    db.merge(staged)
    db.commit()
    return {"status": "success", "message": "Změna ceny zařazena do fronty pro pokladnu", "id": change_id}


@router.post("/products")
def create_staged_product(payload: dict, db: Session = Depends(get_staging_db)):
    """
    Stages a new catalog product created from the web dashboard.
    """
    name = (payload.get("name") or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Název produktu je povinný")

    price_val = payload.get("price")
    if price_val is None:
        price_val = payload.get("retail_price")
    if price_val is None:
        price_val = payload.get("retailPrice")

    cost_val = payload.get("cost_price")
    if cost_val is None:
        cost_val = payload.get("costPrice")

    stock_val = payload.get("stock_quantity")
    if stock_val is None:
        stock_val = payload.get("stockQuantity")

    show_in_presets_val = payload.get("show_in_presets")
    if show_in_presets_val is None:
        show_in_presets_val = payload.get("showInPresets", True)

    is_weighted_val = payload.get("is_weighted")
    if is_weighted_val is None:
        is_weighted_val = payload.get("isWeighted", False)

    is_open_price_val = payload.get("is_open_price")
    if is_open_price_val is None:
        is_open_price_val = payload.get("isOpenPrice", False)

    min_stock_val = payload.get("min_stock_alert")
    if min_stock_val is None:
        min_stock_val = payload.get("minStockAlert", 5.0)

    margin_coeff_val = payload.get("margin_coefficient")
    if margin_coeff_val is None:
        margin_coeff_val = payload.get("marginCoefficient")

    prod_id = payload.get("id") or f"PRD-{uuid.uuid4().hex[:8].upper()}"
    staged = StagedProductModel(
        id=prod_id,
        idempotency_key=str(uuid.uuid4()),
        name=name,
        barcode=(payload.get("barcode") or "").strip() or None,
        price=float(price_val or 0.0),
        cost_price=float(cost_val or 0.0),
        vat=int(payload.get("vat", 21)),
        stock_quantity=float(stock_val or 0.0),
        track_stock=bool(payload.get("track_stock", True)),
        category=(payload.get("category") or "custom").strip(),
        unit=(payload.get("unit") or "ks").strip(),
        show_in_presets=bool(show_in_presets_val),
        color=(payload.get("color") or "#2563eb").strip(),
        icon=(payload.get("icon") or "").strip(),
        is_weighted=bool(is_weighted_val),
        is_open_price=bool(is_open_price_val),
        min_stock_alert=float(min_stock_val or 5.0),
        margin_coefficient=float(margin_coeff_val) if margin_coeff_val is not None else None,
        status="PENDING_STORE_SYNC",
        created_at=datetime.now(timezone.utc)
    )
    db.merge(staged)
    db.commit()
    return {"status": "success", "message": f"Produkt '{name}' zařazen do fronty pro pokladnu", "id": prod_id}


@router.post("/ack")
def ack_staging(
    payload: dict,
    db: Session = Depends(get_staging_db),
    _pos_auth=Depends(verify_pos_token)
):
    """
    Called by Store POS after committing staged batches into local SQLite master.
    """
    intake_ids = payload.get("intake_ids", [])
    price_ids = payload.get("price_ids", [])
    product_ids = payload.get("product_ids", [])

    if intake_ids:
        db.query(StagedIntakeModel).filter(StagedIntakeModel.id.in_(intake_ids)).update(
            {"status": "COMMITTED", "applied_at": datetime.now(timezone.utc)},
            synchronize_session=False
        )

    if price_ids:
        db.query(StagedPriceChangeModel).filter(StagedPriceChangeModel.id.in_(price_ids)).update(
            {"status": "COMMITTED"},
            synchronize_session=False
        )

    if product_ids:
        db.query(StagedProductModel).filter(StagedProductModel.id.in_(product_ids)).update(
            {"status": "COMMITTED", "applied_at": datetime.now(timezone.utc)},
            synchronize_session=False
        )

    db.commit()
    return {"status": "success", "message": "Staging items acknowledged and marked COMMITTED"}
