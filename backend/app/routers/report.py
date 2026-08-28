from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response

from app.database import get_session, get_results
from app.services.report_exporter import generate_pdf, generate_docx

router = APIRouter()

@router.get("/report/{session_id}")
async def download_report(session_id: str, format: str = Query("pdf", description="Format of the report (pdf or docx)")):
    session = await get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
        
    if session['status'] != 'complete':
        raise HTTPException(status_code=400, detail="Analysis not complete yet")
        
    results = await get_results(session_id)
    if not results:
        raise HTTPException(status_code=404, detail="Results not found")
        
    format = format.lower()
    try:
        if format == "pdf":
            pdf_bytes = generate_pdf(
                session_data=session,
                analysis_results=results['stats'],
                narrative=results['narrative'],
                charts_config=results['charts']
            )
            return Response(
                content=pdf_bytes,
                media_type="application/pdf",
                headers={"Content-Disposition": f"attachment; filename=Analysis_Report_{session['original_filename']}.pdf"}
            )
        elif format == "docx":
            docx_bytes = generate_docx(
                session_data=session,
                analysis_results=results['stats'],
                narrative=results['narrative'],
                charts_config=results['charts']
            )
            return Response(
                content=docx_bytes,
                media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                headers={"Content-Disposition": f"attachment; filename=Analysis_Report_{session['original_filename']}.docx"}
            )
        else:
            raise HTTPException(status_code=400, detail="Unsupported format. Use 'pdf' or 'docx'.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to generate report: {str(e)}")
