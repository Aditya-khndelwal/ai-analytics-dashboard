"""
Local Query Engine — Answers data questions using Pandas operations.
No external API calls. Replaces Gemini for chat/Q&A.
"""

import re
import numpy as np
import pandas as pd


def answer_query(df: pd.DataFrame, question: str) -> dict:
    """
    Parse a natural language question and answer it using Pandas.
    Returns {"answer": str, "chart": dict|None}
    """
    q = question.lower().strip()
    columns = df.columns.tolist()
    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    cat_cols = df.select_dtypes(include=['object', 'category']).columns.tolist()

    # Find which column the user is asking about
    mentioned_col = _find_mentioned_column(q, columns)

    # ── Pattern matching for common questions ──

    # Summary / overview
    if any(kw in q for kw in ['summary', 'overview', 'describe', 'tell me about', 'what is this']):
        return _summary_answer(df)

    # Mean / average
    if any(kw in q for kw in ['mean', 'average', 'avg']):
        col = mentioned_col or (numeric_cols[0] if numeric_cols else None)
        if col and col in numeric_cols:
            val = round(df[col].mean(), 2)
            return {"answer": f"The average of **{col}** is **{val}**.", "chart": None}

    # Max / highest / largest
    if any(kw in q for kw in ['max', 'maximum', 'highest', 'largest', 'biggest', 'top']):
        col = mentioned_col or (numeric_cols[0] if numeric_cols else None)
        if col and col in numeric_cols:
            val = df[col].max()
            idx = df[col].idxmax()
            row_info = df.loc[idx].to_dict()
            top_cols = {k: _safe(v) for k, v in list(row_info.items())[:5]}
            return {"answer": f"The maximum value of **{col}** is **{_safe(val)}** (row {idx}).\n\nFull row: {top_cols}", "chart": None}

    # Min / lowest / smallest
    if any(kw in q for kw in ['min', 'minimum', 'lowest', 'smallest', 'bottom']):
        col = mentioned_col or (numeric_cols[0] if numeric_cols else None)
        if col and col in numeric_cols:
            val = df[col].min()
            return {"answer": f"The minimum value of **{col}** is **{_safe(val)}**.", "chart": None}

    # Count / how many
    if any(kw in q for kw in ['how many', 'count', 'total number', 'how much']):
        if mentioned_col:
            if mentioned_col in cat_cols:
                vc = df[mentioned_col].value_counts()
                top5 = "\n".join([f"- {k}: {v}" for k, v in vc.head(5).items()])
                chart = _bar_chart(vc.head(10), f"Value counts of {mentioned_col}", mentioned_col, "Count")
                return {"answer": f"**{mentioned_col}** has {df[mentioned_col].nunique()} unique values:\n\n{top5}", "chart": chart}
            else:
                non_null = df[mentioned_col].notna().sum()
                return {"answer": f"**{mentioned_col}** has {non_null} non-null values out of {len(df)} total rows.", "chart": None}
        return {"answer": f"The dataset has **{len(df):,}** rows and **{len(df.columns)}** columns.", "chart": None}

    # Distribution
    if any(kw in q for kw in ['distribution', 'histogram', 'spread', 'distributed']):
        col = mentioned_col or (numeric_cols[0] if numeric_cols else None)
        if col and col in numeric_cols:
            stats = df[col].describe()
            chart = _histogram_chart(df[col].dropna(), f"Distribution of {col}", col)
            return {
                "answer": f"**{col}** distribution:\n- Mean: {stats['mean']:.2f}\n- Std: {stats['std']:.2f}\n- Min: {stats['min']:.2f}\n- 25%: {stats['25%']:.2f}\n- 50%: {stats['50%']:.2f}\n- 75%: {stats['75%']:.2f}\n- Max: {stats['max']:.2f}",
                "chart": chart,
            }

    # Correlation
    if any(kw in q for kw in ['correlation', 'correlated', 'relationship', 'relate']):
        if len(numeric_cols) >= 2:
            corr_matrix = df[numeric_cols].corr()
            # Find top correlation (excluding self)
            pairs = []
            for i, c1 in enumerate(numeric_cols):
                for j, c2 in enumerate(numeric_cols):
                    if i < j:
                        pairs.append((c1, c2, abs(corr_matrix.loc[c1, c2])))
            pairs.sort(key=lambda x: x[2], reverse=True)
            top3 = pairs[:3]
            lines = [f"- **{c1}** ↔ **{c2}**: r={r:.3f}" for c1, c2, r in top3]
            return {"answer": f"Top correlations:\n\n" + "\n".join(lines), "chart": None}

    # Outliers
    if any(kw in q for kw in ['outlier', 'anomal', 'unusual', 'extreme']):
        col = mentioned_col or (numeric_cols[0] if numeric_cols else None)
        if col and col in numeric_cols:
            series = df[col].dropna()
            q1, q3 = series.quantile(0.25), series.quantile(0.75)
            iqr = q3 - q1
            mask = (series < q1 - 1.5 * iqr) | (series > q3 + 1.5 * iqr)
            n = mask.sum()
            return {
                "answer": f"**{col}** has **{n}** outliers ({round(n/len(series)*100, 1)}%).\n\nBounds: [{round(q1-1.5*iqr, 2)}, {round(q3+1.5*iqr, 2)}]",
                "chart": _box_chart(series, f"Box plot of {col}", col),
            }

    # Trend
    if any(kw in q for kw in ['trend', 'over time', 'increasing', 'decreasing', 'growth']):
        col = mentioned_col or (numeric_cols[0] if numeric_cols else None)
        if col and col in numeric_cols:
            series = df[col].dropna()
            from sklearn.linear_model import LinearRegression
            X = np.arange(len(series)).reshape(-1, 1)
            lr = LinearRegression().fit(X, series.values)
            slope = lr.coef_[0]
            direction = "increasing" if slope > 0 else "decreasing"
            return {
                "answer": f"**{col}** shows a **{direction}** trend (slope: {slope:.4f}, R²: {lr.score(X, series.values):.3f}).",
                "chart": _line_chart(series, f"Trend of {col}", col),
            }

    # Compare / group by
    if any(kw in q for kw in ['compare', 'group', 'by each', 'per', 'breakdown']):
        if cat_cols and numeric_cols:
            cat = _find_mentioned_column(q, cat_cols) or cat_cols[0]
            num = _find_mentioned_column(q, numeric_cols) or numeric_cols[0]
            grouped = df.groupby(cat)[num].mean().sort_values(ascending=False).head(10)
            lines = [f"- {k}: {v:.2f}" for k, v in grouped.items()]
            chart = _bar_chart(grouped, f"Average {num} by {cat}", cat, f"Avg {num}")
            return {"answer": f"Average **{num}** by **{cat}**:\n\n" + "\n".join(lines), "chart": chart}

    # Unique / distinct
    if any(kw in q for kw in ['unique', 'distinct', 'categories']):
        col = mentioned_col or (cat_cols[0] if cat_cols else columns[0])
        uniq = df[col].nunique()
        return {"answer": f"**{col}** has **{uniq}** unique values.", "chart": None}

    # Missing / null
    if any(kw in q for kw in ['missing', 'null', 'empty', 'nan']):
        missing = df.isnull().sum()
        has_missing = missing[missing > 0]
        if len(has_missing) > 0:
            lines = [f"- **{c}**: {v} ({round(v/len(df)*100, 1)}%)" for c, v in has_missing.items()]
            return {"answer": f"Missing values:\n\n" + "\n".join(lines[:10]), "chart": None}
        return {"answer": "No missing values found in the dataset! ✅", "chart": None}

    # Column info
    if mentioned_col:
        return _column_info(df, mentioned_col)

    # Fallback
    return _summary_answer(df)


