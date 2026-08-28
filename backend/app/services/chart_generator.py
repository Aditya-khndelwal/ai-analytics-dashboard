import pandas as pd
import numpy as np
import plotly.graph_objects as go
import json
from typing import List, Dict, Any

THEME_COLORS = ['#C9A76A', '#5FA98A', '#7C93B8', '#B0637E', '#9C9892']
LAYOUT_DEFAULTS = {
    'paper_bgcolor': 'rgba(0,0,0,0)',
    'plot_bgcolor': 'rgba(0,0,0,0)',
    'font': {'color': '#F5F1E8', 'family': 'Inter, sans-serif'},
    'xaxis': {'gridcolor': '#2A2A30', 'zerolinecolor': '#2A2A30'},
    'yaxis': {'gridcolor': '#2A2A30', 'zerolinecolor': '#2A2A30'},
    'margin': {'l': 50, 'r': 30, 't': 40, 'b': 50}
}


def safe_json(fig: go.Figure) -> dict:
    """Safely convert a Plotly figure to a JSON-compatible dict."""
    raw = json.loads(fig.to_json())
    return {'data': raw.get('data', []), 'layout': raw.get('layout', {})}


def generate_chart_configs(df: pd.DataFrame, schema: List[Dict[str, Any]], analysis_results: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Generates a list of Plotly chart configurations based on data patterns."""
    numeric_cols = [s['name'] for s in schema if s['inferred_type'] == 'numeric']
    categorical_cols = [s['name'] for s in schema if s['inferred_type'] == 'categorical']
    datetime_cols = [s['name'] for s in schema if s['inferred_type'] == 'datetime']

    charts = []

    # 1. Histograms (max 6)
    for i, col in enumerate(numeric_cols[:6]):
        series = df[col].dropna().tolist()
        fig = go.Figure(data=[go.Histogram(
            x=series,
            marker_color=THEME_COLORS[i % len(THEME_COLORS)],
            opacity=0.85
        )])
        fig.update_layout(title=f'Distribution of {col}', xaxis_title=col, yaxis_title='Count', **LAYOUT_DEFAULTS)
        chart_json = safe_json(fig)
        charts.append({
            'id': f'hist_{i}', 'title': f'Distribution of {col}',
            'chart_type': 'histogram', **chart_json
        })

    # 2. Bar charts for categoricals (max 4)
    for i, col in enumerate(categorical_cols[:4]):
        counts = df[col].value_counts().head(10)
        if len(counts) > 0:
            fig = go.Figure(data=[go.Bar(
                x=[str(v) for v in counts.index.tolist()],
                y=counts.values.tolist(),
                marker_color=THEME_COLORS[i % len(THEME_COLORS)]
            )])
            fig.update_layout(title=f'Top values in {col}', xaxis_title=col, yaxis_title='Count', **LAYOUT_DEFAULTS)
            chart_json = safe_json(fig)
            charts.append({
                'id': f'bar_{i}', 'title': f'Top values in {col}',
                'chart_type': 'bar', **chart_json
            })

    # 3. Correlation Heatmap
    if len(numeric_cols) >= 2:
        corr = df[numeric_cols].corr()
        z_vals = [[round(float(v), 4) if pd.notna(v) else 0 for v in row] for row in corr.values]
        fig = go.Figure(data=go.Heatmap(
            z=z_vals,
            x=corr.columns.tolist(),
            y=corr.columns.tolist(),
            colorscale='RdBu',
            zmin=-1, zmax=1,
            colorbar=dict(title=dict(text='Correlation', side='right'))
        ))
        fig.update_layout(title='Correlation Heatmap', **LAYOUT_DEFAULTS)
        chart_json = safe_json(fig)
        charts.append({
            'id': 'corr_heatmap', 'title': 'Correlation Heatmap',
            'chart_type': 'heatmap', **chart_json
        })

    # 4. Scatter plots for top 2 correlated pairs
    top_corrs = analysis_results.get('top_correlations', [])
    for i, corr_item in enumerate(top_corrs[:2]):
        c1, c2 = corr_item['col1'], corr_item['col2']
        valid = df[[c1, c2]].dropna()
        fig = go.Figure(data=[go.Scatter(
            x=valid[c1].tolist(),
            y=valid[c2].tolist(),
            mode='markers',
            marker=dict(
                color=THEME_COLORS[i % len(THEME_COLORS)],
                opacity=0.7,
                size=7
            )
        )])
        corr_val = corr_item.get('correlation', '')
        fig.update_layout(
            title=f'{c1} vs {c2} (r={corr_val})',
            xaxis_title=c1, yaxis_title=c2,
            **LAYOUT_DEFAULTS
        )
        chart_json = safe_json(fig)
        charts.append({
            'id': f'scatter_{i}', 'title': f'{c1} vs {c2}',
            'chart_type': 'scatter', **chart_json
        })

    # 5. Line charts for datetime + numeric (time series)
    if datetime_cols and numeric_cols:
        dt_col = datetime_cols[0]
        sorted_df = df.sort_values(by=dt_col).dropna(subset=[dt_col])
        for i, num_col in enumerate(numeric_cols[:2]):
            valid = sorted_df[[dt_col, num_col]].dropna()
            x_vals = [str(v) for v in valid[dt_col].tolist()]
            y_vals = valid[num_col].tolist()
            fig = go.Figure(data=[go.Scatter(
                x=x_vals, y=y_vals,
                mode='lines+markers',
                line=dict(color=THEME_COLORS[i % len(THEME_COLORS)], width=2),
                marker=dict(size=5)
            )])
            fig.update_layout(
                title=f'{num_col} over time',
                xaxis_title=dt_col, yaxis_title=num_col,
                **LAYOUT_DEFAULTS
            )
            chart_json = safe_json(fig)
            charts.append({
                'id': f'line_{i}', 'title': f'{num_col} over time',
                'chart_type': 'line', **chart_json
            })

    # 6. Pie charts (max 2)
    pie_cols = [c for c in categorical_cols if df[c].nunique() <= 8]
    for i, col in enumerate(pie_cols[:2]):
        counts = df[col].value_counts()
        fig = go.Figure(data=[go.Pie(
            labels=[str(v) for v in counts.index.tolist()],
            values=counts.values.tolist(),
            marker=dict(colors=THEME_COLORS),
            hole=0.35
        )])
        fig.update_layout(title=f'Composition of {col}', **LAYOUT_DEFAULTS)
        chart_json = safe_json(fig)
        charts.append({
            'id': f'pie_{i}', 'title': f'Composition of {col}',
            'chart_type': 'pie', **chart_json
        })

    return charts
