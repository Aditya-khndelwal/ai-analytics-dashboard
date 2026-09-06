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
from app.services.narrator import generate_narrative

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
    try:
        await update_session_status(session_id, 'parsing')
        # Re-parse to get dataframe
        parsed_data = parse_file(filepath)
        df = parsed_data['dataframe']
        
        await update_session_status(session_id, 'analyzing')
        # Analyze dataframe
        analysis_results = analyze_dataframe(df, schema)
        
        # Generate charts
        charts = generate_chart_configs(df, schema, analysis_results)
        
        await update_session_status(session_id, 'narrating')
        # Generate narrative
        narrative = await generate_narrative(analysis_results, schema, original_filename)
        
        # Save results
        await save_results(
            session_id=session_id,
            stats=analysis_results,
            narrative=narrative,
            charts=charts,
            created_at=datetime.datetime.utcnow().isoformat()
        )
        
        await update_session_status(session_id, 'complete')
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
        raise HTTPException(status_code=400, detail=f"Results not ready. Current status: {session['status']}")
        
    results = await get_results(session_id)
    if not results:
        raise HTTPException(status_code=404, detail="Results not found")

    # Generate data preview
    data_preview = None
    try:
        filepath = os.path.join(settings.UPLOAD_DIR, session['filename'])
        if os.path.exists(filepath):
            parsed = parse_file(filepath)
            df = parsed['dataframe']
            preview_df = df.head(50)
            # Convert to JSON-safe format
            rows = preview_df.where(preview_df.notna(), None).to_dict(orient='records')
            # Convert any non-serializable types
            clean_rows = []
            for row in rows:
                clean_row = {}
                for k, v in row.items():
                    if hasattr(v, 'item'):  # numpy types
                        clean_row[k] = v.item()
                    elif hasattr(v, 'isoformat'):  # datetime
                        clean_row[k] = v.isoformat()
                    else:
                        clean_row[k] = v
                clean_rows.append(clean_row)

            column_types = {s['name']: s['inferred_type'] for s in parsed['schema']}
            data_preview = {
                'columns': list(df.columns),
                'rows': clean_rows,
                'column_types': column_types
            }
    except Exception as e:
        print(f"Error generating data preview: {e}")

    return sanitize_nan({
        "session": {
            "id": session['id'],
            "original_filename": session['original_filename'],
            "filename": session['original_filename'],
            "row_count": session['row_count'],
            "col_count": session['col_count'],
            "columns": session['column_info'],
            "uploaded_at": session['uploaded_at']
        },
        "stats": results['stats'],
        "narrative": results['narrative'],
        "charts": results['charts'],
        "data_preview": data_preview
    })


@router.get("/sessions")
async def get_sessions():
    """Returns a list of recent analysis sessions."""
    sessions = await list_sessions(20)
    return {"sessions": sessions}
