import os
import io
import json
import tempfile
import traceback
from typing import Dict, Any, List, Optional

# Ensure matplotlib uses a writable temp directory for caching
os.environ['MPLCONFIGDIR'] = tempfile.gettempdir()
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np

import plotly.graph_objects as go
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image, Table, TableStyle, KeepTogether
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from docx import Document
from docx.shared import Inches

THEME_COLORS = ['#C9A76A', '#5FA98A', '#7C93B8', '#B0637E', '#9C9892', '#D4A574', '#6B8E7B']


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
    """
    Renders a chart configuration dict to a PNG image byte stream.
    Uses Matplotlib for fast, headless, 100% reliable rendering without browser/kaleido dependencies.
    Falls back to Plotly to_image if needed.
    """
    data_list = chart_config.get('data', [])
    if not data_list:
        return None

    layout = chart_config.get('layout', {})
    title = chart_config.get('title') or layout.get('title', {}).get('text') or ''
    if isinstance(title, dict):
        title = title.get('text', '')

    trace = data_list[0]
    chart_type = chart_config.get('chart_type') or trace.get('type', 'bar')

    # Primary renderer: Matplotlib (pure Python, fast, zero headless browser / kaleido hangs)
    fig, ax = plt.subplots(figsize=(6.5, 3.8), dpi=140)
    fig.patch.set_facecolor('white')
    ax.set_facecolor('#FAFAFA')
    ax.grid(True, linestyle='--', alpha=0.35, color='#D0D0D0')
    ax.set_axisbelow(True)

    try:
        if chart_type == 'histogram' or trace.get('type') == 'histogram':
            x_vals = trace.get('x', [])
            numeric_vals = [float(v) for v in x_vals if v is not None and not np.isnan(float(v))]
            bins = min(25, max(5, int(np.sqrt(len(numeric_vals))))) if numeric_vals else 10
            ax.hist(numeric_vals, bins=bins, color='#C9A76A', edgecolor='#FFFFFF', alpha=0.9)
            ax.set_ylabel('Count', fontsize=9, color='#444444')
            x_title = layout.get('xaxis', {}).get('title', '')
            if isinstance(x_title, dict):
                x_title = x_title.get('text', '')
            ax.set_xlabel(x_title, fontsize=9, color='#444444')

        elif chart_type == 'bar' or trace.get('type') == 'bar':
            x_vals = [str(v) for v in trace.get('x', [])]
            y_vals = [float(v) if v is not None else 0.0 for v in trace.get('y', [])]
            colors_list = [THEME_COLORS[i % len(THEME_COLORS)] for i in range(len(x_vals))]
            bars = ax.bar(x_vals, y_vals, color=colors_list, edgecolor='#FFFFFF', alpha=0.9, width=0.6)
            if len(x_vals) <= 12:
                for bar in bars:
                    height = bar.get_height()
                    label_txt = f'{height:.1f}' if abs(height) < 100 and height != int(height) else f'{int(height)}'
                    ax.annotate(label_txt,
                                xy=(bar.get_x() + bar.get_width() / 2, height),
                                xytext=(0, 3), textcoords="offset points",
                                ha='center', va='bottom', fontsize=8, color='#333333')
            if len(x_vals) > 5 or any(len(str(x)) > 6 for x in x_vals):
                plt.setp(ax.get_xticklabels(), rotation=25, ha='right', fontsize=8)
            y_title = layout.get('yaxis', {}).get('title', 'Value')
            if isinstance(y_title, dict):
                y_title = y_title.get('text', 'Value')
            ax.set_ylabel(y_title, fontsize=9, color='#444444')

        elif chart_type == 'heatmap' or trace.get('type') == 'heatmap':
            z_vals = trace.get('z', [])
            x_labels = [str(v) for v in trace.get('x', [])]
            y_labels = [str(v) for v in trace.get('y', [])]
            z_array = np.array(z_vals, dtype=float)
            im = ax.imshow(z_array, cmap='RdBu_r', vmin=-1, vmax=1, aspect='auto')
            ax.set_xticks(range(len(x_labels)))
            ax.set_yticks(range(len(y_labels)))
            ax.set_xticklabels(x_labels, rotation=35, ha='right', fontsize=8)
            ax.set_yticklabels(y_labels, fontsize=8)
            plt.colorbar(im, ax=ax, fraction=0.046, pad=0.04)
            if len(x_labels) <= 8:
                for i in range(len(y_labels)):
                    for j in range(len(x_labels)):
                        val = z_array[i, j]
                        if not np.isnan(val):
                            c = 'white' if abs(val) > 0.6 else 'black'
                            ax.text(j, i, f'{val:.2f}', ha='center', va='center', fontsize=7, color=c)

        elif chart_type in ['scatter', 'line'] or trace.get('type') == 'scatter':
            x_vals = trace.get('x', [])
            y_vals = trace.get('y', [])
            mode = trace.get('mode', 'markers')
            if 'lines' in mode:
                ax.plot(range(len(x_vals)), y_vals, color='#C9A76A', linewidth=2, marker='o', markersize=4)
                if len(x_vals) <= 15:
                    ax.set_xticks(range(len(x_vals)))
                    ax.set_xticklabels([str(v) for v in x_vals], rotation=30, ha='right', fontsize=8)
            else:
                ax.scatter(x_vals, y_vals, color='#C9A76A', alpha=0.75, edgecolors='#7A6237', s=40)
            x_title = layout.get('xaxis', {}).get('title', '')
            if isinstance(x_title, dict):
                x_title = x_title.get('text', '')
            y_title = layout.get('yaxis', {}).get('title', '')
            if isinstance(y_title, dict):
                y_title = y_title.get('text', '')
            ax.set_xlabel(x_title, fontsize=9, color='#444444')
            ax.set_ylabel(y_title, fontsize=9, color='#444444')

        elif chart_type == 'pie' or trace.get('type') == 'pie':
            labels = [str(v) for v in trace.get('labels', [])][:7]
            values = trace.get('values', [])[:7]
            ax.pie(values, labels=labels, autopct='%1.1f%%', colors=THEME_COLORS[:len(labels)],
                   startangle=140, textprops={'fontsize': 8})
            ax.axis('equal')

        elif chart_type == 'box' or trace.get('type') == 'box':
            x_vals = trace.get('x', [])
            y_vals = trace.get('y', [])
            cats = sorted(list(set(str(v) for v in x_vals)))
            box_data = [[float(y) for x, y in zip(x_vals, y_vals) if str(x) == c and y is not None] for c in cats]
            ax.boxplot(box_data, tick_labels=cats, patch_artist=True,
                       boxprops=dict(facecolor='#C9A76A', color='#7A6237', alpha=0.8),
                       medianprops=dict(color='#16161A', linewidth=2))
            plt.setp(ax.get_xticklabels(), rotation=25, ha='right', fontsize=8)
            y_title = layout.get('yaxis', {}).get('title', '')
            if isinstance(y_title, dict):
                y_title = y_title.get('text', '')
            ax.set_ylabel(y_title, fontsize=9, color='#444444')

        ax.set_title(title, fontsize=11, fontweight='bold', pad=10, color='#1A1A1A')
        plt.tight_layout()

        buf = io.BytesIO()
        fig.savefig(buf, format='png', dpi=140, bbox_inches='tight')
        plt.close(fig)
        buf.seek(0)
        return buf
    except Exception as mpl_err:
        plt.close(fig)
        print(f"Matplotlib render fallback for '{title}': {mpl_err}")

    # Fallback to Plotly fig.to_image
    try:
        data = _sanitize_for_plotly(data_list)
        layout = _sanitize_for_plotly(layout)
        fig = go.Figure(data=data, layout=layout)
        fig.update_layout(paper_bgcolor='white', plot_bgcolor='white')
        img_bytes = fig.to_image(format="png", width=700, height=450, scale=2)
        buf = io.BytesIO(img_bytes)
        buf.seek(0)
        return buf
    except Exception as e:
        print(f"Chart image generation FAILED for '{title}': {e}")
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
                    img = Image(img_stream, width=440, height=255)
                    elements.append(KeepTogether([img, Spacer(1, 14)]))
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
