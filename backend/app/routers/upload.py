import os
import uuid
import datetime
from fastapi import APIRouter, UploadFile, File, HTTPException, BackgroundTasks
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.database import create_session
from app.services.parser import parse_file

router = APIRouter()
settings = get_settings()

@router.post("/upload")
async def upload_file(file: UploadFile = File(...)):
    """Uploads a data file, parses it to extract schema, and creates a session."""
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file provided")
        
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ['.csv', '.xlsx']:
        raise HTTPException(status_code=400, detail="Only .csv and .xlsx files are supported")
        
    # Read file content to check size and save
    content = await file.read()
    if len(content) > settings.MAX_FILE_SIZE_MB * 1024 * 1024:
        raise HTTPException(status_code=400, detail=f"File exceeds maximum size of {settings.MAX_FILE_SIZE_MB}MB")
        
    # Save file
    new_filename = f"{uuid.uuid4()}{ext}"
    filepath = os.path.join(settings.UPLOAD_DIR, new_filename)
    with open(filepath, "wb") as f:
        f.write(content)
        
    try:
        # Parse file to get schema and row/col counts
        parsed_data = parse_file(filepath)
        schema = parsed_data['schema']
        row_count = parsed_data['row_count']
        col_count = parsed_data['col_count']
        
        # Create session in DB
        uploaded_at = datetime.datetime.utcnow().isoformat()
        session_id = await create_session(
            original_filename=file.filename,
            filename=new_filename,
            uploaded_at=uploaded_at,
            row_count=row_count,
            col_count=col_count,
            column_info=schema
        )
        
        return {
            "session_id": session_id,
            "filename": file.filename,
            "row_count": row_count,
            "col_count": col_count,
            "columns": schema,
            "status": "uploaded"
        }
    except Exception as e:
        # Cleanup file if parsing fails
        if os.path.exists(filepath):
            os.remove(filepath)
        raise HTTPException(status_code=400, detail=f"Failed to process file: {str(e)}")
