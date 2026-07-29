import os
import pickle
import numpy as np
import pandas as pd
from catboost import CatBoostClassifier

from typing import Any, Dict, List, Optional

from app.config import settings

MODEL_DIR = settings.model_dir


class MLService:
    def __init__(self):
        self.model = None
        self.label_encoders: dict = {}
        self.target_encoder = None
        self.scaler = None
        self.feature_names: List[str] = []
        self.metrics: dict = {}
        self.feature_importance: List[dict] = []
        self._loaded = False

    def load(self):
        model_path = os.path.join(MODEL_DIR, "catboost_model.cbm")
        if not os.path.exists(model_path):
            print(f"Model not found at {model_path}. ML service unavailable.")
            self._loaded = False
            return

        self.model = CatBoostClassifier()
        self.model.load_model(model_path)

        with open(os.path.join(MODEL_DIR, "label_encoders.pkl"), "rb") as f:
            self.label_encoders = pickle.load(f)
        with open(os.path.join(MODEL_DIR, "target_encoder.pkl"), "rb") as f:
            self.target_encoder = pickle.load(f)
        with open(os.path.join(MODEL_DIR, "scaler.pkl"), "rb") as f:
            self.scaler = pickle.load(f)
        with open(os.path.join(MODEL_DIR, "feature_names.pkl"), "rb") as f:
            self.feature_names = pickle.load(f)
        with open(os.path.join(MODEL_DIR, "metrics.pkl"), "rb") as f:
            self.metrics = pickle.load(f)
        with open(os.path.join(MODEL_DIR, "feature_importance.pkl"), "rb") as f:
            self.feature_importance = pickle.load(f)

        self._loaded = True
        print(f"ML service loaded. Model features: {len(self.feature_names)}")
        print(f"Metrics: {self.metrics}")

    @property
    def is_loaded(self) -> bool:
        return self._loaded

    COLUMN_MAP = {
        "product_id": "Product_ID",
        "product_name": "Product_Name",
        "category": "Category",
        "supplier": "Supplier",
        "store_id": "Store_ID",
        "inventory_level": "Inventory_Level",
        "units_sold": "Units_Sold",
        "unit_price": "Unit_Price",
        "purchase_cost": "Purchase_Cost",
        "discount": "Discount",
        "temperature": "Temperature",
        "holiday": "Holiday",
        "promotion": "Promotion",
        "lead_time": "Lead_Time",
        "shelf_life": "Shelf_Life",
        "reorder_level": "Reorder_Level",
        "season": "Season",
        "demand": "Demand",
    }
    REVERSE_MAP = {v: k for k, v in COLUMN_MAP.items()}

    def predict(self, input_data: dict) -> dict:
        if not self._loaded:
            raise RuntimeError("ML model not loaded")

        mapped = {}
        for k, v in input_data.items():
            col = self.COLUMN_MAP.get(k, k)
            mapped[col] = v

        df = pd.DataFrame([mapped])

        cat_cols = [c for c in self.label_encoders if c in df.columns]
        for col in cat_cols:
            val = str(df[col].iloc[0])
            encoder = self.label_encoders[col]
            if val in encoder.classes_:
                df[col] = encoder.transform([val])[0]
            else:
                df[col] = -1

        df = df[self.feature_names]

        scaled = self.scaler.transform(df.values.reshape(1, -1))

        pred = self.model.predict(scaled)
        pred_class = int(pred.flatten()[0])

        probs = self.model.predict_proba(scaled)[0]

        predicted_status = self.target_encoder.inverse_transform([pred_class])[0]

        confidence = float(np.max(probs))
        prob_dict = {}
        for i, cls_name in enumerate(self.target_encoder.classes_):
            prob_dict[cls_name] = round(float(probs[i]), 4)

        if predicted_status == "Low Stock":
            recommendation = "Inventory requires immediate attention and may need urgent replenishment."
        elif predicted_status == "Normal":
            recommendation = "Inventory level is adequate. Continue monitoring regularly."
        else:
            recommendation = "Inventory is overstocked. Consider reducing orders or running promotions."

        return {
            "predicted_status": predicted_status,
            "confidence": round(confidence, 4),
            "probabilities": prob_dict,
            "model_name": "CatBoost",
            "recommendation": recommendation,
        }


ml_service = MLService()
