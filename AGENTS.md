# StockIntel AI — Complete Project Architecture

## Overview

StockIntel AI is a Dockerized, AI-powered grocery inventory decision support system. It uses a CatBoost ML model to classify stock status (Low Stock, Normal, Overstock) across 200 products (6,000 inventory records). The frontend is a premium 5-page SPA with glassmorphism, particle animations, 3D tilt cards, and a floating glass navbar.

---

## 1. Data Pipeline

```
data/dataset.csv  (6,000 rows, 18 features, shipped in repo)
       │
       ├── Docker Build ──▶  backend/scripts/train_model.py
       │                        │
       │                        ├── Reads CSV
       │                        ├── Encodes categories (LabelEncoder)
       │                        ├── Scales features (StandardScaler)
       │                        ├── Trains CatBoostClassifier
       │                        │   (iterations=200, depth=6, lr=0.1)
       │                        └── Saves artifacts to backend/ml_models/
       │                              ├── catboost_model.cbm
       │                              ├── label_encoders.pkl
       │                              ├── target_encoder.pkl
       │                              ├── scaler.pkl
       │                              ├── feature_names.pkl
       │                              ├── metrics.pkl
       │                              └── feature_importance.pkl
       │
       └── First Startup ──▶  backend/app/main.py :: init_db()
                                    │
                                    ├── Waits for PostgreSQL (retry 30x)
                                    ├── Creates all tables via SQLAlchemy
                                    ├── Checks if products table is empty
                                    └── If empty: reads CSV and seeds
                                         ├── 200 Products (Product table)
                                         └── 6,000 InventoryRecords
                                                    │
                                                    ▼
                                          PostgreSQL Database
                                                    │
                                                    ▼
                                        API endpoints serve data
                                              │
                                              ▼
                                        SPA Frontend renders
```

**Key**: The CSV is used ONLY during build (training) and first startup (seeding). After that, all data lives in PostgreSQL. The `dataset.csv` ships with the repo — `docker compose up --build` auto-seeds everything.

---

