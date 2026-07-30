from pydantic import BaseModel, Field
from typing import Optional, Any, Dict, List
from datetime import datetime


class PredictRequest(BaseModel):
    product_id: int
    product_name: str
    category: str
    supplier: str
    store_id: int
    inventory_level: int
    units_sold: int
    unit_price: float
    purchase_cost: float
    discount: int
    temperature: float
    holiday: int
    promotion: int
    lead_time: int
    shelf_life: int
    reorder_level: int
    season: str
    demand: int


class PredictResponse(BaseModel):
    predicted_status: str
    confidence: float
    probabilities: Dict[str, float]
    model_name: str
    recommendation: str


class ProductOut(BaseModel):
    id: int
    product_id: int
    product_name: str
    category: Optional[str]
    supplier: Optional[str]
    season: Optional[str]

    class Config:
        from_attributes = True


class InventoryRecordOut(BaseModel):
    id: int
    product_id: int
    store_id: Optional[int]
    inventory_level: Optional[int]
    units_sold: Optional[int]
    unit_price: Optional[float]
    purchase_cost: Optional[float]
    discount: Optional[int]
    temperature: Optional[float]
    holiday: Optional[int]
    promotion: Optional[int]
    lead_time: Optional[int]
    shelf_life: Optional[int]
    reorder_level: Optional[int]
    demand: Optional[int]
    stock_status: Optional[str]
    recorded_at: Optional[datetime]
    product: Optional[ProductOut]

    class Config:
        from_attributes = True


class ProductDetailOut(BaseModel):
    id: int
    product_id: int
    product_name: str
    category: Optional[str]
    supplier: Optional[str]
    season: Optional[str]
    inventory_records: List[InventoryRecordOut] = []

    class Config:
        from_attributes = True


class DashboardOut(BaseModel):
    total_products: int
    total_records: int
    low_stock_count: int
    normal_stock_count: int
    overstock_count: int
    status_distribution: List[dict]
    category_distribution: List[dict]
    recent_predictions: List[dict]
    recent_alerts: List[dict]


class AnalyticsOut(BaseModel):
    status_distribution: List[dict]
    category_distribution: List[dict]
    insight_cards: List[dict]


class MetricsOut(BaseModel):
    models: List[dict]


class FeatureImportanceOut(BaseModel):
    features: List[dict]


class ForecastRequest(BaseModel):
    product_id: int
    horizon: int = Field(default=7, ge=1, le=30)


class ForecastSummary(BaseModel):
    average_forecast: int
    peak_forecast: int
    trend: str


class ForecastResponse(BaseModel):
    product_id: int
    forecast_horizon: int
    model: str
    historical: List[dict]
    forecast: List[dict]
    summary: ForecastSummary
    current_stock_status: Optional[str] = None
    current_inventory_level: Optional[int] = None
    recommendation: Optional[str] = None
