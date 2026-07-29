from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Product, InventoryRecord, Prediction
from app.schemas import DashboardOut

router = APIRouter(prefix="/api", tags=["dashboard"])


@router.get("/dashboard", response_model=DashboardOut)
def get_dashboard(db: Session = Depends(get_db)):
    total_products = db.query(func.count(Product.id)).scalar() or 0
    total_records = db.query(func.count(InventoryRecord.id)).scalar() or 0

    low = db.query(func.count(InventoryRecord.id)).filter(
        InventoryRecord.stock_status == "Low Stock"
    ).scalar() or 0
    normal = db.query(func.count(InventoryRecord.id)).filter(
        InventoryRecord.stock_status == "Normal"
    ).scalar() or 0
    over = db.query(func.count(InventoryRecord.id)).filter(
        InventoryRecord.stock_status == "Overstock"
    ).scalar() or 0

    status_dist = [
        {"status": "Low Stock", "count": low},
        {"status": "Normal", "count": normal},
        {"status": "Overstock", "count": over},
    ]

    cat_rows = (
        db.query(Product.category, func.count(InventoryRecord.id))
        .join(Product, InventoryRecord.product_id == Product.product_id)
        .group_by(Product.category)
        .all()
    )
    category_dist = [
        {"category": row[0] or "Unknown", "count": row[1]} for row in cat_rows
    ]

    recent_preds = (
        db.query(Prediction)
        .order_by(Prediction.created_at.desc())
        .limit(10)
        .all()
    )
    recent_predictions = [
        {
            "id": p.id,
            "predicted_status": p.predicted_status,
            "confidence": p.confidence,
            "created_at": str(p.created_at),
        }
        for p in recent_preds
    ]

    recent_alerts = []
    alerts = (
        db.query(InventoryRecord)
        .filter(InventoryRecord.stock_status == "Low Stock")
        .order_by(InventoryRecord.recorded_at.desc())
        .limit(5)
        .all()
    )
    for r in alerts:
        prod = db.query(Product).filter(Product.product_id == r.product_id).first()
        recent_alerts.append({
            "product_name": prod.product_name if prod else "Unknown",
            "inventory_level": r.inventory_level,
            "stock_status": r.stock_status,
        })

    return DashboardOut(
        total_products=total_products,
        total_records=total_records,
        low_stock_count=low,
        normal_stock_count=normal,
        overstock_count=over,
        status_distribution=status_dist,
        category_distribution=category_dist,
        recent_predictions=recent_predictions,
        recent_alerts=recent_alerts,
    )
