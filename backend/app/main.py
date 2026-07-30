import time
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import engine, Base
from app.routes import dashboard, products, prediction, ml, chat, forecast
from app.services.ml_service import ml_service
from app.services.forecasting_service import forecasting_service


def wait_for_db(max_retries=30, delay=2):
    for i in range(max_retries):
        try:
            engine.connect()
            print("Database connected")
            return
        except Exception as e:
            print(f"Waiting for database ({i+1}/{max_retries}): {e}")
            time.sleep(delay)
    print("Could not connect to database after retries")


def init_db():
    wait_for_db()
    Base.metadata.create_all(bind=engine)
    print("Database tables created")

    from app.models import Product
    from sqlalchemy.orm import Session
    from app.database import SessionLocal

    db: Session = SessionLocal()
    try:
        if db.query(Product).count() == 0:
            seed_data(db)
    finally:
        db.close()


def seed_data(db):
    import pandas as pd
    import os

    csv_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "..", "data", "dataset.csv"
    )
    csv_path = os.path.normpath(csv_path)

    if not os.path.exists(csv_path):
        print(f"Seed CSV not found at {csv_path}, skipping seed")
        return

    print(f"Seeding database from {csv_path}")
    df = pd.read_csv(csv_path)
    df = df.drop_duplicates()

    from app.models import Product, InventoryRecord

    products_seen = set()
    for _, row in df.iterrows():
        pid = int(row["Product_ID"])
        if pid not in products_seen:
            products_seen.add(pid)
            product = Product(
                product_id=pid,
                product_name=str(row["Product_Name"]),
                category=str(row["Category"]),
                supplier=str(row["Supplier"]),
                season=str(row["Season"]),
            )
            db.add(product)

    db.flush()

    for _, row in df.iterrows():
        record = InventoryRecord(
            product_id=int(row["Product_ID"]),
            store_id=int(row["Store_ID"]),
            inventory_level=int(row["Inventory_Level"]),
            units_sold=int(row["Units_Sold"]),
            unit_price=float(row["Unit_Price"]),
            purchase_cost=float(row["Purchase_Cost"]),
            discount=int(row["Discount"]),
            temperature=float(row["Temperature"]),
            holiday=int(row["Holiday"]),
            promotion=int(row["Promotion"]),
            lead_time=int(row["Lead_Time"]),
            shelf_life=int(row["Shelf_Life"]),
            reorder_level=int(row["Reorder_Level"]),
            demand=int(row["Demand"]),
            stock_status=str(row["Stock_Status"]),
        )
        db.add(record)

    db.commit()
    print(f"Seeded {len(products_seen)} products and {len(df)} inventory records")


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    ml_service.load()
    forecasting_service.load()
    yield


app = FastAPI(
    title="Grocery Inventory AI",
    description="AI-Powered Inventory Decision Support System",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(dashboard.router)
app.include_router(products.router)
app.include_router(prediction.router)
app.include_router(ml.router)
app.include_router(chat.router)
app.include_router(forecast.router)
