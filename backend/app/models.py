from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, JSON, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(20), nullable=False, default="INVENTORY_ANALYST")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, unique=True, nullable=False)
    product_name = Column(String(100), nullable=False)
    category = Column(String(50))
    supplier = Column(String(50))
    season = Column(String(20))

    inventory_records = relationship("InventoryRecord", back_populates="product")


class InventoryRecord(Base):
    __tablename__ = "inventory_records"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.product_id"), nullable=False)
    store_id = Column(Integer)
    inventory_level = Column(Integer)
    units_sold = Column(Integer)
    unit_price = Column(Float)
    purchase_cost = Column(Float)
    discount = Column(Integer)
    temperature = Column(Float)
    holiday = Column(Integer)
    promotion = Column(Integer)
    lead_time = Column(Integer)
    shelf_life = Column(Integer)
    reorder_level = Column(Integer)
    demand = Column(Integer)
    stock_status = Column(String(20))
    recorded_at = Column(DateTime(timezone=True), server_default=func.now())

    product = relationship("Product", back_populates="inventory_records")
    predictions = relationship("Prediction", back_populates="inventory_record")


class Prediction(Base):
    __tablename__ = "predictions"

    id = Column(Integer, primary_key=True, index=True)
    inventory_record_id = Column(Integer, ForeignKey("inventory_records.id"), nullable=True)
    input_data = Column(JSON, nullable=False)
    predicted_status = Column(String(20), nullable=False)
    confidence = Column(Float)
    probabilities = Column(JSON)
    model_name = Column(String(50), default="CatBoost")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    inventory_record = relationship("InventoryRecord", back_populates="predictions")
