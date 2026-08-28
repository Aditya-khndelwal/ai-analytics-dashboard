import json
import asyncio
from typing import Dict, Any, List
from google import genai
from pydantic import BaseModel, Field
from app.config import get_settings

settings = get_settings()

class ColumnInsight(BaseModel):
    column: str
    insight: str

class NarrativeResponse(BaseModel):
    executive_summary: str
    key_findings: List[str]
    column_insights: List[ColumnInsight]
    recommendations: List[str]

def generate_fallback_narrative(analysis_results: Dict[str, Any]) -> Dict[str, Any]:
    summary = analysis_results.get('summary', {})
    stats = analysis_results.get('descriptive_stats', {})
    
    findings = [f"The dataset contains {summary.get('total_rows', 0)} rows and {summary.get('total_cols', 0)} columns."]
    if summary.get('total_missing', 0) > 0:
        findings.append(f"There are {summary.get('total_missing', 0)} missing values ({summary.get('total_missing_pct', 0)}%).")
        
    col_insights = []
    for col, stat in stats.items():
        col_insights.append({"column": col, "insight": f"Mean is {stat.get('mean')}, ranging from {stat.get('min')} to {stat.get('max')}."})
        
    return {
        "executive_summary": "This is an auto-generated summary because the AI service was unavailable.",
        "key_findings": findings,
        "column_insights": col_insights,
        "recommendations": ["Review the descriptive statistics for more details.", "Check missing values."]
    }

async def generate_narrative(analysis_results: Dict[str, Any], schema: List[Dict[str, Any]], filename: str) -> Dict[str, Any]:
    if not settings.GEMINI_API_KEY:
        return generate_fallback_narrative(analysis_results)
        
    client = genai.Client(api_key=settings.GEMINI_API_KEY)
    
    # Prune results to avoid huge context limits
    pruned_results = {
        'summary': analysis_results.get('summary'),
        'descriptive_stats': analysis_results.get('descriptive_stats'),
        'top_correlations': analysis_results.get('top_correlations'),
        'missing_data': analysis_results.get('missing_data'),
        'trends': analysis_results.get('trends')
    }
    
    prompt = f"""
    Analyze the following statistical summary of a dataset named '{filename}'.
    Generate a professional data analysis narrative.
    
    Schema:
    {json.dumps(schema, indent=2)}
    
    Statistics:
    {json.dumps(pruned_results, indent=2)}
    
    Return the response as a JSON object matching this schema:
    {{
        "executive_summary": "A broad overview of the dataset and core insight",
        "key_findings": ["Finding 1", "Finding 2"],
        "column_insights": [{{"column": "col_name", "insight": "insight text"}}],
        "recommendations": ["Rec 1", "Rec 2"]
    }}
    """
    
    max_retries = 3
    base_delay = 1
    
    for attempt in range(max_retries):
        try:
            response = await client.aio.models.generate_content(
                model='gemini-3.6-flash',
                contents=prompt,
                config=genai.types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=NarrativeResponse
                )
            )
            return json.loads(response.text)
        except Exception as e:
            if attempt == max_retries - 1:
                print(f"Narrative generation failed after {max_retries} attempts: {e}")
                return generate_fallback_narrative(analysis_results)
            await asyncio.sleep(base_delay * (2 ** attempt))
            
    return generate_fallback_narrative(analysis_results)
