"""
ML Router — API endpoints for local machine learning features.
"""

import os
import pandas as pd
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List

from app.config import get_settings
from app.database import get_session
from app.services.parser import parse_file
from app.services.ml_engine import (
    detect_anomalies,
    cluster_data,
    forecast_timeseries,
    compute_feature_importance,
    suggest_cleaning,
)

router = APIRouter()
settings = get_settings()


def _load_dataframe(session: dict) -> pd.DataFrame:
    """Load the DataFrame for a session."""
    filepath = os.path.join(settings.UPLOAD_DIR, session['filename'])
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Data file not found")
    parsed = parse_file(filepath)
    return parsed['dataframe']


class ClusterRequest(BaseModel):
    columns: Optional[List[str]] = None
    n_clusters: int = 3


class ForecastRequest(BaseModel):
    date_col: Optional[str] = None
    value_col: Optional[str] = None
    periods: int = 10


class ImportanceRequest(BaseModel):
    target_col: Optional[str] = None


@router.get("/ml/anomalies/{session_id}")
async def get_anomalies(session_id: str):
    """Detect anomalies using Z-score + IQR methods."""
    session = await get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    try:
        df = _load_dataframe(session)
        result = detect_anomalies(df)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Anomaly detection failed: {str(e)}")


@router.post("/ml/cluster/{session_id}")
async def get_clusters(session_id: str, request: ClusterRequest):
    """Perform K-Means clustering on numeric columns."""
    session = await get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    try:
        df = _load_dataframe(session)
        result = cluster_data(df, columns=request.columns, n_clusters=request.n_clusters)
        if "error" in result:
            raise HTTPException(status_code=400, detail=result["error"])
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Clustering failed: {str(e)}")


@router.post("/ml/forecast/{session_id}")
async def get_forecast(session_id: str, request: ForecastRequest):
    """Forecast time series using linear regression + moving average."""
    session = await get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    try:
        df = _load_dataframe(session)
        result = forecast_timeseries(df, date_col=request.date_col, value_col=request.value_col, periods=request.periods)
        if "error" in result:
            raise HTTPException(status_code=400, detail=result["error"])
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Forecasting failed: {str(e)}")


@router.post("/ml/importance/{session_id}")
async def get_importance(session_id: str, request: ImportanceRequest):
    """Compute feature importance using correlation + mutual information."""
    session = await get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    try:
        df = _load_dataframe(session)
        result = compute_feature_importance(df, target_col=request.target_col)
        if "error" in result:
            raise HTTPException(status_code=400, detail=result["error"])
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Feature importance failed: {str(e)}")


@router.get("/ml/cleaning/{session_id}")
async def get_cleaning_suggestions(session_id: str):
    """Analyze data quality and suggest cleaning actions."""
    session = await get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    try:
        df = _load_dataframe(session)
        result = suggest_cleaning(df)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Data cleaning analysis failed: {str(e)}")
