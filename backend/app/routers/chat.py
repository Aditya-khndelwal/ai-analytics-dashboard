import json
import asyncio
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from google import genai
from pydantic import Field
from typing import Optional, List, Dict, Any

from app.config import get_settings
from app.database import get_session, get_results

router = APIRouter()
settings = get_settings()


class ChatRequest(BaseModel):
    message: str


class ChatChartResponse(BaseModel):
    answer: str
    chart_data: Optional[List[Dict[str, Any]]] = None
    chart_layout: Optional[Dict[str, Any]] = None


@router.post("/chat/{session_id}")
async def chat_with_data(session_id: str, request: ChatRequest):
    session = await get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if session['status'] != 'complete':
        raise HTTPException(status_code=400, detail="Analysis must be complete before chatting")

    results = await get_results(session_id)
    if not results:
        raise HTTPException(status_code=404, detail="Results not found")

    if not settings.GEMINI_API_KEY:
        return {
            "reply": "AI chat is unavailable — no API key configured.",
            "chart": None
        }

    # Build context for Gemini
    schema_info = json.dumps(session.get('column_info', []), indent=2)
    stats_summary = json.dumps({
        'summary': results['stats'].get('summary'),
        'descriptive_stats': results['stats'].get('descriptive_stats'),
        'top_correlations': results['stats'].get('top_correlations'),
    }, indent=2)
    narrative_summary = results['narrative'].get('executive_summary', '')

    prompt = f"""You are a data analyst assistant. The user uploaded a dataset called "{session['original_filename']}".

Dataset Schema:
{schema_info}

Statistical Summary:
{stats_summary}

Executive Summary:
{narrative_summary}

The user is asking a question about this dataset. Answer concisely and accurately based on the data.
If the question can be answered with a chart, include chart_data (Plotly trace objects) and chart_layout (Plotly layout object) in your response. Use these colors: ['#C9A76A', '#5FA98A', '#7C93B8', '#B0637E', '#9C9892']. Set paper_bgcolor and plot_bgcolor to 'transparent', font color to '#9C9892'.
If no chart is needed, set chart_data and chart_layout to null.

User's question: {request.message}"""

    client = genai.Client(api_key=settings.GEMINI_API_KEY)

    max_retries = 2
    for attempt in range(max_retries + 1):
        try:
            response = await client.aio.models.generate_content(
                model='gemini-3.6-flash',
                contents=prompt,
                config=genai.types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=ChatChartResponse
                )
            )
            parsed = json.loads(response.text)

            chart = None
            if parsed.get('chart_data'):
                chart = {
                    'data': parsed['chart_data'],
                    'layout': parsed.get('chart_layout', {})
                }

            return {
                "reply": parsed.get('answer', 'No answer generated.'),
                "chart": chart
            }
        except Exception as e:
            if attempt == max_retries:
                print(f"Chat error: {e}")
                return {
                    "reply": f"Sorry, I couldn't process that question. Please try rephrasing it.",
                    "chart": None
                }
            await asyncio.sleep(1)
