import os
import io
import json
import tempfile
import traceback
from typing import Dict, Any, List, Optional

# Ensure matplotlib uses a writable temp directory for caching across Windows and Linux
os.environ['MPLCONFIGDIR'] = tempfile.gettempdir()
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import numpy as np

from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image, Table, TableStyle, KeepTogether
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from docx import Document
from docx.shared import Inches

THEME_COLORS = ['#C9A76A', '#5FA98A', '#7C93B8', '#B0637E', '#9C9892', '#D4A574', '#6B8E7B']


def _safe_float(val: Any) -> Optional[float]:
    """Safely converts any value to a finite float, returning None if invalid."""
    if val is None:
        return None
    try:
        f = float(val)
        if np.isnan(f) or np.isinf(f):
            return None
        return f
    except (ValueError, TypeError):
        return None


def create_chart_image(chart_config: Dict[str, Any]) -> Optional[io.BytesIO]:
    """
    Renders a chart configuration dict to a crisp PNG image byte stream.
    Uses pure-Python headless Matplotlib for 100% reliable rendering without
    requiring headless Chromium, Kaleido, or system GUI libraries.
    """
    data_list = chart_config.get('data', [])
    layout = chart_config.get('layout', {})
    
    # Extract chart title
    title = chart_config.get('title') or ''
    if not title and isinstance(layout.get('title'), dict):
        title = layout['title'].get('text', '')
    elif not title and isinstance(layout.get('title'), str):
        title = layout.get('title', '')
    if not title:
        title = 'Visualization'

    # If no data traces, render an informational card
    if not data_list:
        return _render_card_fallback(title, 'No data series provided for chart.')

    trace = data_list[0]
    chart_type = chart_config.get('chart_type') or trace.get('type', 'bar')

    fig = None
    try:
        fig, ax = plt.subplots(figsize=(6.5, 3.8), dpi=140)
        fig.patch.set_facecolor('white')
        ax.set_facecolor('#FAFAFA')
        ax.grid(True, linestyle='--', alpha=0.35, color='#D0D0D0')
        ax.set_axisbelow(True)

        if chart_type == 'histogram' or trace.get('type') == 'histogram':
            x_raw = trace.get('x', [])
            numeric_vals = [f for v in x_raw if (f := _safe_float(v)) is not None]
            if numeric_vals:
                bins = min(25, max(5, int(np.sqrt(len(numeric_vals)))))
                ax.hist(numeric_vals, bins=bins, color='#C9A76A', edgecolor='#FFFFFF', alpha=0.9)
                ax.set_ylabel('Count', fontsize=9, color='#444444')
            else:
                ax.text(0.5, 0.5, 'Distribution Data (Non-numeric)', ha='center', va='center',
                        transform=ax.transAxes, color='#777777', fontsize=10)
            x_title = layout.get('xaxis', {}).get('title', '')
            if isinstance(x_title, dict):
                x_title = x_title.get('text', '')
            ax.set_xlabel(str(x_title), fontsize=9, color='#444444')

        elif chart_type == 'bar' or trace.get('type') == 'bar':
            x_raw = trace.get('x', [])
            y_raw = trace.get('y', [])
            x_vals = [str(v) if v is not None else '' for v in x_raw]
            y_vals = [_safe_float(v) or 0.0 for v in y_raw]
            
            # Cap number of bars to keep chart clean and legible
            if len(x_vals) > 15:
                x_vals = x_vals[:15]
                y_vals = y_vals[:15]
                
            colors_list = [THEME_COLORS[i % len(THEME_COLORS)] for i in range(len(x_vals))]
            bars = ax.bar(x_vals, y_vals, color=colors_list, edgecolor='#FFFFFF', alpha=0.9, width=0.6)
            
            if len(x_vals) <= 12 and len(x_vals) > 0:
                for bar in bars:
                    height = bar.get_height()
                    label_txt = f'{height:.1f}' if abs(height) < 100 and height != int(height) else f'{int(height)}'
                    ax.annotate(label_txt,
                                xy=(bar.get_x() + bar.get_width() / 2, height),
                                xytext=(0, 3), textcoords="offset points",
                                ha='center', va='bottom', fontsize=8, color='#333333')
                                
            if len(x_vals) > 4 or any(len(x) > 6 for x in x_vals):
                plt.setp(ax.get_xticklabels(), rotation=25, ha='right', fontsize=8)
                
            y_title = layout.get('yaxis', {}).get('title', 'Value')
            if isinstance(y_title, dict):
                y_title = y_title.get('text', 'Value')
            ax.set_ylabel(str(y_title), fontsize=9, color='#444444')

        elif chart_type == 'heatmap' or trace.get('type') == 'heatmap':
            z_vals = trace.get('z', [])
            x_labels = [str(v) if v is not None else '' for v in trace.get('x', [])]
            y_labels = [str(v) if v is not None else '' for v in trace.get('y', [])]
            
            # Clean z matrix
            z_clean = []
            for row in z_vals:
                if isinstance(row, list):
                    z_clean.append([_safe_float(val) if _safe_float(val) is not None else 0.0 for val in row])
            
            if z_clean:
                z_array = np.array(z_clean, dtype=float)
                im = ax.imshow(z_array, cmap='RdBu_r', vmin=-1, vmax=1, aspect='auto')
                ax.set_xticks(range(len(x_labels)))
                ax.set_yticks(range(len(y_labels)))
                ax.set_xticklabels(x_labels, rotation=35, ha='right', fontsize=8)
                ax.set_yticklabels(y_labels, fontsize=8)
                plt.colorbar(im, ax=ax, fraction=0.046, pad=0.04)
                
                if len(x_labels) <= 8 and len(y_labels) <= 8:
                    for i in range(len(y_labels)):
                        for j in range(len(x_labels)):
                            if i < z_array.shape[0] and j < z_array.shape[1]:
                                val = z_array[i, j]
                                c = 'white' if abs(val) > 0.6 else 'black'
                                ax.text(j, i, f'{val:.2f}', ha='center', va='center', fontsize=7, color=c)
            else:
                ax.text(0.5, 0.5, 'Correlation Matrix Unavailable', ha='center', va='center',
                        transform=ax.transAxes, color='#777777')

        elif chart_type in ['scatter', 'line'] or trace.get('type') in ['scatter', 'line']:
            mode = trace.get('mode', 'markers')
            # Check if there are multiple traces (e.g. multi-line or grouped scatter)
            for idx_tr, tr in enumerate(data_list[:4]):
                x_raw = tr.get('x', [])
                y_raw = tr.get('y', [])
                tr_color = THEME_COLORS[idx_tr % len(THEME_COLORS)]
                tr_name = tr.get('name', f'Series {idx_tr + 1}')
                
                if 'lines' in mode or tr.get('type') == 'line':
                    y_clean = [_safe_float(v) or 0.0 for v in y_raw]
                    ax.plot(range(len(x_raw)), y_clean, color=tr_color, linewidth=2,
                            marker='o', markersize=4, label=tr_name if len(data_list) > 1 else None)
                    if len(x_raw) <= 15 and idx_tr == 0:
                        ax.set_xticks(range(len(x_raw)))
                        ax.set_xticklabels([str(v) for v in x_raw], rotation=30, ha='right', fontsize=8)
                else:
                    pts_x, pts_y = [], []
                    for x, y in zip(x_raw, y_raw):
                        fx, fy = _safe_float(x), _safe_float(y)
                        if fx is not None and fy is not None:
                            pts_x.append(fx)
                            pts_y.append(fy)
                    if pts_x:
                        ax.scatter(pts_x, pts_y, color=tr_color, alpha=0.75,
                                   edgecolors='#7A6237', s=40, label=tr_name if len(data_list) > 1 else None)
            
            if len(data_list) > 1:
                ax.legend(fontsize=8, loc='upper right')

            x_title = layout.get('xaxis', {}).get('title', '')
            if isinstance(x_title, dict):
                x_title = x_title.get('text', '')
            y_title = layout.get('yaxis', {}).get('title', '')
            if isinstance(y_title, dict):
                y_title = y_title.get('text', '')
            ax.set_xlabel(str(x_title), fontsize=9, color='#444444')
            ax.set_ylabel(str(y_title), fontsize=9, color='#444444')

        elif chart_type == 'pie' or trace.get('type') == 'pie':
            labels = [str(v) if v is not None else '' for v in trace.get('labels', [])][:7]
            values_raw = trace.get('values', [])[:7]
            values = [max(0.0, _safe_float(v) or 0.0) for v in values_raw]
            
            if sum(values) > 0 and len(labels) == len(values):
                ax.pie(values, labels=labels, autopct='%1.1f%%', colors=THEME_COLORS[:len(labels)],
                       startangle=140, textprops={'fontsize': 8})
                ax.axis('equal')
            else:
                ax.text(0.5, 0.5, 'Composition Data Unavailable', ha='center', va='center',
                        transform=ax.transAxes, color='#777777')

        elif chart_type == 'box' or trace.get('type') == 'box':
            x_raw = trace.get('x', [])
            y_raw = trace.get('y', [])
            cats = sorted(list(set(str(v) if v is not None else '' for v in x_raw)))
            box_data = []
            valid_cats = []
            for c in cats:
                vals = [_safe_float(y) for x, y in zip(x_raw, y_raw) if str(x) == c and _safe_float(y) is not None]
                if vals:
                    box_data.append(vals)
                    valid_cats.append(c)
            if box_data:
                ax.boxplot(box_data, tick_labels=valid_cats, patch_artist=True,
                           boxprops=dict(facecolor='#C9A76A', color='#7A6237', alpha=0.8),
                           medianprops=dict(color='#16161A', linewidth=2))
                plt.setp(ax.get_xticklabels(), rotation=25, ha='right', fontsize=8)
            y_title = layout.get('yaxis', {}).get('title', '')
            if isinstance(y_title, dict):
                y_title = y_title.get('text', '')
            ax.set_ylabel(str(y_title), fontsize=9, color='#444444')

        else:
            # Fallback for generic or custom chart types
            x_raw = trace.get('x', [])
            y_raw = trace.get('y', [])
            x_str = [str(v) for v in x_raw[:12]]
            y_flt = [_safe_float(v) or 0.0 for v in y_raw[:12]]
            if x_str and y_flt:
                ax.bar(x_str, y_flt, color='#C9A76A', alpha=0.85, width=0.6)
                if len(x_str) > 4:
                    plt.setp(ax.get_xticklabels(), rotation=25, ha='right', fontsize=8)

        ax.set_title(title, fontsize=11, fontweight='bold', pad=10, color='#1A1A1A')
        plt.tight_layout()

        buf = io.BytesIO()
        fig.savefig(buf, format='png', dpi=140, bbox_inches='tight')
        plt.close(fig)
        buf.seek(0)
        return buf

    except Exception as err:
        if fig is not None:
            plt.close(fig)
        print(f"Matplotlib chart render handled exception for '{title}': {err}")
        return _render_card_fallback(title, f"Chart Type: {chart_type.capitalize()}")


