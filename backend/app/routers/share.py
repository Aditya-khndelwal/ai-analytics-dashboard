from fastapi import APIRouter, HTTPException

from app.database import get_session, get_results, create_share_token, get_session_by_token
from app.routers.analysis import sanitize_nan, fetch_results

router = APIRouter()


@router.post("/share/{session_id}")
async def create_share_link(session_id: str):
    """Creates a shareable link for a completed analysis."""
    session = await get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if session['status'] != 'complete':
        raise HTTPException(status_code=400, detail="Analysis must be complete to share")

    token = await create_share_token(session_id)
    return {"token": token, "share_url": f"/shared/{token}"}


@router.get("/shared/{token}")
async def get_shared_results(token: str):
    """Returns analysis results for a shared token."""
    session_id = await get_session_by_token(token)
    if not session_id:
        raise HTTPException(status_code=404, detail="Shared link not found or expired")

    session = await get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if session['status'] != 'complete':
        raise HTTPException(status_code=400, detail="Analysis not complete")

    results = await get_results(session_id)
    if not results:
        raise HTTPException(status_code=404, detail="Results not found")

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
        "data_preview": None  # No data preview for shared views
    })
