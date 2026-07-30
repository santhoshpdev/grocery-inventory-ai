from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Product, InventoryRecord
from app.schemas import ForecastRequest, ForecastResponse
from app.services.forecasting_service import forecasting_service

router = APIRouter(prefix="/api", tags=["forecast"])


@router.get("/forecast/products")
def get_forecast_products():
    if not forecasting_service.is_loaded:
        raise HTTPException(status_code=503, detail="Forecasting service not available")
    return forecasting_service.get_products()


@router.get("/forecast/overview")
def get_forecast_overview():
    if not forecasting_service.is_loaded:
        raise HTTPException(status_code=503, detail="Forecasting service not available")
    return forecasting_service.forecast_overview()


@router.post("/forecast", response_model=ForecastResponse)
def get_forecast(request: ForecastRequest, db: Session = Depends(get_db)):
    try:
        result = forecasting_service.forecast(request.product_id, request.horizon)

        product = db.query(Product).filter(Product.product_id == request.product_id).first()
        if product:
            latest_inv = (
                db.query(InventoryRecord)
                .filter(InventoryRecord.product_id == request.product_id)
                .order_by(InventoryRecord.id.desc())
                .first()
            )
            if latest_inv:
                result['current_stock_status'] = latest_inv.stock_status
                result['current_inventory_level'] = latest_inv.inventory_level
                trend = result['summary']['trend']
                if trend == "Increasing" and latest_inv.stock_status == "Normal":
                    result['recommendation'] = (
                        "Demand is expected to increase. Review inventory levels before the expected rise in demand."
                    )
                elif trend == "Increasing" and latest_inv.stock_status == "Low Stock":
                    result['recommendation'] = (
                        "Demand is rising while stock is already low. Urgent replenishment recommended."
                    )
                elif trend == "Decreasing" and latest_inv.stock_status == "Overstock":
                    result['recommendation'] = (
                        "Demand is decreasing while inventory is overstocked. Consider reducing orders or running promotions."
                    )
                else:
                    result['recommendation'] = (
                        f"Current stock status is {latest_inv.stock_status}. "
                        f"Forecast trend is {trend.lower()}. Continue monitoring."
                    )

        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