def _render_card_fallback(title: str, subtitle: str) -> Optional[io.BytesIO]:
    """
    Guaranteed fallback that always draws a clean branded card image in Matplotlib.
    Ensures PDF reports never have broken images or ugly missing placeholders.
    """
    try:
        fig, ax = plt.subplots(figsize=(6.5, 2.2), dpi=120)
        fig.patch.set_facecolor('#FDFDFD')
        ax.set_facecolor('#F8F7F4')
        ax.set_xlim(0, 1)
        ax.set_ylim(0, 1)
        ax.axis('off')

        # Border box
        rect = plt.Rectangle((0.02, 0.05), 0.96, 0.90, fill=True,
                             facecolor='#FAF8F4', edgecolor='#C9A76A', linewidth=1.5,
                             transform=ax.transAxes, clip_on=False)
        ax.add_patch(rect)

        ax.text(0.5, 0.62, title, ha='center', va='center',
                fontsize=11, fontweight='bold', color='#16161A', transform=ax.transAxes)
        ax.text(0.5, 0.35, subtitle, ha='center', va='center',
                fontsize=9, color='#7A6237', transform=ax.transAxes)

        buf = io.BytesIO()
        fig.savefig(buf, format='png', dpi=120, bbox_inches='tight')
        plt.close(fig)
        buf.seek(0)
        return buf
    except Exception as e:
        print(f"Fallback card render failed: {e}")
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
            ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#16161A')),
            ('TEXTCOLOR', (0,0), (-1,0), colors.HexColor('#C9A76A')),
            ('ALIGN', (0,0), (-1,-1), 'CENTER'),
            ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
            ('FONTSIZE', (0,0), (-1,-1), 8),
            ('BOTTOMPADDING', (0,0), (-1,0), 8),
            ('TOPPADDING', (0,0), (-1,-1), 4),
            ('BOTTOMPADDING', (0,1), (-1,-1), 4),
            ('BACKGROUND', (0,1), (-1,-1), colors.HexColor('#FAF8F4')),
            ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#D0D0D0'))
        ]))
        elements.append(t)
        elements.append(Spacer(1, 14))
        
    # Charts
    if charts_config:
        elements.append(Paragraph("Visualizations", heading2))
        elements.append(Spacer(1, 8))
        
        chart_count = 0
        for chart in charts_config:
            try:
                img_stream = create_chart_image(chart)
                if img_stream:
                    img = Image(img_stream, width=440, height=255)
                    elements.append(KeepTogether([img, Spacer(1, 14)]))
                    chart_count += 1
                else:
                    elements.append(Paragraph(f"[Chart: {chart.get('title', 'Chart')}]", normal))
                    elements.append(Spacer(1, 8))
            except Exception as e:
                print(f"PDF chart embed error: {e}")
        
        if chart_count == 0:
            elements.append(Paragraph("(No charts available in this analysis)", normal))
            
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
                if img_stream:
                    doc.add_paragraph(chart.get('title', 'Chart'))
                    doc.add_picture(img_stream, width=Inches(5.5))
                    chart_count += 1
            except Exception as e:
                print(f"DOCX chart error: {e}")
        
        if chart_count == 0:
            doc.add_paragraph("(No charts available in this analysis)")
            
    buffer = io.BytesIO()
    doc.save(buffer)
    docx_bytes = buffer.getvalue()
    buffer.close()
    return docx_bytes
