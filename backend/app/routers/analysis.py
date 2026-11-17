import os
import datetime
import asyncio
import math
from fastapi import APIRouter, HTTPException, BackgroundTasks

from app.config import get_settings
from app.database import get_session, update_session_status, save_results, get_results, list_sessions
from app.services.parser import parse_file
from app.services.analyzer import analyze_dataframe
from app.services.chart_generator import generate_chart_configs
from app.services.local_narrator import generate_local_narrative

router = APIRouter()
settings = get_settings()

def sanitize_nan(obj):
    """Recursively replace NaN/Inf float values with None for JSON serialization."""
    if isinstance(obj, float) and (math.isnan(obj) or math.isinf(obj)):
        return None
    elif isinstance(obj, dict):
        return {k: sanitize_nan(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [sanitize_nan(item) for item in obj]
    return obj

async def run_analysis_pipeline(session_id: str, filepath: str, schema: list, original_filename: str):
    """
    High-performance analysis pipeline:
    Executes parsing, statistical profiling, chart generation, and smart narrative
    in under 1 second using fast local-first computation, with optional background
    cloud LLM enhancement.
    """
    try:
        await update_session_status(session_id, 'parsing')
        parsed_data = parse_file(filepath)
        df = parsed_data['dataframe']
        
        await update_session_status(session_id, 'analyzing')
        analysis_results = analyze_dataframe(df, schema)
        charts = generate_chart_configs(df, schema, analysis_results)
        
        await update_session_status(session_id, 'narrating')
        # Instant local-first narrative generation (<30ms)
        narrative = generate_local_narrative(df, analysis_results)
        
        # Save complete results immediately so user dashboard loads instantaneously!
        await save_results(
            session_id=session_id,
            stats=analysis_results,
            narrative=narrative,
            charts=charts,
            created_at=datetime.datetime.utcnow().isoformat()
        )
        await update_session_status(session_id, 'complete')

        # Optional background enhancement: if Gemini key is available, attempt enrichment without blocking user
        api_key = (settings.GEMINI_API_KEY or "").strip()
        if api_key and api_key.startswith("AIzaSy"):
            try:
                from app.services.narrator import generate_narrative
                cloud_narrative = await asyncio.wait_for(
                    generate_narrative(analysis_results, schema, original_filename, df=df),
                    timeout=3.5
                )
                if cloud_narrative and cloud_narrative.get('executive_summary') and 'unavailable' not in cloud_narrative['executive_summary']:
                    await save_results(
                        session_id=session_id,
                        stats=analysis_results,
                        narrative=cloud_narrative,
                        charts=charts,
                        created_at=datetime.datetime.utcnow().isoformat()
                    )
            except Exception:
                pass

    except Exception as e:
        print(f"Error in pipeline for session {session_id}: {str(e).encode('ascii', errors='replace').decode()}")
        await update_session_status(session_id, 'error')

@router.post("/analyze/{session_id}")
async def analyze_data(session_id: str, background_tasks: BackgroundTasks):
    session = await get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    if session['status'] in ['analyzing', 'narrating', 'complete']:
        return {"message": "Analysis is already in progress or complete", "status": session['status']}
        
    filepath = os.path.join(settings.UPLOAD_DIR, session['filename'])
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Data file not found")
        
    background_tasks.add_task(
        run_analysis_pipeline, 
        session_id, 
        filepath, 
        session['column_info'],
        session['original_filename']
    )
    
    return {"message": "Analysis started", "session_id": session_id}

@router.get("/status/{session_id}")
async def get_status(session_id: str):
    session = await get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    return {
        "session_id": session_id,
        "status": session['status'],
        "filename": session['original_filename']
    }

@router.get("/results/{session_id}")
async def fetch_results(session_id: str):
    session = await get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    if session['status'] != 'complete':
        raise HTTPException(status_code=400, detail="Analysis is still in progress")
        
    results = await get_results(session_id)
    if not results:
        raise HTTPException(status_code=404, detail="Results not found")
        
    return sanitize_nan(results)

@router.get("/sessions")
async def get_recent_sessions(limit: int = 10):
    return await list_sessions(limit=limit)
