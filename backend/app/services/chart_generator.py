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


def filter_visualization_outliers(series: pd.Series) -> pd.Series:
    """
    Filters extreme sentinel outliers (e.g. 9999, 1500, 25000) for clean chart visualization.
    Preserves normal variability while preventing massive axis stretching that crushes 99% of data.
    """
    s = series.dropna()
    if len(s) < 10:
        return s
    q1 = s.quantile(0.25)
    q3 = s.quantile(0.75)
    iqr = q3 - q1
    if iqr == 0:
        return s
    
    upper_bound = q3 + 3.5 * iqr
    lower_bound = q1 - 3.5 * iqr
    
    # Only filter if extreme outliers actually exist (e.g. max is > 2.0x upper bound)
    has_extreme_high = s.max() > upper_bound * 2.0
    has_extreme_low = s.min() < lower_bound - abs(lower_bound) * 2.0
    
    if has_extreme_high or has_extreme_low:
        filtered = s[(s >= lower_bound) & (s <= upper_bound)]
        if len(filtered) >= len(s) * 0.85:
            return filtered
    return s


def generate_chart_configs(df: pd.DataFrame, schema: List[Dict[str, Any]], analysis_results: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Generates a list of Plotly chart configurations based on data patterns."""
    numeric_cols = [s['name'] for s in schema if s['inferred_type'] == 'numeric']
    categorical_cols = [s['name'] for s in schema if s['inferred_type'] == 'categorical']
    datetime_cols = [s['name'] for s in schema if s['inferred_type'] == 'datetime']

    charts = []

    # 1. Histograms (max 6) - with outlier filtering for clean distribution
    for i, col in enumerate(numeric_cols[:6]):
        series = df[col].dropna()
        plot_series = filter_visualization_outliers(series)
        if len(plot_series) > 3000:
            plot_series = plot_series.sample(3000, random_state=42)
        fig = go.Figure(data=[go.Histogram(
            x=plot_series.tolist(),
            marker_color=THEME_COLORS[i % len(THEME_COLORS)],
            opacity=0.85
        )])
        title_suffix = ""
        if len(plot_series) < len(series):
            title_suffix = f" (excl. {len(series) - len(plot_series)} outliers)"
        fig.update_layout(title=f'Distribution of {col}{title_suffix}', xaxis_title=col, yaxis_title='Count', **LAYOUT_DEFAULTS)
        chart_json = safe_json(fig)
        charts.append({
            'id': f'hist_{i}', 'title': f'Distribution of {col}',
            'chart_type': 'histogram', **chart_json
        })

    # 2. Bar charts for categoricals (max 4)
    for i, col in enumerate(categorical_cols[:4]):
        counts = df[col].dropna().value_counts().head(10)
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

    # 2b. Category Breakdown Charts (Group Averages & Category Distributions)
    for i, cat_col in enumerate(categorical_cols[:2]):
        for j, num_col in enumerate(numeric_cols[:2]):
            valid_subset = df[[cat_col, num_col]].dropna()
            clean_s = filter_visualization_outliers(valid_subset[num_col])
            valid_subset = valid_subset[valid_subset[num_col].isin(clean_s)]
            group_stats = valid_subset.groupby(cat_col)[num_col].agg(['mean', 'count']).dropna()
            if len(group_stats) > 1:
                sorted_stats = group_stats.sort_values(by='mean', ascending=False).head(12)
                fig_avg = go.Figure(data=[go.Bar(
                    x=[str(v) for v in sorted_stats.index.tolist()],
                    y=[round(float(v), 2) for v in sorted_stats['mean'].tolist()],
                    text=[f"{v:.1f}" for v in sorted_stats['mean']],
                    textposition='auto',
                    marker_color=THEME_COLORS[(i + j) % len(THEME_COLORS)]
                )])
                fig_avg.update_layout(
                    title=f'Average {num_col} by {cat_col}',
                    xaxis_title=cat_col,
                    yaxis_title=f'Mean {num_col}',
                    **LAYOUT_DEFAULTS
                )
                chart_json = safe_json(fig_avg)
                charts.append({
                    'id': f'group_bar_{i}_{j}',
                    'title': f'Average {num_col} by {cat_col}',
                    'chart_type': 'bar',
                    **chart_json
                })

                if len(group_stats) <= 10:
                    valid_box = valid_subset[[cat_col, num_col]].dropna()
                    if len(valid_box) > 2000:
                        valid_box = valid_box.sample(2000, random_state=42)
                    fig_box = go.Figure(data=[go.Box(
                        x=[str(v) for v in valid_box[cat_col].tolist()],
                        y=valid_box[num_col].tolist(),
                        marker_color='#C9A76A'
                    )])
                    fig_box.update_layout(
                        title=f'{num_col} Distribution by {cat_col}',
                        xaxis_title=cat_col,
                        yaxis_title=num_col,
                        **LAYOUT_DEFAULTS
                    )
                    chart_json_box = safe_json(fig_box)
                    charts.append({
                        'id': f'box_{i}_{j}',
                        'title': f'{num_col} Distribution by {cat_col}',
                        'chart_type': 'box',
                        **chart_json_box
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
        for col in [c1, c2]:
            clean_col = filter_visualization_outliers(valid[col])
            valid = valid[valid[col].isin(clean_col)]
        if len(valid) > 2000:
            valid = valid.sample(2000, random_state=42)
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
        sorted_df = df.dropna(subset=[dt_col]).sort_values(by=dt_col)
        for i, num_col in enumerate(numeric_cols[:2]):
            valid = sorted_df[[dt_col, num_col]].dropna()
            if len(valid) == 0:
                continue

            clean_num = filter_visualization_outliers(valid[num_col])
            valid = valid[valid[num_col].isin(clean_num)]
            if len(valid) == 0:
                continue

            is_sum_metric = any(k in num_col.lower() for k in ['revenue', 'sales', 'units', 'count', 'amount', 'profit', 'cost', 'qty'])
            agg_func = 'sum' if is_sum_metric else 'mean'

            if valid[dt_col].dt.date.nunique() < len(valid):
                date_span = (valid[dt_col].max() - valid[dt_col].min()).days if len(valid) > 1 else 0
                if date_span > 365:
                    grouped = valid.groupby(valid[dt_col].dt.to_period('W'))[num_col].agg(agg_func).reset_index()
                    x_vals = [str(p.start_time.date()) for p in grouped[dt_col]]
                else:
                    grouped = valid.groupby(valid[dt_col].dt.date)[num_col].agg(agg_func).reset_index()
                    x_vals = [str(d) for d in grouped[dt_col]]
                y_vals = [round(float(v), 2) for v in grouped[num_col]]
            else:
                x_vals = [str(v)[:10] for v in valid[dt_col].tolist()]
                y_vals = [round(float(v), 2) for v in valid[num_col].tolist()]

            if len(x_vals) > 500:
                step = max(1, len(x_vals) // 500)
                x_vals = x_vals[::step]
                y_vals = y_vals[::step]

            fig = go.Figure(data=[go.Scatter(
                x=x_vals, y=y_vals,
                mode='lines+markers',
                line=dict(color=THEME_COLORS[i % len(THEME_COLORS)], width=2),
                marker=dict(size=4)
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
