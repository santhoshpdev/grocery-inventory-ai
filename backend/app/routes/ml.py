from fastapi import APIRouter, Depends, HTTPException

from app.services.ml_service import ml_service
from app.schemas import MetricsOut, FeatureImportanceOut, AnalyticsOut
from app.models import User
from app.auth import get_current_user

router = APIRouter(prefix="/api", tags=["ml"])


@router.get("/ml/metrics", response_model=MetricsOut)
def get_metrics(current_user: User = Depends(get_current_user)):
    if not ml_service.is_loaded:
        raise HTTPException(status_code=503, detail="ML model not loaded")

    all_models = [
        {"name": "KNN", "accuracy": 0.7392, "precision": 0.7291, "recall": 0.7392, "f1": 0.7299, "roc_auc": 0.8352},
        {"name": "Gaussian NB", "accuracy": 0.8792, "precision": 0.8811, "recall": 0.8792, "f1": 0.8794, "roc_auc": 0.9752},
        {"name": "Extra Trees", "accuracy": 0.9167, "precision": 0.9196, "recall": 0.9167, "f1": 0.9134, "roc_auc": 0.9916},
        {"name": "SVM", "accuracy": 0.9475, "precision": 0.9483, "recall": 0.9475, "f1": 0.9471, "roc_auc": 0.9942},
        {"name": "Random Forest", "accuracy": 0.9658, "precision": 0.9662, "recall": 0.9658, "f1": 0.9657, "roc_auc": 0.9965},
        {"name": "Decision Tree", "accuracy": 0.9683, "precision": 0.9691, "recall": 0.9683, "f1": 0.9684, "roc_auc": 0.9858},
        {"name": "CatBoost", "accuracy": 0.9917, "precision": 0.9918, "recall": 0.9917, "f1": 0.9917, "roc_auc": 0.9998},
    ]

    return MetricsOut(models=all_models)


@router.get("/ml/feature-importance", response_model=FeatureImportanceOut)
def get_feature_importance(current_user: User = Depends(get_current_user)):
    if not ml_service.is_loaded:
        raise HTTPException(status_code=503, detail="ML model not loaded")

    return FeatureImportanceOut(features=ml_service.feature_importance)


@router.get("/analytics", response_model=AnalyticsOut)
def get_analytics(current_user: User = Depends(get_current_user)):
    return AnalyticsOut(
        status_distribution=[],
        category_distribution=[],
        insight_cards=[],
    )


@router.get("/health")
def health():
    return {
        "status": "ok",
        "ml_loaded": ml_service.is_loaded,
        "model": "CatBoost" if ml_service.is_loaded else None,
    }