def _find_mentioned_column(q: str, columns: list) -> str:
    """Find which column name is mentioned in the question."""
    q_lower = q.lower()
    # Exact match first
    for col in sorted(columns, key=len, reverse=True):
        if col.lower() in q_lower:
            return col
    # Fuzzy: check if words in column name appear in question
    for col in columns:
        col_words = re.split(r'[_\s]+', col.lower())
        if len(col_words) > 0 and all(w in q_lower for w in col_words if len(w) > 2):
            return col
    return None


def _summary_answer(df):
    """Generate a summary of the dataset."""
    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    cat_cols = df.select_dtypes(include=['object']).columns.tolist()
    missing = df.isnull().sum().sum()

    lines = [
        f"📊 **Dataset Overview**",
        f"- **Rows**: {len(df):,}",
        f"- **Columns**: {len(df.columns)}",
        f"- **Numeric columns**: {len(numeric_cols)} ({', '.join(numeric_cols[:5])}{'...' if len(numeric_cols) > 5 else ''})",
        f"- **Categorical columns**: {len(cat_cols)} ({', '.join(cat_cols[:5])}{'...' if len(cat_cols) > 5 else ''})",
        f"- **Missing values**: {missing:,} ({round(missing/(len(df)*len(df.columns))*100, 1) if len(df) > 0 else 0}%)",
    ]

    if numeric_cols:
        desc = df[numeric_cols[:3]].describe().round(2)
        lines.append(f"\n**Quick stats** (first 3 numeric columns):")
        for col in desc.columns:
            lines.append(f"- {col}: mean={desc.loc['mean', col]}, std={desc.loc['std', col]}, range=[{desc.loc['min', col]}, {desc.loc['max', col]}]")

    return {"answer": "\n".join(lines), "chart": None}


