import io
import json
import traceback
import plotly.graph_objects as go
from typing import Dict, Any, List, Optional
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from docx import Document
from docx.shared import Inches


def _sanitize_for_plotly(obj):
    """Recursively sanitize data for Plotly rendering — convert None/NaN to 0 for numeric contexts."""
    if isinstance(obj, dict):
        return {k: _sanitize_for_plotly(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [_sanitize_for_plotly(item) for item in obj]
    elif obj is None:
        return 0
    elif isinstance(obj, float):
        import math
        if math.isnan(obj) or math.isinf(obj):
            return 0
        return obj
    return obj


def create_chart_image(chart_config: Dict[str, Any]) -> Optional[io.BytesIO]:
    """Renders a Plotly chart config dict to a PNG image byte stream."""
    try:
        # Get data and layout from chart config
        data = chart_config.get('data', [])
        layout = chart_config.get('layout', {})
        
        if not data:
            print(f"Chart '{chart_config.get('title', '?')}': no data found")
            return None
        
        # Sanitize data to remove NaN/None that crash Kaleido
        data = _sanitize_for_plotly(data)
        layout = _sanitize_for_plotly(layout)
        
        fig = go.Figure(data=data, layout=layout)
        
        # Override to print-friendly white background
        fig.update_layout(
            paper_bgcolor='white',
            plot_bgcolor='white',
            font={'color': '#333333', 'family': 'Arial, sans-serif'},
            title_font_color='#333333',
            xaxis=dict(
                gridcolor='#E0E0E0',
                zerolinecolor='#CCCCCC',
                title_font_color='#333333',
                tickfont_color='#555555',
            ),
            yaxis=dict(
                gridcolor='#E0E0E0',
                zerolinecolor='#CCCCCC',
                title_font_color='#333333',
                tickfont_color='#555555',
            ),
        )
        
        img_bytes = fig.to_image(format="png", width=700, height=450, scale=2)
        buf = io.BytesIO(img_bytes)
        buf.seek(0)
        return buf
    except Exception as e:
        print(f"Chart image generation FAILED for '{chart_config.get('title', '?')}': {e}")
        traceback.print_exc()
        return None


def generate_pdf(session_data: Dict[str, Any], analysis_results: Dict[str, Any], narrative: Dict[str, Any], charts_config: List[Dict[str, Any]]) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=72, leftMargin=72, topMargin=72, bottomMargin=18)
    
    styles = getSampleStyleSheet()
    title_style = styles['Heading1']
    heading2 = styles['Heading2']
    normal = styles['Normal']
    
    elements = []
    
    # Title
    elements.append(Paragraph(f"Data Analysis Report: {session_data.get('original_filename', 'Dataset')}", title_style))
    elements.append(Spacer(1, 12))
    
    # Executive Summary
    exec_summary = narrative.get('executive_summary', '')
    if exec_summary:
        elements.append(Paragraph("Executive Summary", heading2))
        elements.append(Paragraph(str(exec_summary), normal))
        elements.append(Spacer(1, 12))
    
    # Key Findings
    findings = narrative.get('key_findings', [])
    if findings:
        elements.append(Paragraph("Key Findings", heading2))
        for finding in findings:
            if finding and str(finding).strip():
                elements.append(Paragraph(f"• {finding}", normal))
        elements.append(Spacer(1, 12))
    
    # Descriptive Stats Table
    stats = analysis_results.get('descriptive_stats', {})
    if stats:
        elements.append(Paragraph("Descriptive Statistics", heading2))
        table_data = [["Column", "Mean", "Min", "Max", "Std Dev"]]
        for col, s in list(stats.items())[:10]:
            table_data.append([
                str(col)[:30],
                str(s.get('mean', '-'))[:12],
                str(s.get('min', '-'))[:12],
                str(s.get('max', '-'))[:12],
                str(s.get('std', '-'))[:12],
            ])
            
        t = Table(table_data)
        t.setStyle(TableStyle([
            ('BACKGROUND', (0,0), (-1,0), colors.grey),
            ('TEXTCOLOR', (0,0), (-1,0), colors.whitesmoke),
            ('ALIGN', (0,0), (-1,-1), 'CENTER'),
            ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
            ('FONTSIZE', (0,0), (-1,-1), 8),
            ('BOTTOMPADDING', (0,0), (-1,0), 12),
            ('BACKGROUND', (0,1), (-1,-1), colors.beige),
            ('GRID', (0,0), (-1,-1), 1, colors.black)
        ]))
        elements.append(t)
        elements.append(Spacer(1, 12))
        
    # Charts
    if charts_config:
        elements.append(Paragraph("Visualizations", heading2))
        elements.append(Spacer(1, 6))
        
        chart_count = 0
        for chart in charts_config:
            try:
                img_stream = create_chart_image(chart)
                if img_stream:
                    elements.append(Paragraph(chart.get('title', 'Chart'), normal))
                    elements.append(Spacer(1, 4))
                    img = Image(img_stream, width=440, height=284)
                    elements.append(img)
                    elements.append(Spacer(1, 16))
                    chart_count += 1
                else:
                    elements.append(Paragraph(f"[Chart: {chart.get('title', 'Chart')} — image could not be generated]", normal))
                    elements.append(Spacer(1, 8))
            except Exception as e:
                print(f"PDF chart error: {e}")
                elements.append(Paragraph(f"[Chart skipped: {chart.get('title', 'Chart')}]", normal))
        
        if chart_count == 0:
            elements.append(Paragraph("(No chart images could be generated)", normal))
            
    doc.build(elements)
    pdf_bytes = buffer.getvalue()
    buffer.close()
    return pdf_bytes


def generate_docx(session_data: Dict[str, Any], analysis_results: Dict[str, Any], narrative: Dict[str, Any], charts_config: List[Dict[str, Any]]) -> bytes:
    doc = Document()
    doc.add_heading(f"Data Analysis Report: {session_data.get('original_filename', 'Dataset')}", 0)
    
    # Executive Summary
    exec_summary = narrative.get('executive_summary', '')
    if exec_summary:
        doc.add_heading('Executive Summary', level=1)
        doc.add_paragraph(str(exec_summary))
    
    # Key Findings
    findings = narrative.get('key_findings', [])
    if findings:
        doc.add_heading('Key Findings', level=1)
        for finding in findings:
            if finding and str(finding).strip():
                doc.add_paragraph(str(finding), style='List Bullet')
        
    # Descriptive Stats
    stats = analysis_results.get('descriptive_stats', {})
    if stats:
        doc.add_heading('Descriptive Statistics', level=1)
        table = doc.add_table(rows=1, cols=5)
        table.style = 'Table Grid'
        hdr_cells = table.rows[0].cells
        hdr_cells[0].text = 'Column'
        hdr_cells[1].text = 'Mean'
        hdr_cells[2].text = 'Min'
        hdr_cells[3].text = 'Max'
        hdr_cells[4].text = 'Std Dev'
        for col, s in list(stats.items())[:10]:
            row_cells = table.add_row().cells
            row_cells[0].text = str(col)
            row_cells[1].text = str(s.get('mean', '-'))
            row_cells[2].text = str(s.get('min', '-'))
            row_cells[3].text = str(s.get('max', '-'))
            row_cells[4].text = str(s.get('std', '-'))
            
    # Charts
    if charts_config:
        doc.add_heading('Visualizations', level=1)
        chart_count = 0
        for chart in charts_config:
            try:
                img_stream = create_chart_image(chart)
                doc.add_paragraph(chart.get('title', 'Chart'))
                if img_stream:
                    doc.add_picture(img_stream, width=Inches(5.5))
                    chart_count += 1
                else:
                    doc.add_paragraph('(Chart image could not be generated)')
            except Exception as e:
                print(f"DOCX chart error: {e}")
                doc.add_paragraph(f"[Chart skipped: {chart.get('title', 'Chart')}]")
        
        if chart_count == 0:
            doc.add_paragraph("(No chart images could be generated)")
            
    buffer = io.BytesIO()
    doc.save(buffer)
    docx_bytes = buffer.getvalue()
    buffer.close()
    return docx_bytes
