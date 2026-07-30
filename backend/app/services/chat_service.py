import re
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from app.models import Product, InventoryRecord, Prediction
from app.services.ml_service import ml_service
from app.services.forecasting_service import forecasting_service

INTENTS = [
    ("PRODUCT_FORECAST", r"(forecast|demand.*predict|future.*demand).*(for|of)\s+(the\s+)?(.+)"),
    ("FORECAST_TREND", r"(which.*product|product.*which|increasing.*demand|highest.*forecast)"),
    ("FORECAST_ACTION", r"(review.*inventory|should.*(reorder|order|stock|review)|inventory.*(action|review|attention).*forecast)"),
    ("EXPLAIN_FORECASTING", r"(how.*(forecast|future.*demand|time.?series).*work|explain.*forecast|what.*forecast)"),
    ("EXPLAIN_PREDICTION", r"(how.*(prediction|ai.*predict|ml.*predict|classification).*work|explain.*predict)"),
    ("EXPLAIN_STATUS", r"(what.*(low.?stock|normal|overstock|medium|high).*mean|explain.*status|status.*definition)"),
    ("BEST_MODEL", r"(best|top).*(model|performer|classifier)|(which model|what model)"),
    ("MODEL_ACCURACY", r"(what is|how.*accurate|model.*accuracy|accuracy.*model|accuracy.*ml)"),
    ("CATEGORY_LOW_STOCK", r"(which category|what category|category.*(most|worst)|(most|worst).*category)"),
    ("LOW_STOCK_COUNT", r"(how many|count of|number of)\s.*(low.?stock|understock|low inventory)"),
    ("LOW_STOCK_PRODUCTS", r"(which|what|list|show).*(product|item).*(low.?stock|need attention|attention|reorder)"),
    ("OVERSTOCK_COUNT", r"(how many|count of|number of)\s.*(over.?stock|high.?stock|excess)"),
    ("NORMAL_STOCK_COUNT", r"(how many|count of|number of)\s.*(normal.?stock|adequately.?stocked|healthy)"),
    ("INVENTORY_SUMMARY", r"(inventory.?summary|overview|health|how.*doing|tell me about)"),
    ("PREDICTION_COUNT", r"(how many|count of|number of)\s.*(prediction)"),
    ("LATEST_PREDICTION", r"(latest|most recent|last|newest)\s.*(prediction|predict)"),
    ("PRODUCT_QUERY", r"(what is the stock status of|stock status of|check product|status of product)\s+(the\s+)?(.+?)(\?|$)"),
]


def detect_intent(message: str) -> str:
    msg = message.lower().strip()
    for intent, pattern in INTENTS:
        if re.search(pattern, msg):
            return intent
    return "UNKNOWN"


