import json
import asyncio
from typing import Dict, Any, List, Optional
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
    
    findings = [f"The dataset contains {summary.get('total_rows', 0):,} rows and {summary.get('total_cols', 0)} columns."]
    if summary.get('total_missing', 0) > 0:
        findings.append(f"There are {summary.get('total_missing', 0):,} missing values ({summary.get('total_missing_pct', 0)}%).")
        
    col_insights = []
    for col, stat in stats.items():
        col_insights.append({"column": col, "insight": f"Mean is {stat.get('mean')}, ranging from {stat.get('min')} to {stat.get('max')}."})
        
    return {
        "executive_summary": f"Automated analysis completed for {summary.get('total_rows', 0):,} rows across {summary.get('total_cols', 0)} attributes.",
        "key_findings": findings,
        "column_insights": col_insights,
        "recommendations": ["Review distribution outliers in the visual dashboard.", "Inspect correlation matrix for strong feature relationships."]
    }

async def generate_narrative(analysis_results: Dict[str, Any], schema: List[Dict[str, Any]], filename: str, df: Optional[Any] = None) -> Dict[str, Any]:
    from app.services.local_narrator import generate_local_narrative

    api_key = (settings.GEMINI_API_KEY or "").strip()
    
    # If API key is missing or dummy placeholder (real Gemini keys start with 'AIzaSy'),
    # immediately generate a rich statistical narrative locally in <30ms with zero network lag!
    if not api_key or not api_key.startswith("AIzaSy"):
        if df is not None:
            return generate_local_narrative(df, analysis_results)
        return generate_fallback_narrative(analysis_results)
        
    # Valid Gemini API key present: Call gemini-2.0-flash with strict 3.5s timeout and 0 retries
    try:
        from google import genai
        client = genai.Client(api_key=api_key)
        
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
        
        response = await asyncio.wait_for(
            client.aio.models.generate_content(
                model='gemini-2.0-flash',
                contents=prompt,
                config=genai.types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=NarrativeResponse
                )
            ),
            timeout=3.5
        )
        return json.loads(response.text)
    except Exception as e:
        print(f"Cloud LLM narrative skipped ({e}). Falling back to instantaneous local statistics narrator.")
        if df is not None:
            return generate_local_narrative(df, analysis_results)
        return generate_fallback_narrative(analysis_results)