## 2. System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Docker Compose                         │
│                                                           │
│  ┌──────────────┐    ┌──────────────┐    ┌────────────┐  │
│  │   Frontend    │    │   Backend     │    │ PostgreSQL │  │
│  │   Nginx       │◀──▶│   FastAPI     │◀──▶│   :5432    │  │
│  │   :8080       │    │   :8000       │    │            │  │
│  │               │    │               │    │ grocery_ai │  │
│  │  SPA (static) │    │  CatBoost ML  │    │            │  │
│  └──────────────┘    └──────────────┘    └────────────┘  │
│       │                    │                               │
│       │    nginx.conf      │  mounts ml_models/            │
│       │    /api/* → backend│  reads artifacts at startup   │
│       │    /*    → SPA     │                               │
│       └────────────────────┘                               │
└─────────────────────────────────────────────────────────┘
```

### Service Dependencies

```
postgres (healthy) → backend (starts) → frontend (starts after backend)
```

### Network
- All services on a shared Docker bridge network
- Backend accessible internally at `backend:8000`
- Frontend proxied: `/api/*` → `http://backend:8000/api/*`
- Frontend served externally at `http://localhost:8080`

---

## 3. Directory Structure

```
grocery-inventory-ai/
├── AGENTS.md                          # ← This file — full project context for AI
├── README.md                          # Quick start guide
├── docker-compose.yml                 # 3-service orchestration
├── data/
│   └── dataset.csv                    # 6,000 rows, 18 features, source of truth
│
├── backend/
│   ├── Dockerfile                     # Multi-stage: train model → run FastAPI
│   ├── requirements.txt              # FastAPI, SQLAlchemy, CatBoost, pandas, etc.
│   ├── ml_models/                    # Generated during build (not committed to git)
│   │   ├── catboost_model.cbm        # Trained CatBoost model
│   │   ├── label_encoders.pkl        # LabelEncoder for each categorical column
│   │   ├── target_encoder.pkl        # LabelEncoder for Stock_Status
│   │   ├── scaler.pkl                # StandardScaler fitted on training data
│   │   ├── feature_names.pkl         # Ordered list of 18 feature names
│   │   ├── metrics.pkl               # Dict: accuracy, precision, recall, f1, roc_auc
│   │   └── feature_importance.pkl    # List of {Feature, Importance} dicts
│   ├── scripts/
│   │   └── train_model.py            # Replicates Colab notebook pipeline exactly
│   └── app/
│       ├── __init__.py
│       ├── main.py                   # FastAPI app, lifespan, init_db(), seed_data()
│       ├── config.py                 # Settings via Pydantic (DATABASE_URL, MODEL_DIR)
│       ├── database.py               # SQLAlchemy engine, session, Base
│       ├── models.py                 # ORM: Product, InventoryRecord, Prediction
│       ├── schemas.py                # Pydantic models for request/response
│       ├── routes/
│       │   ├── __init__.py
│       │   ├── dashboard.py          # GET /api/dashboard — KPIs, distributions, alerts
│       │   ├── products.py           # GET /api/products, GET /api/products/{id}
│       │   ├── prediction.py         # POST /api/predict, GET /api/predictions
│       │   └── ml.py                 # GET /api/ml/metrics, /api/ml/feature-importance
│       └── services/
│           ├── __init__.py
│           └── ml_service.py         # MLService class: load model, predict, column mapping
│
└── frontend/
    ├── Dockerfile                    # Nginx serving static SPA
    ├── nginx.conf                    # Proxy /api/* → backend:8000
    ├── index.html                    # SPA shell: navbar, page container, bg effects
    ├── css/
    │   └── style.css                 # Complete dark theme design system (~960 lines)
    └── js/
        ├── utils.js                  # showToast(), safeChart(), debounce(), animateCounter()
        ├── particles.js              # ParticleNetwork class — connected dots canvas
        ├── api.js                    # API wrapper: health(), dashboard(), products(), predict()
        ├── router.js                 # Hash-based SPA router with typewriter, transitions
        ├── app.js                    # Bootstrap: 3D tilt, mouse glow, nav indicator, clock
        └── pages/
            ├── dashboard.js          # KPI counters, donut/bar charts, alerts list
            ├── inventory.js          # Searchable table with detail modal, pagination
            ├── prediction.js         # 18-field form → ML predict → animated confidence bars
            ├── analytics.js          # Insight cards, status/category charts, summary grid
            └── ml-insights.js        # Model rankings, comparison chart, feature importance
```

---

## 4. Tech Stack

| Layer | Technology | Version / Notes |
|-------|-----------|-----------------|
| Backend | Python 3.11 + FastAPI | Async startup, sync DB |
| ORM | SQLAlchemy 2.0 | Declarative Base |
| Validation | Pydantic v2 | Pydantic Settings for config |
| ML | CatBoost | Classifier, iterations=200, depth=6 |
| ML Pipeline | scikit-learn | LabelEncoder, StandardScaler, train_test_split |
| Database | PostgreSQL 15 | Alpine image, health check |
| Frontend | Vanilla JS | No framework — pure DOM manipulation |
| Charts | Chart.js 4.4 | CDN-loaded with 10s safeChart() retry |
| Icons | Font Awesome 6 | CDN-loaded |
| Font | Inter | Google Fonts |
| CSS | Custom | 960+ lines, CSS variables, glassmorphism |
| Animations | CSS + JS | Aurora, particles, 3D tilt, typewriter, stagger |
| Container | Docker + Compose | 3 services, health checks, named volume |
| Web Server | Nginx | Alpine, proxy pass for API |

---

## 5. Backend — API Endpoints

### `GET /api/health`
Returns ML model status.

**Response:**
```json
{"status": "ok", "ml_loaded": true, "model": "CatBoost"}
```

### `GET /api/dashboard`
Aggregated KPIs, distributions, alerts.

**Response fields:** `total_products`, `total_records`, `low_stock_count`, `normal_stock_count`, `overstock_count`, `status_distribution` (array of {status, count}), `category_distribution` (array of {category, count}), `recent_predictions` (last 10), `recent_alerts` (last 5 low stock).

### `GET /api/products?page=1&per_page=20`
Paginated product list with latest inventory record.

### `GET /api/products/{product_id}`
Single product detail + all its inventory records.

### `GET /api/inventory?search=&status=&category=&page=1&per_page=20`
Filterable, paginated inventory records with product info.

### `POST /api/predict`
Submit 18 features → get ML prediction.

**Request:**
```json
{
  "product_id": 1,
  "product_name": "Product_001",
  "category": "Meat",
  "supplier": "Supplier_6",
  "store_id": 5,
  "inventory_level": 272,
  "units_sold": 16,
  "unit_price": 40.98,
  "purchase_cost": 25.39,
  "discount": 5,
  "temperature": 28.3,
  "holiday": 0,
  "promotion": 1,
  "lead_time": 1,
  "shelf_life": 47,
  "reorder_level": 78,
  "season": "Winter",
  "demand": 24
}
```

**Response:**
```json
{
  "predicted_status": "Overstock",
  "confidence": 0.9876,
  "probabilities": {"Low Stock": 0.002, "Normal": 0.011, "Overstock": 0.987},
  "model_name": "CatBoost",
  "recommendation": "Inventory is overstocked..."
}
```

### `GET /api/predictions?limit=20`
Prediction history, newest first.

### `GET /api/ml/metrics`
Model performance: accuracy, precision, recall, f1, roc_auc.

### `GET /api/ml/feature-importance`
Ranked list of {Feature, Importance}.

---

## 6. Frontend — SPA Architecture

### Router (`router.js`)
- Hash-based SPA: `#dashboard`, `#inventory`, `#prediction`, `#analytics`, `#ml-insights`
- `ROUTES` object maps hash → {title, subtitle, render function}
- `handleRoute()`: reads hash → shows loading → 150ms delay → calls `route.render()` → adds stagger animations → shows transition overlay (350ms slide)
- `typewriter()`: animates page title character by character (20ms per char)
- `addAnimateFade()`: adds `.animate-fade` + `.stagger-N` classes to cards/items

### Page Loading Flow
```
hashchange → handleRoute()
  → typewriter (title animation)
  → highlight nav link + slide indicator
  → show transition overlay (350ms)
  → show loading spinner
  → 200ms delay
  → route.render(content) — page populates its HTML
  → addAnimateFade() — stagger entrance animations
  → 50ms → cards fade in
```

### Page Scripts (in `pages/`)
Each page script defines a global `render<Page>(container)` function:
- **dashboard.js**: `renderDashboard()` — KPI grid, Chart.js donut + bar, recent predictions list, low-stock alerts
- **inventory.js**: `renderInventory()` — search input, status/category filters, table, pagination, detail modal
- **prediction.js**: `renderPrediction()` — 18-field form, submit → API call → animated result card with confidence bars
- **analytics.js**: `renderAnalytics()` — insight cards, Chart.js doughnut (status) + horizontal bar (category), summary grid
- **ml-insights.js**: `renderMLInsights()` — model ranking cards, comparison bar chart, feature importance horizontal bars

### Global Utilities (`utils.js`)
- `showToast(message, type)` — animated toast notification (success/error/info)
- `safeChart(callback, maxRetries=20, interval=500)` — waits for Chart.js to load, then calls callback
- `debounce(fn, delay)` — standard debounce
- `animateCounter(el, target, duration)` — number counter animation
- `statusBadgeClass(status)` — maps "Low Stock"→"danger", "Normal"→"success", "Overstock"→"warning"

### API Client (`api.js`)
- Singleton `API` object with methods: `health()`, `dashboard()`, `products(params)`, `product(id)`, `inventory(params)`, `predict(data)`, `predictions(limit)`, `mlMetrics()`, `featureImportance()`
- All return parsed JSON, throw on error

### Animations System
| Animation | Implementation | Trigger |
|-----------|---------------|---------|
| Particle network | Canvas + requestAnimationFrame | On load |
| Aurora blobs | CSS @keyframes, 3 layers | On load |
| Mouse glow | JS mousemove → div positioning | On load |
| 3D tilt | JS mousemove → perspective rotateX/Y | KPI/card hover |
| Typewriter | JS setTimeout per character | Page navigation |
| Stagger entrance | CSS transition with stagger-N delay | Post-render |
| Page transition | CSS transform overlay slide | Hash change |
| Spinner | CSS rotate animation | During loading |
| Ripple click | CSS pseudo-element scale anim | Button click |
| Counter | JS setInterval increment | KPI numbers |
| Confidence bar | CSS width transition | Prediction result |
| Toast | CSS slideIn animation | showToast() call |
| Status dot pulse | CSS @keyframes pulse | Active state |

---

## 7. ML Pipeline (from Colab)

### Training (`train_model.py`)
1. Load CSV (6,000 rows)
2. Drop duplicates
3. Parse Date → Year, Month, Day; then drop Date
4. Fill missing: mode for categorical, median for numeric
5. Encode categoricals (LabelEncoder), encode target (Stock_Status)
6. Train/test split (80/20, stratified)
7. Scale features (StandardScaler)
8. Train CatBoostClassifier:
   - iterations=200, learning_rate=0.1, depth=6
   - loss_function=MultiClass, random_seed=42
9. Evaluate: accuracy, precision, recall, f1, roc_auc
10. Save all artifacts to `backend/ml_models/`

### Model Artifacts
| File | Contents |
|------|----------|
| `catboost_model.cbm` | Trained CatBoost model binary |
| `label_encoders.pkl` | Dict of column → LabelEncoder (for each categorical feature) |
| `target_encoder.pkl` | LabelEncoder for Stock_Status (maps to/from class names) |
| `scaler.pkl` | StandardScaler fitted on training features |
| `feature_names.pkl` | Ordered list of 18 feature column names |
| `metrics.pkl` | Dict: {accuracy, precision, recall, f1, roc_auc} |
| `feature_importance.pkl` | List of {Feature, Importance} sorted descending |

### Prediction Service (`ml_service.py`)
- `MLService` singleton loaded at startup in `lifespan` handler
- `predict(input_data: dict)`: maps snake_case keys → CSV column names → encodes categoricals → scales → predict → inverse_transform target → return {predicted_status, confidence, probabilities, recommendation}
- Column mapping (snake_case → CSV format) defined in `COLUMN_MAP`

### Metrics (current)
```
Accuracy : 0.9917
Precision: 0.9917
Recall   : 0.9917
F1 Score : 0.9917
ROC AUC  : 0.9990
```

---

## 8. Database Schema

### `products`
| Column | Type | Notes |
|--------|------|-------|
| id | Integer | PK, auto-increment |
| product_id | Integer | Unique, from CSV |
| product_name | String | |
| category | String | |
| supplier | String | |
| season | String | |

### `inventory_records`
| Column | Type | Notes |
|--------|------|-------|
| id | Integer | PK |
| product_id | Integer | FK → products.product_id |
| store_id | Integer | |
| inventory_level | Integer | |
| units_sold | Integer | |
| unit_price | Float | |
| purchase_cost | Float | |
| discount | Integer | |
| temperature | Float | |
| holiday | Integer | 0/1 |
| promotion | Integer | 0/1 |
| lead_time | Integer | |
| shelf_life | Integer | |
| reorder_level | Integer | |
| demand | Integer | |
| stock_status | String | Low Stock / Normal / Overstock |
| recorded_at | DateTime | server default now() |

### `predictions`
| Column | Type | Notes |
|--------|------|-------|
| id | Integer | PK |
| inventory_record_id | Integer | FK → inventory_records.id (nullable) |
| input_data | JSON | Full input payload |
| predicted_status | String | ML output |
| confidence | Float | 0-1 |
| probabilities | JSON | Per-class probabilities |
| model_name | String | "CatBoost" |
| created_at | DateTime | server default now() |

---

## 9. Frontend Design System

### Colors
```
--primary:        #059669  (emerald)
--primary-light:  #10b981
--secondary:      #6366f1  (indigo)
--cyan:           #06b6d4
--accent:         #f59e0b  (amber)
--bg:             #070b14  (deep navy)
--bg-card:        rgba(17, 25, 45, 0.65)
--text:           #f0f4f8
--text-muted:     #64748b
--success:        #10b981
--warning:        #f59e0b
--danger:         #ef4444
```

### Glassmorphism
- All cards have `background: rgba(...)`, `backdrop-filter: blur(16px)`, `border: 1px solid rgba(...)`
- Navbar has `backdrop-filter: blur(24px)`, 55% opacity background
- Modals use backdrop-filter blur on overlay

### Background Layers (z-index 0)
1. Aurora blobs (3x radial gradient, blur(120px), animated)
2. Particle canvas (connected dots)
3. Grid pattern (subtle 60px grid lines)
4. Scan lines (CRT overlay)
5. Mouse glow (radial gradient following cursor)

### Navbar
- Fixed top, 64px height
- Glass background (blur 24px)
- Center: nav links in a subtle pill container with sliding green indicator
- Right: ML status badge + clock
- Mobile: hamburger → slide-down glass menu

### Page Header
- Title with typewriter animation
- Subtitle (static)
- Animated orb decoration

### KPI Cards
- Glass background, 3D tilt on mouse move (`perspective(800px) rotateX/Y`)
- Top gradient border on hover
- Staggered entrance animation

### Responsive Breakpoints
- 1200px: 4-col → 2-col grids
- 1024px: nav link text hidden (icons only)
- 768px: sidebar→hamburger, 2-col→1-col, time hidden
- 480px: KPI 2-col→1-col, status badge hidden

---

## 10. Docker Setup

### `docker-compose.yml`
```yaml
services:
  postgres:     # postgres:15-alpine, port 5432 (internal), named volume
  backend:      # build from ./backend/Dockerfile, port 8000
  frontend:     # build from ./frontend/Dockerfile, port 8080
```

### Backend Dockerfile
```
FROM python:3.11-slim
  → install system deps
  → copy backend/
  → pip install -r requirements.txt
  → RUN python scripts/train_model.py    # ← Trains model during BUILD
  → CMD uvicorn app.main:app --host 0.0.0.0 --port 8000
```

### Frontend Dockerfile
```
FROM nginx:alpine
  → COPY nginx.conf /etc/nginx/conf.d/default.conf
  → COPY . /usr/share/nginx/html
  → CMD nginx -g "daemon off;"
```

### Nginx Config (`frontend/nginx.conf`)
```nginx
server {
  listen 80;
  root /usr/share/nginx/html;
  index index.html;

  location /api/ {
    proxy_pass http://backend:8000/api/;
    proxy_set_header Host $host;
  }

  location / {
    try_files $uri $uri/ /index.html;
  }
}
```

---

## 11. Startup Sequence

1. `docker compose up --build`
2. PostgreSQL container starts → health check (pg_isready)
3. Backend container starts (waits for PostgreSQL healthy)
4. Backend `lifespan`:
   a. `wait_for_db()` — retries up to 30 times (2s interval)
   b. `Base.metadata.create_all()` — creates tables
   c. If products table empty: `seed_data()` reads CSV → inserts 200 Products + 6,000 InventoryRecords
   d. `ml_service.load()` — loads CatBoost model + artifacts from disk
5. Frontend container starts (Nginx, no dependency wait)
6. User opens http://localhost:8080
7. Frontend JS calls `/api/health` → confirms ML loaded
8. Default route `#dashboard` renders

---

## 12. Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Vanilla JS (no framework)** | Zero build step, faster page loads, Nginx serves files directly |
| **Hash-based routing** | No server-side config needed for SPA, works with Nginx out of box |
| **Model trained at Docker build** | No runtime training, faster startup, consistent model per build |
| **CSV seeded into DB at startup** | Fresh PostgreSQL instance gets auto-populated, no manual import |
| **Chart.js via CDN with retry** | Avoids bundle size, safeChart() handles slow/unreliable CDN |
| **CSS variables for theming** | Consistent colors, easy to customize, dark mode by default |
| **Glassmorphism design** | Premium look, works well with dark backgrounds, hides layout imperfections |
| **3D tilt on hover** | Adds tactile feedback, makes cards feel physical and premium |
| **Column name mapping in ML service** | Decouples UI field names from CSV column names, allows flexibility |

---

## 13. Common Issues & Fixes

| Issue | Cause | Fix |
|-------|-------|-----|
| "renderDashboard is not defined" | Script loading order | Load page scripts before router.js |
| Charts not rendering | Chart.js CDN slow/blocked | safeChart() retries up to 10s |
| "showToast is not defined" | Toast utility loaded after page scripts | Load utils.js as first script |
| DB connection refused | PostgreSQL not ready | Backend retries up to 30 times (2s each) |
| Model not found | Build didn't copy ml_models/ | Mount or COPY in Dockerfile |
| CORS error | Backend and frontend on different ports | CORSMiddleware allows all origins |
| Animation jank on low-end devices | Too many particles | Reduce `count` in particles.js |
| Mobile navbar not working | Missing mobile menu handler | app.js has mobile-nav toggle logic |

---

## 14. How to Run

```bash
# Prerequisites: Docker + Docker Compose
git clone <repo-url>
cd grocery-inventory-ai
docker compose up --build
# Open http://localhost:8080
```

### Environment Variables
All configurable via `.env` file in project root:

```env
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/grocery_ai
MODEL_DIR=/app/backend/ml_models
```

### Data Flow Verification
```bash
# Check API health
curl http://localhost:8080/api/health

# Check dashboard data
curl http://localhost:8080/api/dashboard | python3 -m json.tool

# Make a prediction
curl -X POST http://localhost:8080/api/predict \
  -H "Content-Type: application/json" \
  -d '{"product_id":1,"product_name":"Product_001","category":"Meat","supplier":"Supplier_6","store_id":5,"inventory_level":272,"units_sold":16,"unit_price":40.98,"purchase_cost":25.39,"discount":5,"temperature":28.3,"holiday":0,"promotion":1,"lead_time":1,"shelf_life":47,"reorder_level":78,"season":"Winter","demand":24}'
```

---

## 15. File Change History (UI Overhaul)

The frontend underwent a major redesign (commit `df75f25`):
- **Layout**: Left sidebar → floating glass top navbar
- **Background**: Static gradient orbs → animated aurora blobs + particle network
- **Cards**: Flat dark → 3D tilt glassmorphism with backdrop blur
- **Navigation**: Static sidebar links → sliding green indicator pill
- **Page transitions**: Instant swap → slide overlay animation (350ms)
- **Titles**: Static text → typewriter effect
- **Card entrance**: Instant → staggered fade-in with spring easing
- **Interactions**: Basic hover → 3D tilt, ripple click, mouse glow
- **Responsive**: Desktop-only → full mobile support with hamburger menu

Previous commits:
- `5b7baf6` — Added particle network, mouse glow, typewriter, stagger, glassmorphism
- `8b951cd` — Initial commit: full project scaffold
