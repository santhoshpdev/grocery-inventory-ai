from typing import List
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import or_

from app.database import get_db
from app.models import Product, InventoryRecord
from app.schemas import ProductOut, ProductDetailOut, InventoryRecordOut

router = APIRouter(prefix="/api", tags=["products"])


@router.get("/products", response_model=List[ProductOut])
def list_products(
    search: str = Query(""),
    category: str = Query(""),
    status: str = Query(""),
    sort_by: str = Query("product_id"),
    sort_dir: str = Query("asc"),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    query = db.query(Product)

    if search:
        query = query.filter(
            or_(
                Product.product_name.ilike(f"%{search}%"),
                Product.category.ilike(f"%{search}%"),
            )
        )

    if category:
        query = query.filter(Product.category == category)

    sort_col = getattr(Product, sort_by, Product.product_id)
    if sort_dir == "desc":
        sort_col = sort_col.desc()
    query = query.order_by(sort_col)

    total = query.count()
    products = query.offset((page - 1) * per_page).limit(per_page).all()

    return products


@router.get("/products/{product_id}", response_model=ProductDetailOut)
def get_product(product_id: int, db: Session = Depends(get_db)):
    product = (
        db.query(Product)
        .options(joinedload(Product.inventory_records))
        .filter(Product.product_id == product_id)
        .first()
    )
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return product


@router.get("/inventory", response_model=List[InventoryRecordOut])
def list_inventory(
    status: str = Query(""),
    category: str = Query(""),
    search: str = Query(""),
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    query = db.query(InventoryRecord).options(joinedload(InventoryRecord.product))

    if search:
        query = query.join(Product).filter(
            Product.product_name.ilike(f"%{search}%")
        )

    if category:
        query = query.join(Product).filter(Product.category == category)

    if status:
        query = query.filter(InventoryRecord.stock_status == status)

    total = query.count()
    records = query.order_by(InventoryRecord.id.desc()).offset(
        (page - 1) * per_page
    ).limit(per_page).all()

    return records
