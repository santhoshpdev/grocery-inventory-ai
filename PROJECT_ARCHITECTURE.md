# STOCKORA AI — Full Project Architecture

## Table of Contents
1. [System Architecture](#1-system-architecture)
2. [Data Flow](#2-data-flow)
3. [ML Classification Pipeline](#3-ml-classification-pipeline)
4. [Prediction vs Forecasting](#4-prediction-vs-forecasting)
5. [Forecasting Dataset](#5-forecasting-dataset)
6. [Forecasting Model](#6-forecasting-model)
7. [Forecast Horizon](#7-forecast-horizon)
8. [Forecasting UI](#8-forecasting-ui)
9. [Decision Support Logic](#9-decision-support-logic)
10. [Chatbot Architecture](#10-chatbot-architecture)
11. [Database Schema](#11-database-schema)
12. [Docker Architecture](#12-docker-architecture)
13. [Synthetic Data Disclaimer & Demo Mode](#13-synthetic-data-disclaimer--demo-mode)
14. [Frontend SPA Architecture](#14-frontend-spa-architecture)

---

## 1. System Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        Docker Compose                             │
│                                                                   │
│  ┌─────────────────────┐    ┌──────────────────────┐              │
│  │     Frontend         │    │      Backend          │              │
│  │     (Nginx)          │    │     (FastAPI)         │              │
│  │     port 7070        │◀──▶│     port 8000         │──┐          │
│  │                      │    │                       │  │          │
│  │  ┌─────────────────┐ │    │  ┌─────────────────┐  │  │          │
│  │  │ Static SPA files │ │    │  │ CatBoost Model  │  │  │          │
│  │  │ index.html       │ │    │  │ (classification)│  │  │          │
│  │  │ css/style.css    │ │    │  ├─────────────────┤  │  │          │
│  │  │ js/*.js          │ │    │  │ Holt-Winters    │  │  │          │
│  │  └─────────────────┘ │    │  │ (forecasting)   │  │  │          │
│  └──────────┬───────────┘    │  │ from CSV (no DB) │  │  │          │
│             │                │  └────────┬─────────┘  │  │          │
│             │ /api/* proxy   │           │            │  │          │
│             └────────────────▶           │            │  │          │
│                              ┌───────────▼──────────┐ │  │          │
│                              │    PostgreSQL :5432   │◀─┘  │          │
│                              │    (Products,         │     │          │
│                              │     InventoryRecords, │     │          │
│                              │     Predictions)      │     │          │
│                              └───────────────────────┘     │          │
│                                                            │          │
│  File System (Docker volume):                              │          │
│  /app/data/synthetic_demand_history.csv ◄──────────────────┘          │
│       (18k rows, loaded at startup)                                   │
│                                                                       │
│  /app/backend/ml_models/ (CatBoost artifacts)                         │
│       ├── catboost_model.cbm                                          │
│       ├── label_encoders.pkl                                          │
│       ├── target_encoder.pkl                                          │
│       ├── scaler.pkl                                                  │
│       ├── feature_names.pkl                                           │
│       ├── metrics.pkl                                                 │
│       └── feature_importance.pkl                                      │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

### Service Dependencies
```
postgres (healthy) → backend (starts) → frontend (starts after backend)
```

### Network
- All services on a shared Docker bridge network
- Backend accessible internally at `backend:8000`
- Frontend proxies `/api/*` → `http://backend:8000/api/*`
- Frontend served externally at `http://localhost:7070`

---

## 2. Data Flow

```
data/dataset.csv (6,000 rows, 18 features)
  │
  ├── Docker Build ──▶ backend/scripts/train_model.py
  │                      │
  │                      ├── Reads CSV, drops duplicates
  │                      ├── Parses Date → Year/Month/Day, drops Date column
  │                      ├── Fills missing values
  │                      ├── LabelEncodes categoricals + target (Stock_Status)
  │                      ├── Splits 80/20 stratified
  │                      ├── Scales with StandardScaler
  │                      ├── Trains CatBoostClassifier
  │                      └── Saves 7 artifacts to backend/ml_models/
  │
  ├── Docker Build ──▶ backend/scripts/generate_synthetic_demand.py
  │                      │
  │                      ├── Reads dataset.csv for product list + baselines
  │                      ├── Generates 90 days of daily demand (18k rows)
  │                      ├── Applies day-of-week, category, seasonality multipliers
  │                      ├── Adds Gaussian noise
  │                      └── Saves to data/synthetic_demand_history.csv
  │
  └── First Startup ──▶ backend/app/main.py :: init_db()
                          │
                          ├── wait_for_db() — retries 30x
                          ├── Base.metadata.create_all()
                          ├── If products table empty: seed_data()
                          │     ├── 200 products from CSV
                          │     └── 6,000 inventory records from CSV
                          │
                          └── forecasting_service.load()
                                └── Reads synthetic_demand_history.csv
                                      into memory (pandas DataFrame)
```

### Runtime Data Flow (API Requests)

```
User → Browser → http://localhost:7070
  │
  ├── /api/dashboard ──▶ PostgreSQL query ──▶ JSON response
  ├── /api/products   ──▶ PostgreSQL query ──▶ JSON response
  ├── /api/inventory  ──▶ PostgreSQL query ──▶ JSON response
  ├── POST /api/predict ─▶ MLService instance ──▶ JSON response
  │                        ├── Maps snake_case → CSV column names
  │                        ├── LabelEncodes categoricals
  │                        ├── Scales with StandardScaler
  │                        ├── CatBoost predict + predict_proba
  │                        └── Inverse-transform target, build response
  │
  ├── /api/forecast/products ──▶ forecasting_service.product_list (in-memory)
  ├── /api/forecast/overview   ──▶ forecasting_service.forecast_overview()
  │                                └── Forecasts first 10 products (7-day)
  │
  ├── POST /api/forecast ─▶ forecasting_service.forecast()
  │                         ├── Filters DataFrame by product_id
  │                         ├── Fits Holt-Winters on demand series
  │                         ├── Forecasts N steps ahead
  │                         ├── Queries PostgreSQL for current inventory
  │                         └── Builds recommendation from trend + status
  │
  └── POST /api/chat ───▶ ChatService
                           ├── detect_intent() — regex matching
                           ├── Handler method (DB query or forecasting)
                           └── Text response
```

---

## 3. ML Classification Pipeline

### Overview
The ML classification pipeline is an **offline training** process that runs during Docker build. It produces a CatBoost model that classifies inventory records into three stock statuses: **Low Stock**, **Normal**, or **Overstock**.

### Training Script: `backend/scripts/train_model.py`
```
1. Read data/dataset.csv (6,000 rows, 19 columns)
2. Drop duplicate rows
3. Parse Date column → Year, Month, Day features; drop Date
4. Fill missing: mode for categorical, median for numeric
5. LabelEncoder for categoricals (Category, Supplier, Season, Product_Name)
6. LabelEncoder for target (Stock_Status → 0, 1, 2)
7. Train/test split (80/20, stratified by stock_status)
8. StandardScaler on all features
9. Train CatBoostClassifier:
   - iterations=200
   - learning_rate=0.1
   - depth=6
   - loss_function=MultiClass
   - random_seed=42
10. Evaluate: accuracy, precision, recall, f1, roc_auc (weighted average)
11. Save 7 artifacts to backend/ml_models/
```

### Input Features (18)
| Feature | Type | Description |
|---------|------|-------------|
| Product_ID | int | Numeric product identifier |
| Product_Name | categorical | Product name (encoded) |
| Category | categorical | Grocery category (10 categories) |
| Supplier | categorical | Supplier identifier |
| Store_ID | int | Store number |
| Inventory_Level | int | Current stock quantity |
| Units_Sold | int | Units sold in period |
| Unit_Price | float | Price per unit |
| Purchase_Cost | float | Cost per unit |
| Discount | int | Discount percentage |
| Temperature | float | Storage/ambient temperature |
| Holiday | int | Holiday flag (0/1) |
| Promotion | int | Promotion flag (0/1) |
| Lead_Time | int | Days to restock |
| Shelf_Life | int | Days until expiry |
| Reorder_Level | int | Auto-reorder threshold |
| Season | categorical | Season (Winter/Spring/Summer/Fall) |
| Demand | int | Historical demand |

### Model Artifacts (7 files in `backend/ml_models/`)
| File | Purpose | Format |
|------|---------|--------|
| `catboost_model.cbm` | Trained CatBoost model binary | CatBoost native |
| `label_encoders.pkl` | Per-column LabelEncoders for 5 categoricals | Pickled dict |
| `target_encoder.pkl` | Stock_Status encoder (3 classes) | Pickled LabelEncoder |
| `scaler.pkl` | StandardScaler (18 features) | Pickled |
| `feature_names.pkl` | Ordered list of 18 feature column names | Pickled list |
| `metrics.pkl` | Dict with accuracy, precision, recall, f1, roc_auc | Pickled dict |
| `feature_importance.pkl` | List of {Feature, Importance} sorted descending | Pickled list |

### MLService (`backend/app/services/ml_service.py`)
- Singleton loaded during FastAPI `lifespan` startup
- `predict(input_data: dict)`:
  1. Maps 18 snake_case keys → CSV column names via `COLUMN_MAP`
  2. Builds single-row DataFrame
  3. LabelEncodes categoricals (unknown → -1)
  4. Selects + orders features matching training order
  5. Scales with StandardScaler
  6. CatBoost predict + predict_proba
  7. Inverse-transform predicted class → status name
  8. Builds recommendation string from predicted status
  9. Returns `{predicted_status, confidence, probabilities, model_name, recommendation}`

### Current Performance
| Metric | Value |
|--------|-------|
| Accuracy | 99.17% |
| Precision | 99.17% |
| Recall | 99.17% |
| F1 Score | 99.17% |
| ROC AUC | 0.9990 |

---

## 4. Prediction vs Forecasting

The system has **two separate AI capabilities** with different purposes, data sources, and algorithms:

| Aspect | Prediction (Classification) | Forecasting (Time Series) |
|--------|---------------------------|--------------------------|
| **Purpose** | Classify current stock status | Estimate future demand |
| **Algorithm** | CatBoost Classifier | Holt-Winters Exponential Smoothing |
| **Data Source** | PostgreSQL (6,000 signed inventory records) | CSV file (18,000 rows synthetic daily demand) |
| **Model Training** | Offline during Docker build | Per-request (fits fresh on historical data) |
| **Model File** | `catboost_model.cbm` (persistent binary) | None (transient in-memory) |
| **Features** | 18 features (inventory, pricing, logistics) | Single time series (demand over time) |
| **Output** | Stock status class + confidence + probabilities | Forecasted demand values + trend + summary |
| **Output Type** | Classification (Low Stock / Normal / Overstock) | Regression (integer units/day) |
| **Uncertainty** | Confidence score (0-1) | No confidence bounds |
| **Horizon** | Instant (current state) | Future (7/14/30 days) |
| **API Endpoint** | `POST /api/predict` | `POST /api/forecast` |
| **Frontend Page** | AI Prediction (`#prediction`) | Forecasting (`#forecasting`) |
| **User Action** | Fill 18-field form → get classification | Select product + horizon → get forecast chart |

Both coexist in the same backend but are completely independent — they share no data, no models, and no code paths. The only integration point is the dashboard's Forecast Overview and the AI forecasting insight card which combines forecast trend with the product's current stock status from PostgreSQL.

---

## 5. Forecasting Dataset

### Source
- **File**: `data/synthetic_demand_history.csv`
- **Generator**: `backend/scripts/generate_synthetic_demand.py`
- **Generated at**: Docker build time (after `train_model.py`)
- **Size**: 18,000 rows
- **Dimensions**: 200 products × 90 days

### Generation Parameters
```
Base demand: median Demand from dataset.csv per product
Category multiplier: Dairy=1.0, Bakery=0.9, Beverages=1.15, Frozen=0.85,
                     Fruits=1.0, Grains=0.85, Household=0.6, Meat=1.2,
                     Snacks=1.05, Vegetables=1.0
Day-of-week multiplier: Mon-Thu=1.0, Fri=1.05, Sat=1.25, Sun=0.75
Trend factor: 1.0 +- 7.5% over 90 days
Noise: Gaussian (mean=1.0, std=0.12)
Frozen category bonus: 2x demand in summer months (Jun-Aug)
```

### Data Columns
| Column | Type | Example |
|--------|------|---------|
| date | string (YYYY-MM-DD) | 2025-10-01 |
| product_id | int | 1 |
| product_name | string | Product_001 |
| category | string | Meat |
| demand | int | 42 |
| day_of_week | int | 0 (Monday) |

### Loading
The CSV is loaded into memory once at backend startup by `ForecastingService.load()`. It is stored as a pandas DataFrame (`self.data`). The service does **not** write forecast data to PostgreSQL — all forecast operations read from the in-memory DataFrame and return results directly in API responses.

### Demo Disclaimer
Every UI surface that exposes forecasting data displays a "SIMULATION MODE" badge or "synthetic historical demand data" label. Chatbot responses also prefix forecast results with "Based on the simulated historical demand data".

---

## 6. Forecasting Model

### Algorithm: Holt-Winters Exponential Smoothing

**Library**: `statsmodels.tsa.holtwinters.ExponentialSmoothing`

### Configuration
```python
ExponentialSmoothing(
    series,                  # 1D array of historical demand values
    trend='add',             # Additive trend component
    seasonal='add',          # Additive seasonal component
    seasonal_periods=7,      # Weekly seasonality (min(len//2, 7))
    initialization_method='estimated',
)
```

### How It Works (for this application)
1. The historical demand series is extracted for the selected product (90 data points)
2. If standard deviation < 0.01 (near-constant series), forecast is flat (last value repeated)
3. Otherwise, ExponentialSmoothing fits the model with:
   - **Level**: Baseline demand
   - **Trend**: Directional change over time (additive)
   - **Seasonal**: Weekly pattern (7-day period, additive)
4. The model forecasts N steps ahead (where N = horizon: 7, 14, or 30)
5. If model fitting fails (convergence error, edge case), a linear fallback is used:
   ```
   forecast[i] = max(1, last_value + trend * (i+1))
   where trend = (last - first) / len(series)
   ```
6. All forecast values are rounded to integers and floored at minimum 1

### Per-Request Training (No Persistent Model)
Unlike the CatBoost classifier (trained once during build), the Holt-Winters model is **trained on every forecast request**. For each `POST /api/forecast` call:
1. The historical data for the specific product is sliced from the DataFrame
2. A fresh ExponentialSmoothing model is instantiated and fitted
3. The forecast is generated
4. The model instance is discarded after the response

This means:
- No model file is saved to disk for forecasting
- Every request pays a small training cost (~50-200ms depending on series length)
- The model always uses the most recent 90 days of data
- Scalability is limited — 200 products × many concurrent users would need caching

### Key Limitation
The Holt-Winters model uses **additive seasonality and trend**. This works well for demand series with relatively stable variance but may produce negative forecasts for series with dips. All forecasts are clamped to `≥ 1` to avoid negative/zero demand predictions.

---

## 7. Forecast Horizon

The user can select from three forecast horizons:

| Horizon | Use Case | Data Points Generated |
|---------|----------|----------------------|
| 7 days | Short-term: immediate restocking decisions, weekly planning | 7 daily values |
| 14 days | Medium-term: bi-weekly ordering, promotion planning | 14 daily values |
| 30 days | Long-term: monthly inventory budgeting, seasonal planning | 30 daily values |

The horizon affects:
- **API**: `horizon` field in `ForecastRequest` (integer, 1-30, default 7)
- **Chart**: Longer horizons show more forecasted bars (dashed line extends further)
- **Summary**: Average/peak forecast computed over the full horizon
- **Trend direction**: Computed by comparing first and last forecast values

The trend direction logic:
```
if len(forecast_vals) > 1:
    trend = "Increasing" if forecast_vals[-1] > forecast_vals[0]
          else "Decreasing" if forecast_vals[-1] < forecast_vals[0]
          else "Stable"
else: trend = "Stable"
```

---

## 8. Forecasting UI

### Location: `frontend/js/pages/forecasting.js`

### Page Layout (top to bottom)

1. **Hero card**: Gradient header with chart-line icon, title "Demand Forecasting", subtitle
2. **Demo badge**: "SIMULATION MODE — Forecasts use synthetic historical demand data"
3. **Controls card**:
   - Product dropdown (populated from `GET /api/forecast/products`)
   - Horizon dropdown (7/14/30 days)
   - "Generate Forecast" button
4. **Results section** (hidden until first forecast):
   - **Summary grid** (4 KPI cards): Average Forecast, Peak Forecast, Forecast Trend, Forecast Horizon
   - **Chart card**: Chart.js line chart showing historical demand (solid line) + forecast (dashed line)
   - **AI Insight card**: Trend direction, current stock status badge, current inventory level, average forecast, and recommendation

### Chart.js Configuration (`renderForecastChart`)
- Type: `line` with two datasets
- Dataset 1 (Historical Demand): blue line (#3b82f6), solid, filled area, tension 0.3
- Dataset 2 (Forecasted Demand): green line (#10b981), dashed (`[6, 3]`), filled area, tension 0.3
- A null-value gap separates historical from forecast on the x-axis
- Forecast dataset includes the last historical point as anchor
- X-axis labels truncated to month-day (MM-DD)
- Y-axis starts at zero, labeled "Demand (units)"
- Max 15 x-axis ticks to avoid crowding

### Dashboard Forecast Overview (`renderForecastOverview` in dashboard.js)
- Renders a Forecast Overview card on the Dashboard page
- Shows three metrics from previewing the first 10 products:
  - Count of products with Increasing demand
  - Count with Decreasing demand
  - Highest average forecast value
- "Open Forecasting" button navigates to Forecasting page
- Errors silently ignored (card stays hidden)

### Inventory Page Integration
- Inventory detail modal includes a "View Forecast" button
- Click stores `product_id` in `localStorage('forecast_product_id')`
- Navigates to `#forecasting` page
- Forecasting page reads the preloaded ID, auto-selects the product, and auto-generates the forecast

### ML Insights Integration (`renderForecastMetrics` in ml-insights.js)
- A separate Forecasting Model card appears below the model rankings
- Shows: Holt-Winters, 200 products, 90 days history, chronological 80/20 split
- Labeled as "DEMAND FORECAST" to distinguish from the classification models

---

## 9. Decision Support Logic

The forecasting feature converts raw forecast numbers into actionable recommendations by combining the forecast **trend** with the current **stock status** from PostgreSQL.

### Recommendation Logic (in `backend/app/routes/forecast.py:43-59`)

```
IF trend == "Increasing" AND status == "Normal":
    → "Demand is expected to increase. Review inventory levels before the expected rise in demand."

IF trend == "Increasing" AND status == "Low Stock":
    → "Demand is rising while stock is already low. Urgent replenishment recommended."

IF trend == "Decreasing" AND status == "Overstock":
    → "Demand is decreasing while inventory is overstocked. Consider reducing orders or running promotions."

ELSE (other combinations):
    → "Current stock status is {status}. Forecast trend is {trend}. Continue monitoring."
```

### Risk Scenarios Addressed
| Scenario | Risk | Action |
|----------|------|--------|
| Increasing demand + Low Stock | Stockout | Urgent replenishment |
| Increasing demand + Normal | Future stockout | Review and pre-order |
| Decreasing demand + Overstock | Waste/carrying cost | Reduce orders, run promotions |
| Decreasing demand + Normal | Healthy | Continue monitoring |
| Stable + any status | Predictable | Continue monitoring |

### Chatbot Recommendations (in `chat_service.py`)
The chatbot mirrors the same logic in `_product_forecast()` and `_forecast_action()` for conversational responses.

### Limitation
The recommendation logic is heuristic (rule-based), not ML-driven. It does not consider:
- The magnitude of the trend (how fast demand is changing)
- The buffer stock level relative to the forecast
- Lead times or shelf life simultaneously
- Cost of stockout vs cost of overstock

A future enhancement could integrate all these factors into a true inventory optimization model.

---

## 10. Chatbot Architecture

### Location: `backend/app/services/chat_service.py`

### Intent Detection
- Uses regex pattern matching against 17 defined intents
- Patterns are ordered by specificity (more specific patterns first)
- First match wins
- Unknown intents fall through to generic response

### Intent List
| Intent | Trigger Pattern | Handler |
|--------|----------------|---------|
| `PRODUCT_FORECAST` | "forecast for X", "demand predict for X" | `_product_forecast()` |
| `FORECAST_TREND` | "which product increasing demand", "highest forecast" | `_forecast_trend()` |
| `FORECAST_ACTION` | "review inventory", "should reorder" | `_forecast_action()` |
| `EXPLAIN_FORECASTING` | "how does forecasting work", "explain forecast" | `_explain_forecasting()` |
| `EXPLAIN_PREDICTION` | "how does prediction work", "explain predict" | `_explain_prediction()` |
| `EXPLAIN_STATUS` | "what does low stock mean", "explain status" | `_explain_status()` |
| `BEST_MODEL` | "best model", "top classifier", "which model" | `_best_model()` |
| `MODEL_ACCURACY` | "how accurate", "model accuracy" | `_model_accuracy()` |
| `CATEGORY_LOW_STOCK` | "which category worst", "most low stock category" | `_category_low_stock()` |
| `LOW_STOCK_COUNT` | "how many low stock" | `_low_stock_count()` |
| `LOW_STOCK_PRODUCTS` | "which products low stock", "list needing attention" | `_low_stock_products()` |
| `OVERSTOCK_COUNT` | "how many overstock" | `_overstock_count()` |
| `NORMAL_STOCK_COUNT` | "how many normal stock" | `_normal_stock_count()` |
| `INVENTORY_SUMMARY` | "inventory summary", "overview", "health", "how doing" | `_inventory_summary()` |
| `PREDICTION_COUNT` | "how many predictions" | `_prediction_count()` |
| `LATEST_PREDICTION` | "latest prediction", "most recent predict" | `_latest_prediction()` |
| `PRODUCT_QUERY` | "status of product X", "check product X" | `_product_query()` |

### Frontend Chat (`frontend/js/chat.js`)
- **8 suggestion buttons** shown at the bottom of the chat panel
- 2 forecast-specific suggestions: "How does forecasting work?", "Which products have increasing demand?"
- Input field + send button
- Typing indicator animation
- Messages rendered as assistant/user bubbles
- Scroll-to-bottom on new messages

### API Endpoint
```
POST /api/chat
Body: {"message": "string"}
Response: {"message": "string", "intent": "string"}
```

---

## 11. Database Schema

### Entity-Relationship
```
┌─────────────────┐       ┌────────────────────────────┐       ┌──────────────────┐
│    products      │       │     inventory_records       │       │   predictions     │
├─────────────────┤       ├────────────────────────────┤       ├──────────────────┤
│ PK id            │◄──────│ FK product_id               │       │ PK id             │
│    product_id    │  1:N  │    store_id                 │       │    inventory_record_id│
│    product_name  │       │    inventory_level          │       │    input_data (JSON)│
│    category      │       │    units_sold               │       │    predicted_status │
│    supplier      │       │    unit_price               │       │    confidence      │
│    season        │       │    purchase_cost            │       │    probabilities   │
└─────────────────┘       │    discount                 │       │    model_name      │
                           │    temperature              │       │    created_at      │
                           │    holiday                  │       └──────────────────┘
                           │    promotion                │
                           │    lead_time                │
                           │    shelf_life               │
                           │    reorder_level            │
                           │    demand                   │
                           │    stock_status             │
                           │    recorded_at              │
                           └────────────────────────────┘
```

### Tables

#### `products`
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | Integer | PK, auto-increment | Internal ID |
| product_id | Integer | UNIQUE, NOT NULL | From CSV (Product_ID) |
| product_name | String(100) | | |
| category | String(50) | | Bakery, Dairy, Meat, etc. |
| supplier | String(100) | | |
| season | String(20) | | Winter, Spring, Summer, Fall |

#### `inventory_records`
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | Integer | PK, auto-increment | |
| product_id | Integer | FK → products.product_id | NOT the PK |
| store_id | Integer | | |
| inventory_level | Integer | | Current stock count |
| units_sold | Integer | | Sales volume |
| unit_price | Float | | |
| purchase_cost | Float | | |
| discount | Integer | | 0-100 percent |
| temperature | Float | | |
| holiday | Integer | | 0 or 1 |
| promotion | Integer | | 0 or 1 |
| lead_time | Integer | | Days |
| shelf_life | Integer | | Days |
| reorder_level | Integer | | Auto-reorder threshold |
| demand | Integer | | Historical demand |
| stock_status | String(20) | | "Low Stock", "Normal", "Overstock" |
| recorded_at | DateTime | server default now() | |

#### `predictions`
| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | Integer | PK, auto-increment | |
| inventory_record_id | Integer | FK → inventory_records.id, nullable | |
| input_data | JSON | | Full input payload |
| predicted_status | String(20) | | Model output |
| confidence | Float | | 0-1 |
| probabilities | JSON | | Per-class probabilities |
| model_name | String(50) | | "CatBoost" |
| created_at | DateTime | server default now() | |

### ORM Mapping
- SQLAlchemy Declarative Base with `Product`, `InventoryRecord`, `Prediction` models
- All in `backend/app/models.py`

### Note on Forecasting Data
The synthetic demand history CSV is **not** stored in the database. It is loaded into a pandas DataFrame in memory by `ForecastingService`. Forecast results are generated on-the-fly per request and returned directly in API responses — they are never persisted.

---

## 12. Docker Architecture

### `docker-compose.yml`
```yaml
services:
  postgres:
    image: postgres:15-alpine
    expose: [5432]
    healthcheck: pg_isready -U postgres
    volumes: [postgres_data:/var/lib/postgresql/data]

  backend:
    build:
      context: .          # Uses root context to access data/ and backend/
      dockerfile: backend/Dockerfile
    expose: [8000]
    environment:
      DATABASE_URL: postgresql://postgres:postgres@postgres:5432/grocery_ai
      MODEL_DIR: /app/backend/ml_models
    depends_on:
      postgres: { condition: service_healthy }

  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
    ports: ["7070:80"]
    depends_on: [backend]

volumes:
  postgres_data:
```

### Backend Dockerfile (multi-stage: build + runtime)
```
FROM python:3.11-slim
  install build-essential, libpq-dev
  WORKDIR /app
  COPY backend/requirements.txt → pip install
  COPY backend/ ./backend/
  COPY data/ ./data/
  RUN python backend/scripts/train_model.py        # ← CatBoost training
  RUN python backend/scripts/generate_synthetic_demand.py  # ← Demand data gen
  EXPOSE 8000
  ENV PYTHONPATH=/app/backend
  CMD uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### Frontend Dockerfile
```
FROM nginx:alpine
  COPY nginx.conf /etc/nginx/conf.d/default.conf
  COPY . /usr/share/nginx/html
  CMD nginx -g "daemon off;"
```

### Frontend Nginx Config (`frontend/nginx.conf`)
```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    location /api/ {
        proxy_pass http://backend:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

### Startup Sequence
1. `docker compose up --build`
2. PostgreSQL container starts → pg_isready health check (5s interval, 5 retries)
3. Backend container starts (waits for PostgreSQL healthy)
4. Backend `lifespan` executes:
   a. `wait_for_db()` — up to 30 retries (2s apart)
   b. `Base.metadata.create_all()` — create all tables
   c. If products table empty: `seed_data()` — inserts 200 products + 6,000 inventory records from `data/dataset.csv`
   d. `ml_service.load()` — loads CatBoost model + 6 supporting artifacts
   e. `forecasting_service.load()` — reads `data/synthetic_demand_history.csv` into pandas DataFrame
5. Frontend container starts (purely static Nginx)
6. User opens `http://localhost:7070`
7. JavaScript calls `GET /api/health` to confirm backend + ML are ready
8. Default `#dashboard` route renders via `handleRoute()` (now called on initial load)

---

## 13. Synthetic Data Disclaimer & Demo Mode

Every surface that exposes forecast data includes a clear label indicating the data is synthetic/demo:

### UI Locations
1. **Forecasting page**: "SIMULATION MODE — Forecasts use synthetic historical demand data for demonstration purposes." — rendered in a blue `demo-badge` styled div
2. **Dashboard Forecast Overview**: Subtitles read "Demand trends from synthetic historical data"
3. **ML Insights Forecasting card**: "Time-series demand forecasting using synthetic historical data"

### Chatbot Responses
- All forecast responses begin with: "Based on the simulated historical demand data, **{product}** is forecasted..."
- The `_explain_forecasting` handler states: "The forecasts are based on synthetic historical demand data for demonstration purposes."

### Code Annotations
- `generate_synthetic_demand.py` uses `np.random.seed(42)` for reproducibility
- File is clearly named `synthetic_demand_history.csv`
- The forecasting service descriptor includes "Holt-Winters Exponential Smoothing" and "synthetic" in documentation strings

### Why Synthetic Data?
The original `dataset.csv` contains a single point-in-time inventory snapshot per product with no repeated daily observations. Time-series forecasting requires date-indexed historical demand records over a continuous period. Since such data is not available in the signed dataset, a synthetic generation script creates realistic-looking daily demand data calibrated to each product's characteristics (base demand, category patterns, day-of-week effects, seasonality).

---

## 14. Frontend SPA Architecture

### Tech Stack
- **No framework**: Pure vanilla JavaScript
- **Router**: Hash-based SPA in `router.js`
- **Charts**: Chart.js 4.4 (loaded from CDN with 10s retry via `safeChart()`)
- **CSS**: Custom (~960 lines), CSS variables for theming, glassmorphism design

### Routing (`router.js`)
```
hashchange → handleRoute()
  → typewriter (page title animation, 20ms per char)
  → highlight active nav link + slide nav indicator
  → show page transition overlay (350ms slide)
  → replace content with loading spinner
  → 200ms delay (for spinner animation)
  → route.render(content)
  → addAnimateFade() — stagger entrance animations
```

### Page-Script Pattern
Each page in `frontend/js/pages/` exports a `render<Page>(container)` function:
- **dashboard.js**: `renderDashboard()` — hero, KPI counters, donut/bar charts, AI insight card, priority list, forecast overview, recent predictions, alerts
- **inventory.js**: `renderInventory()` — search bar, category/status filters, filter summary pills, paginated table, detail modal with "View Forecast" + "Run AI Prediction" buttons, CSV export
- **prediction.js**: `renderPrediction()` — 3-section form (Product Info, Inventory Metrics, Time & Logistics), submit → API call → animated result card with confidence bars + recommendation, prediction history table
- **forecasting.js**: `renderForecasting()` — product selector, horizon selector, generate button, Chart.js line chart, summary KPI grid, AI insight card (see Section 8)
- **analytics.js**: `renderAnalytics()` — insight cards, Chart.js donut (status) + horizontal bar (category) + stacked bar (status×category), summary grid
- **ml-insights.js**: `renderMLInsights()` — hero card with best model + explanation, model comparison chart, ranked model list, feature importance bars, forecasting model card

### Key UI Components
| Component | File/Pattern | Description |
|-----------|-------------|-------------|
| Navbar | `index.html` + `app.js` | Fixed top, glass, nav links with sliding indicator, search (Ctrl+K), theme toggle, ML badge, clock, mobile hamburger |
| Page header | `index.html` + `router.js` | Typewriter title + static subtitle |
| KPI cards | Global `.kpi-card` | Glass card, 3D tilt, counter animation, stagger entrance |
| Charts | Chart.js via `safeChart()` | Donut, bar, line (all Chart.js v4) |
| Tables | `.table-container` | Searchable, paginated, inline badges |
| Detail modal | `inventory.js` | Glass modal overlay with product details + action buttons |
| Toast notifications | `utils.js` `showToast()` | Animated slide-in notifications |
| AI Insight card | `.ai-insight-card` | Gradient icon + text content, used on dashboard + forecasting |
| Loading spinner | `.loading-screen` | Pulsing ring + text |
| Empty state | `.empty-state` | Centered icon + heading + description |

### Theming System
- Default theme: Light (changed from dark in this revision) — `data-theme="light"` on `<html>`
- Toggle via navbar sun/moon button → persists to `localStorage('theme')`
- CSS variables override for light mode: background becomes white, cards get light backgrounds, text becomes dark, glass effects adjust opacity

### Animations System
| Animation | Technique | Scope |
|-----------|-----------|-------|
| Aurora blobs | CSS @keyframes, 3 radial gradients with blur | Background (z-index 0) |
| Particle network | Canvas + requestAnimationFrame | Background overlay |
| Mouse glow | JS mousemove → radial gradient div | Entire page |
| 3D tilt | JS mousemove → CSS perspective transform | KPI cards, cards |
| Typewriter | JS setTimeout per char (20ms) | Page titles |
| Stagger entrance | CSS transition with `.stagger-N` delay classes | Cards on page load |
| Page transition | CSS transform: translateX slide | Between page navigations |
| Counter | JS setInterval animated numbers | KPI values |
| Confidence bars | CSS width transition | Prediction results |
| Toast | CSS keyframes slideIn from right | Notifications |
| Ripple click | CSS pseudo-element scale animation | Buttons |

### Global Search
- Trigger: Ctrl+K or search icon click
- Live search via `GET /api/inventory?search=...` (debounced 300ms)
- Results: product name, category, stock status badge
- Click result: navigates to Inventory page, pre-fills search input
- Escape closes

### JavaScript Load Order
```html
<script src="js/utils.js">
<script src="js/particles.js">
<script src="js/api.js">
<script src="js/chat.js">
<script src="js/pages/dashboard.js">
<script src="js/pages/inventory.js">
<script src="js/pages/prediction.js">
<script src="js/pages/forecasting.js">
<script src="js/pages/analytics.js">
<script src="js/pages/ml-insights.js">
<script src="js/router.js">       <!-- defines handleRoute() globally -->
<script src="js/app.js">          <!-- DOMContentLoaded → initTheme(), wraps handleRoute(), calls handleRoute() -->
```

---

## Appendix: File Map

### Project Root (`grocery-inventory-ai/`)
| File | Purpose |
|------|---------|
| `docker-compose.yml` | 3-service orchestration |
| `AGENTS.md` | Full project context for AI |
| `PROJECT_ARCHITECTURE.md` | This document |
| `README.md` | Quick start guide |
| `data/dataset.csv` | 6,000 original records (source of truth for training + DB) |
| `data/synthetic_demand_history.csv` | 18,000 synthetic daily demand records (generated at build) |

### Backend (`backend/`)
| Path | Purpose |
|------|---------|
| `Dockerfile` | Multi-stage build: train model + generate data + serve |
| `requirements.txt` | Python dependencies |
| `scripts/train_model.py` | CatBoost training pipeline |
| `scripts/generate_synthetic_demand.py` | Synthetic demand data generator |
| `app/main.py` | FastAPI app, lifespan, init_db(), seed_data() |
| `app/config.py` | Pydantic Settings (DATABASE_URL, MODEL_DIR) |
| `app/database.py` | SQLAlchemy engine, session, Base |
| `app/models.py` | ORM: Product, InventoryRecord, Prediction |
| `app/schemas.py` | Pydantic request/response models |
| `app/routes/dashboard.py` | GET /api/dashboard |
| `app/routes/products.py` | GET /api/products, /api/products/{id} |
| `app/routes/prediction.py` | POST /api/predict, GET /api/predictions |
| `app/routes/ml.py` | GET /api/ml/metrics, /api/ml/feature-importance |
| `app/routes/chat.py` | POST /api/chat |
| `app/routes/forecast.py` | POST /api/forecast, GET /api/forecast/products, GET /api/forecast/overview |
| `app/services/ml_service.py` | MLService: load model, predict, COLUMN_MAP |
| `app/services/forecasting_service.py` | ForecastingService: load CSV, per-request Holt-Winters, overview |
| `app/services/chat_service.py` | ChatService: intent detection, 17 handlers |
| `ml_models/` | Generated at build (catboost_model.cbm, encoders, scaler, etc.) |

### Frontend (`frontend/`)
| Path | Purpose |
|------|---------|
| `Dockerfile` | Nginx serving static files |
| `nginx.conf` | Proxy /api/* → backend:8000, SPA fallback |
| `index.html` | SPA shell: navbar, page container, backgrounds, chat widget |
| `css/style.css` | Complete design system (~960 lines, CSS variables, glassmorphism) |
| `js/utils.js` | showToast(), safeChart(), debounce(), animateCounter(), theme functions, exportCSV() |
| `js/particles.js` | ParticleNetwork canvas animation |
| `js/api.js` | API client: health, dashboard, products, inventory, predict, ml metrics, forecast |
| `js/chat.js` | Chat widget UI: toggle, sendMessage, suggestions |
| `js/router.js` | Hash-based SPA router with typewriter + transitions |
| `js/app.js` | Bootstrap: particle init, mouse glow, search, nav indicator, 3D tilt, clock, handleRoute() |
| `js/pages/dashboard.js` | Dashboard page render |
| `js/pages/inventory.js` | Inventory page render |
| `js/pages/prediction.js` | AI Prediction page render |
| `js/pages/forecasting.js` | Forecasting page render |
| `js/pages/analytics.js` | Analytics page render |
| `js/pages/ml-insights.js` | ML Insights page render |