def _column_info(df, col):
    """Generate info for a specific column."""
    series = df[col]
    lines = [f"📋 **Column: {col}**", f"- Type: {series.dtype}", f"- Non-null: {series.notna().sum()}/{len(df)}", f"- Unique: {series.nunique()}"]

    if pd.api.types.is_numeric_dtype(series):
        desc = series.describe().round(2)
        lines += [f"- Mean: {desc['mean']}", f"- Std: {desc['std']}", f"- Min: {desc['min']}", f"- Max: {desc['max']}"]
        chart = _histogram_chart(series.dropna(), f"Distribution of {col}", col)
    else:
        vc = series.value_counts().head(5)
        lines.append("- Top values: " + ", ".join([f"{k} ({v})" for k, v in vc.items()]))
        chart = _bar_chart(vc, f"Top values of {col}", col, "Count")

    return {"answer": "\n".join(lines), "chart": chart}


def _bar_chart(series, title, x_label, y_label):
    return {"data": [{"x": [str(x) for x in series.index.tolist()], "y": series.values.tolist(), "type": "bar", "marker": {"color": "#C9A76A"}}],
            "layout": {"title": title, "xaxis": {"title": x_label}, "yaxis": {"title": y_label}}}


def _histogram_chart(series, title, col):
    return {"data": [{"x": series.tolist(), "type": "histogram", "marker": {"color": "#C9A76A"}, "nbinsx": 30}],
            "layout": {"title": title, "xaxis": {"title": col}, "yaxis": {"title": "Frequency"}}}


def _line_chart(series, title, col):
    return {"data": [{"y": series.tolist(), "type": "scatter", "mode": "lines", "line": {"color": "#C9A76A"}}],
            "layout": {"title": title, "yaxis": {"title": col}}}


def _box_chart(series, title, col):
    return {"data": [{"y": series.tolist(), "type": "box", "marker": {"color": "#C9A76A"}, "name": col}],
            "layout": {"title": title}}


def _safe(v):
    if isinstance(v, (np.integer,)): return int(v)
    if isinstance(v, (np.floating,)): return round(float(v), 4)
    if pd.isna(v): return None
    return v
