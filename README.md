# StockIntel AI — Grocery Inventory Decision Support System

An intelligent decision support system for grocery inventory optimization using machine learning. Built with FastAPI, PostgreSQL, and a premium vanilla JS frontend.

## Quick Start

```bash
git clone <repository>
cd grocery-inventory-ai
docker compose up --build
```

Open **http://localhost:8080** in your browser.

## Architecture

```
User → Nginx → FastAPI → CatBoost Model
                   ↘ PostgreSQL
```

Three Docker containers:
- **Frontend** — Nginx serving a modern SPA dashboard
- **Backend** — FastAPI with integrated ML model (CatBoost, 99.17% accuracy)
- **PostgreSQL** — Persistent data storage

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | HTML5, CSS3, Vanilla JS, Chart.js |
| Backend | Python, FastAPI, Pydantic, SQLAlchemy |
| Database | PostgreSQL 15 |
| ML | CatBoost (trained on 6,000 records) |
| Container | Docker, Docker Compose |

## Pages

1. **Dashboard** — KPI cards, stock distribution charts, recent predictions, low-stock alerts
2. **Inventory** — Searchable/filterable product table with detail modal
3. **AI Prediction** — Form-based ML prediction with confidence scores
4. **Analytics** — Visual insights and stock health metrics
5. **ML Insights** — Model comparison, rankings, feature importance

## ML Model

- **Best Model**: CatBoost (Accuracy: 99.17%, F1: 99.17%)
- **Task**: Multi-class stock status classification
- **Classes**: Low Stock, Normal, Overstock
- **Features**: 18 inventory and product attributes
- **Training**: Model is trained during Docker build, no retraining at runtime

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check with ML status |
| GET | `/api/dashboard` | KPIs, distributions, alerts |
| GET | `/api/products` | Paginated product list |
| GET | `/api/products/{id}` | Product detail |
| GET | `/api/inventory` | Inventory records with filters |
| POST | `/api/predict` | Submit features for prediction |
| GET | `/api/predictions` | Prediction history |
| GET | `/api/ml/metrics` | All model performance metrics |
| GET | `/api/ml/feature-importance` | Feature importance rankings |

## Development

```bash
# Backend only
cd backend
pip install -r requirements.txt
python scripts/train_model.py
uvicorn app.main:app --reload

# Frontend only (serve with any static server)
cd frontend
python -m http.server 3000
```
