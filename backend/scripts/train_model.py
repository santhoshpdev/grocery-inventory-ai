"""
Train CatBoost model for stock status classification.
Replicates the exact pipeline from the Colab notebook.
"""

import os
import sys
import pickle
import pandas as pd
import numpy as np
from sklearn.preprocessing import LabelEncoder, StandardScaler
from catboost import CatBoostClassifier

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.dirname(SCRIPT_DIR)
PROJECT_DIR = os.path.dirname(BACKEND_DIR)

DATA_PATH = os.path.join(PROJECT_DIR, "data", "dataset.csv")
MODEL_DIR = os.path.join(BACKEND_DIR, "ml_models")

os.makedirs(MODEL_DIR, exist_ok=True)

print(f"Loading dataset from: {DATA_PATH}")
data = pd.read_csv(DATA_PATH)
print(f"Dataset shape: {data.shape}")

data_cleaned = data.copy()

duplicates = data_cleaned.duplicated().sum()
print(f"Duplicate rows: {duplicates}")
data_cleaned.drop_duplicates(inplace=True)

if "Date" in data_cleaned.columns:
    data_cleaned["Date"] = pd.to_datetime(data_cleaned["Date"], errors="coerce")
    data_cleaned["Year"] = data_cleaned["Date"].dt.year
    data_cleaned["Month"] = data_cleaned["Date"].dt.month
    data_cleaned["Day"] = data_cleaned["Date"].dt.day

for column in data_cleaned.columns:
    if data_cleaned[column].dtype == "object":
        data_cleaned[column].fillna(data_cleaned[column].mode()[0], inplace=True)
    else:
        data_cleaned[column].fillna(data_cleaned[column].median(), inplace=True)

data_cleaned.dropna(inplace=True)

categorical_columns = data_cleaned.select_dtypes(include=["object"]).columns.tolist()
if "Stock_Status" in categorical_columns:
    categorical_columns.remove("Stock_Status")

encoders = {}
for column in categorical_columns:
    encoder = LabelEncoder()
    data_cleaned[column] = encoder.fit_transform(data_cleaned[column].astype(str))
    encoders[column] = encoder
    print(f"Encoded {column}: {len(encoder.classes_)} classes")

target_encoder = LabelEncoder()
data_cleaned["Stock_Status"] = target_encoder.fit_transform(data_cleaned["Stock_Status"])
print("\nTarget encoding:")
for label, code in zip(target_encoder.classes_,
                        target_encoder.transform(target_encoder.classes_)):
    print(f"  {label} --> {code}")

columns_to_remove = []
if "Date" in data_cleaned.columns:
    columns_to_remove.append("Date")
data_cleaned.drop(columns=columns_to_remove, inplace=True, errors="ignore")

X = data_cleaned.drop("Stock_Status", axis=1)
y = data_cleaned["Stock_Status"]

print(f"\nFeature matrix: {X.shape}")
print(f"Target shape: {y.shape}")

from sklearn.model_selection import train_test_split

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)

scaler = StandardScaler()
X_train_scaled = scaler.fit_transform(X_train)
X_test_scaled = scaler.transform(X_test)

model = CatBoostClassifier(
    iterations=200,
    learning_rate=0.1,
    depth=6,
    loss_function="MultiClass",
    verbose=100,
    random_seed=42,
)

model.fit(X_train_scaled, y_train)

from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score, roc_auc_score
)

y_pred = model.predict(X_test_scaled)
y_pred = y_pred.flatten()
y_prob = model.predict_proba(X_test_scaled)

accuracy = accuracy_score(y_test, y_pred)
precision = precision_score(y_test, y_pred, average="weighted")
recall = recall_score(y_test, y_pred, average="weighted")
f1 = f1_score(y_test, y_pred, average="weighted")
roc = roc_auc_score(y_test, y_prob, multi_class="ovr")

print(f"\nCatBoost Performance:")
print(f"  Accuracy : {accuracy:.4f}")
print(f"  Precision: {precision:.4f}")
print(f"  Recall   : {recall:.4f}")
print(f"  F1 Score : {f1:.4f}")
print(f"  ROC AUC  : {roc:.4f}")

feature_names = X.columns.tolist()
importance_df = pd.DataFrame({
    "Feature": feature_names,
    "Importance": model.feature_importances_
}).sort_values("Importance", ascending=False)

print(f"\nFeature Importance:")
print(importance_df.to_string(index=False))

model.save_model(os.path.join(MODEL_DIR, "catboost_model.cbm"))
print(f"\nModel saved to: {os.path.join(MODEL_DIR, 'catboost_model.cbm')}")

with open(os.path.join(MODEL_DIR, "label_encoders.pkl"), "wb") as f:
    pickle.dump(encoders, f)
print(f"Label encoders saved ({len(encoders)} encoders)")

with open(os.path.join(MODEL_DIR, "target_encoder.pkl"), "wb") as f:
    pickle.dump(target_encoder, f)
print(f"Target encoder saved (classes: {list(target_encoder.classes_)})")

with open(os.path.join(MODEL_DIR, "scaler.pkl"), "wb") as f:
    pickle.dump(scaler, f)
print("Scaler saved")

with open(os.path.join(MODEL_DIR, "feature_names.pkl"), "wb") as f:
    pickle.dump(feature_names, f)
print(f"Feature names saved ({len(feature_names)} features)")

metrics = {
    "accuracy": round(accuracy, 4),
    "precision": round(precision, 4),
    "recall": round(recall, 4),
    "f1": round(f1, 4),
    "roc_auc": round(roc, 4),
}
with open(os.path.join(MODEL_DIR, "metrics.pkl"), "wb") as f:
    pickle.dump(metrics, f)
print(f"Metrics saved: {metrics}")

importance_data = importance_df.to_dict(orient="records")
with open(os.path.join(MODEL_DIR, "feature_importance.pkl"), "wb") as f:
    pickle.dump(importance_data, f)
print("Feature importance saved")

print(f"\nAll artefacts saved to {MODEL_DIR}")
print("Training complete!")
