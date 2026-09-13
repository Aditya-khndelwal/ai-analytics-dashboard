"""
Local Narrative Generator — Generates AI-like insights using pure statistics.
No external API calls. Replaces Gemini for narrative generation.
"""

import numpy as np
import pandas as pd
from scipy import stats as scipy_stats


def generate_local_narrative(df: pd.DataFrame, stats: dict) -> dict:
    """
    Generate a comprehensive narrative from statistical analysis.
    Returns the same format as the Gemini narrator for drop-in replacement.
    """
    summary = stats.get('summary', {})
    correlations = stats.get('top_correlations', [])
    distributions = stats.get('distributions', {})

    row_count = len(df)
    col_count = len(df.columns)
    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    cat_cols = df.select_dtypes(include=['object', 'category']).columns.tolist()
    missing_pct = round(df.isnull().sum().sum() / (row_count * col_count) * 100, 1) if row_count * col_count > 0 else 0

    # ── Executive Summary ──
    exec_parts = [
        f"This dataset contains {row_count:,} records across {col_count} columns",
        f"({len(numeric_cols)} numeric, {len(cat_cols)} categorical).",
    ]

    if missing_pct > 0:
        exec_parts.append(f"Data completeness is {100 - missing_pct:.1f}% with {missing_pct}% missing values.")
    else:
        exec_parts.append("The dataset is fully complete with no missing values.")

    # Key numeric insights
    if numeric_cols:
        highest_var_col = max(numeric_cols, key=lambda c: df[c].var() if df[c].notna().any() else 0)
        exec_parts.append(
            f"The most variable feature is '{highest_var_col}' "
            f"(std={df[highest_var_col].std():.2f}, range={df[highest_var_col].min():.2f}–{df[highest_var_col].max():.2f})."
        )

    if correlations:
        top_corr = correlations[0]
        exec_parts.append(
            f"The strongest correlation found is between '{top_corr.get('col1', '')}' and "
            f"'{top_corr.get('col2', '')}' (r={top_corr.get('correlation', 0):.3f})."
        )

    executive_summary = " ".join(exec_parts)

    # ── Key Findings ──
    key_findings = []

    # Finding 1: Distribution shape
    for col in numeric_cols[:3]:
        series = df[col].dropna()
        if len(series) < 10:
            continue
        skew = series.skew()
        kurt = series.kurtosis()
        if abs(skew) > 1:
            direction = "right-skewed" if skew > 0 else "left-skewed"
            key_findings.append(
                f"'{col}' shows a {direction} distribution (skewness={skew:.2f}), "
                f"suggesting the presence of {'high' if skew > 0 else 'low'} outliers."
            )
        elif abs(kurt) > 3:
            key_findings.append(
                f"'{col}' has heavy tails (kurtosis={kurt:.2f}), indicating more extreme values than a normal distribution."
            )

    # Finding 2: Correlations
    if len(correlations) >= 2:
        pos_corrs = [c for c in correlations if c.get('correlation', 0) > 0.5]
        neg_corrs = [c for c in correlations if c.get('correlation', 0) < -0.5]
        if pos_corrs:
            key_findings.append(
                f"Found {len(pos_corrs)} strong positive correlation(s). "
                f"As '{pos_corrs[0]['col1']}' increases, '{pos_corrs[0]['col2']}' tends to increase as well."
            )
        if neg_corrs:
            key_findings.append(
                f"Found {len(neg_corrs)} strong negative correlation(s). "
                f"'{neg_corrs[0]['col1']}' and '{neg_corrs[0]['col2']}' move in opposite directions."
            )

    # Finding 3: Categorical insights
    for col in cat_cols[:2]:
        vc = df[col].value_counts()
        if len(vc) > 0:
            top_val = vc.index[0]
            top_pct = round(vc.iloc[0] / len(df) * 100, 1)
            n_unique = len(vc)
            key_findings.append(
                f"'{col}' has {n_unique} unique values. "
                f"The most common is '{top_val}' ({top_pct}% of records)."
            )

    # Finding 4: Missing data patterns
    missing_cols = df.isnull().sum()
    high_missing = missing_cols[missing_cols > row_count * 0.1]
    if len(high_missing) > 0:
        cols_str = ", ".join([f"'{c}' ({round(v/row_count*100, 1)}%)" for c, v in high_missing.items()][:3])
        key_findings.append(f"Columns with notable missing data: {cols_str}. Consider imputation or investigation.")

    # Finding 5: Outlier detection
    for col in numeric_cols[:3]:
        series = df[col].dropna()
        if len(series) < 20:
            continue
        q1, q3 = series.quantile(0.25), series.quantile(0.75)
        iqr = q3 - q1
        n_outliers = ((series < q1 - 1.5 * iqr) | (series > q3 + 1.5 * iqr)).sum()
        if n_outliers > 0:
            pct = round(n_outliers / len(series) * 100, 1)
            key_findings.append(f"'{col}' contains {n_outliers} statistical outliers ({pct}% of values) using IQR method.")
            break  # Only report first

    if not key_findings:
        key_findings.append("The dataset appears well-structured with no major anomalies detected.")

    # ── Column Insights ──
    column_insights = []
    for col in df.columns[:10]:
        insight = _generate_column_insight(df, col)
        if insight:
            column_insights.append(insight)

    return {
        "executive_summary": executive_summary,
        "key_findings": key_findings[:6],
        "column_insights": column_insights,
    }


def _generate_column_insight(df: pd.DataFrame, col: str) -> dict:
    """Generate insight for a single column."""
    series = df[col]
    n_missing = int(series.isnull().sum())
    n_unique = series.nunique()

    if pd.api.types.is_numeric_dtype(series):
        clean = series.dropna()
        if len(clean) == 0:
            return None

        mean_val = clean.mean()
        median_val = clean.median()
        std_val = clean.std()
        skew = clean.skew()

        # Determine distribution type
        if abs(skew) < 0.5:
            dist_desc = "approximately normally distributed"
        elif skew > 0:
            dist_desc = "right-skewed (tail extends to higher values)"
        else:
            dist_desc = "left-skewed (tail extends to lower values)"

        insight_text = (
            f"Ranges from {clean.min():.2f} to {clean.max():.2f} "
            f"with a mean of {mean_val:.2f} (±{std_val:.2f}). "
            f"The distribution is {dist_desc}."
        )

        if abs(mean_val - median_val) > std_val * 0.5:
            insight_text += f" Notable gap between mean ({mean_val:.2f}) and median ({median_val:.2f}) suggests outlier influence."

        return {"column": col, "type": "numeric", "insight": insight_text}

    else:
        vc = series.value_counts()
        if len(vc) == 0:
            return None

        top = vc.head(3)
        top_str = ", ".join([f"'{k}' ({v})" for k, v in top.items()])

        if n_unique == 2:
            insight_text = f"Binary column with values: {top_str}."
        elif n_unique <= 10:
            insight_text = f"Categorical with {n_unique} unique values. Top: {top_str}."
        else:
            insight_text = f"High cardinality with {n_unique} unique values. Most common: {top_str}."

        if n_missing > 0:
            insight_text += f" Has {n_missing} missing values ({round(n_missing/len(df)*100, 1)}%)."

        return {"column": col, "type": "categorical", "insight": insight_text}
