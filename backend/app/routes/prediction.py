from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Prediction, User
from app.schemas import PredictRequest, PredictResponse
from app.services.ml_service import ml_service
from app.auth import get_current_user

router = APIRouter(prefix="/api", tags=["prediction"])


@router.post("/predict", response_model=PredictResponse)
def predict(
    request: PredictRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if not ml_service.is_loaded:
        raise HTTPException(
            status_code=503,
            detail="ML model is not loaded. Model files may be missing."
        )

    input_dict = request.model_dump()
    result = ml_service.predict(input_dict)

    pred = Prediction(
        input_data=input_dict,
        predicted_status=result["predicted_status"],
        confidence=result["confidence"],
        probabilities=result["probabilities"],
        model_name=result["model_name"],
    )
    db.add(pred)
    db.commit()
    db.refresh(pred)

    return PredictResponse(**result)


@router.get("/predictions")
def get_predictions(
    page: int = 1,
    per_page: int = 20,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(Prediction).order_by(Prediction.created_at.desc())
    total = query.count()
    preds = query.offset((page - 1) * per_page).limit(per_page).all()
    return {
        "total": total,
        "page": page,
        "per_page": per_page,
        "predictions": [
            {
                "id": p.id,
                "predicted_status": p.predicted_status,
                "confidence": p.confidence,
                "input_data": p.input_data,
                "model_name": p.model_name,
                "created_at": str(p.created_at),
            }
            for p in preds
        ],
    }