class ChatService:
    def __init__(self, db: Session):
        self.db = db

    def process_message(self, message: str) -> dict:
        intent = detect_intent(message)
        response = self._handle_intent(intent, message)
        response["intent"] = intent
        return response

    def _handle_intent(self, intent: str, message: str) -> dict:
        handlers = {
            "LOW_STOCK_COUNT": self._low_stock_count,
            "LOW_STOCK_PRODUCTS": self._low_stock_products,
            "OVERSTOCK_COUNT": self._overstock_count,
            "NORMAL_STOCK_COUNT": self._normal_stock_count,
            "INVENTORY_SUMMARY": self._inventory_summary,
            "PRODUCT_QUERY": self._product_query,
            "PREDICTION_COUNT": self._prediction_count,
            "LATEST_PREDICTION": self._latest_prediction,
            "BEST_MODEL": self._best_model,
            "MODEL_ACCURACY": self._model_accuracy,
            "EXPLAIN_STATUS": self._explain_status,
            "EXPLAIN_PREDICTION": self._explain_prediction,
            "EXPLAIN_FORECASTING": self._explain_forecasting,
            "CATEGORY_LOW_STOCK": self._category_low_stock,
            "PRODUCT_FORECAST": self._product_forecast,
            "FORECAST_TREND": self._forecast_trend,
            "FORECAST_ACTION": self._forecast_action,
        }
        handler = handlers.get(intent, self._unknown)
        return handler(message)

    def _low_stock_count(self, message: str) -> dict:
        count = self.db.query(InventoryRecord).filter(
            InventoryRecord.stock_status == "Low Stock"
        ).count()
        return {"message": f"There are {count} products currently classified as low stock."}

    def _low_stock_products(self, message: str) -> dict:
        records = (
            self.db.query(InventoryRecord)
            .join(Product)
            .filter(InventoryRecord.stock_status == "Low Stock")
            .order_by(InventoryRecord.inventory_level.asc())
            .limit(5)
            .all()
        )
        if not records:
            return {"message": "No products currently need attention. All stock levels are adequate."}
        names = [f"{r.product.product_name} ({r.inventory_level} units, demand: {r.demand})" for r in records]
        msg = "Products needing attention:\n" + "\n".join(f"• {n}" for n in names)
        if len(records) == 5:
            more = self.db.query(InventoryRecord).filter(
                InventoryRecord.stock_status == "Low Stock"
            ).count() - 5
            if more > 0:
                msg += f"\n...and {more} more."
        return {"message": msg}

    def _overstock_count(self, message: str) -> dict:
        count = self.db.query(InventoryRecord).filter(
            InventoryRecord.stock_status == "Overstock"
        ).count()
        return {"message": f"There are {count} products currently classified as overstock."}

    def _normal_stock_count(self, message: str) -> dict:
        count = self.db.query(InventoryRecord).filter(
            InventoryRecord.stock_status == "Normal"
        ).count()
        return {"message": f"There are {count} products currently at normal stock levels."}

    def _inventory_summary(self, message: str) -> dict:
        total_products = self.db.query(Product).count()
        total_records = self.db.query(InventoryRecord).count()
        low = self.db.query(InventoryRecord).filter(
            InventoryRecord.stock_status == "Low Stock"
        ).count()
        normal = self.db.query(InventoryRecord).filter(
            InventoryRecord.stock_status == "Normal"
        ).count()
        over = self.db.query(InventoryRecord).filter(
            InventoryRecord.stock_status == "Overstock"
        ).count()
        msg = (
            f"📊 Inventory Summary:\n"
            f"• {total_products} products across {total_records} records\n"
            f"• {low} low stock ({low/total_records*100:.1f}%)\n"
            f"• {normal} normal stock ({normal/total_records*100:.1f}%)\n"
            f"• {over} overstock ({over/total_records*100:.1f}%)\n"
            f"• CatBoost model accuracy: 99.17%"
        )
        return {"message": msg}

    def _product_query(self, message: str) -> dict:
        match = re.search(r"(stock status of|check product|status of product)\s+(the\s+)?(.+?)(\?|$)", message, re.IGNORECASE)
        if not match:
            msg_lower = message.lower().strip()
            candidates = [w for w in msg_lower.split() if w.startswith("product_")]
            if candidates:
                query = candidates[0]
            else:
                return {"message": "Please specify a product name. For example: 'What is the stock status of Product_001?'"}
        else:
            query = match.group(3).strip().lower()
        products = self.db.query(Product).filter(
            Product.product_name.ilike(f"%{query}%")
        ).all()
        if not products:
            return {"message": f"I couldn't find a product matching '{query}'. Try using the full product name like 'Product_001'."}
        result = f"Found {len(products)} product(s):"
        for p in products[:3]:
            latest = self.db.query(InventoryRecord).filter(
                InventoryRecord.product_id == p.product_id
            ).order_by(InventoryRecord.id.desc()).first()
            if latest:
                result += f"\n• {p.product_name} — {latest.stock_status} (inventory: {latest.inventory_level}, demand: {latest.demand})"
            else:
                result += f"\n• {p.product_name} — No inventory records"
        return {"message": result}

    def _prediction_count(self, message: str) -> dict:
        count = self.db.query(Prediction).count()
        return {"message": f"{count} predictions have been made using the CatBoost model."}

    def _latest_prediction(self, message: str) -> dict:
        pred = self.db.query(Prediction).order_by(Prediction.created_at.desc()).first()
        if not pred:
            return {"message": "No predictions have been made yet. Use the AI Prediction page to run one."}
        return {
            "message": (
                f"Latest prediction (ID #{pred.id}):\n"
                f"• Status: {pred.predicted_status}\n"
                f"• Confidence: {pred.confidence*100:.1f}%\n"
                f"• Model: {pred.model_name}\n"
                f"• Time: {pred.created_at.strftime('%Y-%m-%d %H:%M') if pred.created_at else 'N/A'}"
            )
        }

    def _best_model(self, message: str) -> dict:
        if ml_service.is_loaded and ml_service.metrics:
            m = ml_service.metrics
            return {
                "message": (
                    f"The best performing model is **CatBoost** with:\n"
                    f"• Accuracy: {m.get('accuracy', 0.9917)*100:.2f}%\n"
                    f"• Precision: {m.get('precision', 0.9917)*100:.2f}%\n"
                    f"• Recall: {m.get('recall', 0.9917)*100:.2f}%\n"
                    f"• F1 Score: {m.get('f1', 0.9917)*100:.2f}%\n"
                    f"• ROC-AUC: {m.get('roc_auc', 0.999):.4f}"
                )
            }
        return {"message": "The best model is CatBoost with 99.17% accuracy."}

    def _model_accuracy(self, message: str) -> dict:
        if ml_service.is_loaded and ml_service.metrics:
            acc = ml_service.metrics.get("accuracy", 0.9917)
            return {"message": f"The CatBoost model achieves {acc*100:.2f}% accuracy on test data."}
        return {"message": "The CatBoost model achieves 99.17% accuracy on test data."}

    def _explain_status(self, message: str) -> dict:
        return {
            "message": (
                "Stock status definitions:\n"
                "• **Low Stock**: Inventory is below safe levels. Immediate replenishment recommended.\n"
                "• **Normal**: Stock levels are adequate for current demand.\n"
                "• **Overstock**: Excess inventory — consider promotions or reduced ordering."
            )
        }

    def _explain_prediction(self, message: str) -> dict:
        return {
            "message": (
                "The AI prediction uses a **CatBoost** classifier trained on 6,000 labeled inventory records. "
                "It analyzes 18 features (product info, inventory metrics, logistics) to predict stock status "
                "as Low Stock, Normal, or Overstock. The model achieves 99.17% accuracy. "
                "To run a prediction, go to the AI Prediction page and fill in the features."
            )
        }

    def _explain_forecasting(self, message: str) -> dict:
        if forecasting_service.is_loaded:
            return {
                "message": (
                    "Demand forecasting is available! The system uses **Holt-Winters Exponential Smoothing** "
                    "to analyse historical demand patterns and predict future demand. The forecasts are based on "
                    "synthetic historical demand data for demonstration purposes. Go to the Forecasting page to "
                    "generate demand forecasts for specific products."
                )
            }
        return {
            "message": (
                "Time-series forecasting (predicting future demand) is not yet available. "
                "The current system performs **stock status classification** based on current product "
                "and inventory features. Demand forecasting requires historical time-series data "
                "(dates with repeated demand/sales observations), which is not present in the current dataset. "
                "When such data becomes available, forecasting can be added to predict future demand trends."
            )
        }

    def _product_forecast(self, message: str) -> dict:
        if not forecasting_service.is_loaded:
            return {"message": "Forecasting service is not available at the moment."}

        import re as re_mod
        match = re_mod.search(r"(forecast|demand.*predict|future.*demand).*(for|of)\s+(the\s+)?(.+)", message, re_mod.IGNORECASE)
        if not match:
            return {"message": "Please specify a product. For example: 'What is the forecast for Milk?'"}

        query = match.group(4).strip().lower().rstrip('?')

        products = self.db.query(Product).filter(
            Product.product_name.ilike(f"%{query}%")
        ).all()

        if not products:
            return {"message": f"I couldn't find a product matching '{query}'. Try using the product name."}

        prod = products[0]
        try:
            result = forecasting_service.forecast(prod.product_id, horizon=7)
            trend = result['summary']['trend']
            avg = result['summary']['average_forecast']
            peak = result['summary']['peak_forecast']

            latest = self.db.query(InventoryRecord).filter(
                InventoryRecord.product_id == prod.product_id
            ).order_by(InventoryRecord.id.desc()).first()

            status_info = f"Current stock status: **{latest.stock_status}**" if latest else ""

            msg = (
                f"Based on the simulated historical demand data, **{prod.product_name}** is forecasted to have "
                f"an average demand of **{avg} units/day** over the next 7 days, "
                f"with a peak of **{peak} units**. The expected trend is **{trend.lower()}**.\n\n"
                f"{status_info}\n"
            )

            if trend == "Increasing" and latest and latest.stock_status == "Normal":
                msg += "\n*Recommendation:* Review inventory levels before the expected increase in demand."
            elif trend == "Increasing" and latest and latest.stock_status == "Low Stock":
                msg += "\n*Recommendation:* Demand is rising while stock is already low. Urgent replenishment recommended."
            elif trend == "Decreasing" and latest and latest.stock_status == "Overstock":
                msg += "\n*Recommendation:* Demand is decreasing. Consider adjusting orders or running promotions."

            msg += "\n\n*Note: Forecast uses synthetic historical demand data for demonstration.*"

            return {"message": msg}
        except Exception as e:
            return {"message": f"Unable to generate forecast for {prod.product_name}. Please try from the Forecasting page."}

    def _forecast_trend(self, message: str) -> dict:
        if not forecasting_service.is_loaded:
            return {"message": "Forecasting service is not available."}

        try:
            overview = forecasting_service.forecast_overview()
            increasing = [o for o in overview if o['summary']['trend'] == 'Increasing']
            decreasing = [o for o in overview if o['summary']['trend'] == 'Decreasing']
            highest = max(overview, key=lambda o: o['summary']['average_forecast'])

            msg = (
                f"Based on forecast data:\n"
                f"• **{len(increasing)} products** have increasing demand trends\n"
                f"• **{len(decreasing)} products** have decreasing demand trends\n"
                f"• Highest forecasted demand: **{highest['summary']['average_forecast']} units/day**\n\n"
                f"Visit the Forecasting page for detailed product-level forecasts."
            )
            return {"message": msg}
        except Exception:
            return {"message": "Unable to load forecast overview data."}

    def _forecast_action(self, message: str) -> dict:
        if not forecasting_service.is_loaded:
            return {"message": "Forecasting service is not available."}

        try:
            overview = forecasting_service.forecast_overview()
            urgent = []
            for o in overview:
                pid = o['product_id']
                latest = self.db.query(InventoryRecord).filter(
                    InventoryRecord.product_id == pid
                ).order_by(InventoryRecord.id.desc()).first()
                if latest and o['summary']['trend'] == 'Increasing' and latest.stock_status == 'Low Stock':
                    prod = self.db.query(Product).filter(Product.product_id == pid).first()
                    urgent.append((prod.product_name if prod else f"Product_{pid}", latest.inventory_level))

            if urgent:
                names = "\n".join(f"• {n} (inventory: {l} units)" for n, l in urgent[:5])
                return {"message": f"Products needing forecast-driven attention:\n{names}\n\nThese products have rising demand but low stock levels."}

            return {"message": "No products currently require urgent forecast-driven action. Continue monitoring."}
        except Exception:
            return {"message": "Unable to check forecast action items."}

    def _category_low_stock(self, message: str) -> dict:
        result = (
            self.db.query(Product.category, func.count(InventoryRecord.id).label("cnt"))
            .join(InventoryRecord)
            .filter(InventoryRecord.stock_status == "Low Stock")
            .group_by(Product.category)
            .order_by(desc("cnt"))
            .first()
        )
        if not result:
            return {"message": "No low-stock products found in any category."}
        total_low = self.db.query(InventoryRecord).filter(
            InventoryRecord.stock_status == "Low Stock"
        ).count()
        return {
            "message": (
                f"'{result.category}' has the most low-stock products with {result.cnt} records "
                f"({result.cnt/total_low*100:.1f}% of all low-stock items)."
            )
        }

    def _unknown(self, message: str) -> dict:
        return {
            "message": (
                "I'm not able to find that information in the current inventory system.\n\n"
                "Try asking about:\n"
                "• Inventory health and stock counts\n"
                "• Low stock products needing attention\n"
                "• AI predictions and ML model details\n"
                "• Stock status definitions\n"
                "• Category analysis"
            )
        }
