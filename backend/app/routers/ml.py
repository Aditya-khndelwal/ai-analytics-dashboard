"""
ML Router — API endpoints for local machine learning features.
"""

import os
import pandas as pd
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List

from app.config import get_settings
from app.database import get_session, get_csv_data
from app.services.parser import parse_file
from app.services.ml_engine import (
    detect_anomalies,
    cluster_data,
    forecast_timeseries,
    compute_feature_importance,
    suggest_cleaning,
    run_pca,
    auto_ml,
    correlation_heatmap,
)
from app.services.local_query import answer_query

router = APIRouter()
settings = get_settings()


async def _load_dataframe(session: dict) -> pd.DataFrame:
    """Load the DataFrame for a session. Tries file first, falls back to DB."""
    filepath = os.path.join(settings.UPLOAD_DIR, session['filename'])
    if os.path.exists(filepath):
        parsed = parse_file(filepath)
        return parsed['dataframe']

    # File missing (Render restart) — try loading from database
    csv_text = await get_csv_data(session['id'])
    if csv_text:
        import io
        return pd.read_csv(io.StringIO(csv_text))

    raise HTTPException(status_code=404, detail="Data file not found. Please re-upload your dataset.")


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
        df = await _load_dataframe(session)
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
        df = await _load_dataframe(session)
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
        df = await _load_dataframe(session)
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
        df = await _load_dataframe(session)
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
        df = await _load_dataframe(session)
        result = suggest_cleaning(df)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Data cleaning analysis failed: {str(e)}")


class PcaRequest(BaseModel):
    n_components: int = 2


class AutoMlRequest(BaseModel):
    target_col: Optional[str] = None


class LocalQueryRequest(BaseModel):
    question: str


@router.post("/ml/pca/{session_id}")
async def get_pca(session_id: str, request: PcaRequest):
    """PCA dimensionality reduction."""
    session = await get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    try:
        df = await _load_dataframe(session)
        result = run_pca(df, n_components=request.n_components)
        if "error" in result:
            raise HTTPException(status_code=400, detail=result["error"])
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"PCA failed: {str(e)}")


@router.post("/ml/automl/{session_id}")
async def get_automl(session_id: str, request: AutoMlRequest):
    """Auto ML — train multiple models and compare."""
    session = await get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    try:
        df = await _load_dataframe(session)
        result = auto_ml(df, target_col=request.target_col)
        if "error" in result:
            raise HTTPException(status_code=400, detail=result["error"])
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Auto ML failed: {str(e)}")


@router.get("/ml/heatmap/{session_id}")
async def get_heatmap(session_id: str):
    """Correlation heatmap data."""
    session = await get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    try:
        df = await _load_dataframe(session)
        result = correlation_heatmap(df)
        if "error" in result:
            raise HTTPException(status_code=400, detail=result["error"])
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Heatmap failed: {str(e)}")


@router.post("/ml/query/{session_id}")
async def local_query(session_id: str, request: LocalQueryRequest):
    """Answer data questions using local Pandas engine (no Gemini)."""
    session = await get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    try:
        df = await _load_dataframe(session)
        result = answer_query(df, request.question)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Query failed: {str(e)}")
