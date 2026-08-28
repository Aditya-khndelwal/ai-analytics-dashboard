import pandas as pd
import numpy as np
from scipy import stats
from typing import List, Dict, Any

def convert_type(obj: Any) -> Any:
    """Converts numpy data types to Python native types for JSON serialization."""
    if isinstance(obj, np.integer):
        return int(obj)
    elif isinstance(obj, np.floating):
        if np.isnan(obj) or np.isinf(obj):
            return None
        return round(float(obj), 4)
    elif isinstance(obj, np.bool_):
        return bool(obj)
    elif isinstance(obj, np.ndarray):
        return [convert_type(x) for x in obj]
    elif isinstance(obj, pd.Timestamp):
        return str(obj)
    return obj

def analyze_dataframe(df: pd.DataFrame, schema: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Computes full analytics on the provided dataframe."""
    numeric_cols = [s['name'] for s in schema if s['inferred_type'] == 'numeric']
    categorical_cols = [s['name'] for s in schema if s['inferred_type'] == 'categorical']
    datetime_cols = [s['name'] for s in schema if s['inferred_type'] == 'datetime']

    results: Dict[str, Any] = {
        'descriptive_stats': {},
        'column_distributions': {},
        'correlation_matrix': {},
        'top_correlations': [],
        'outliers': [],
        'trends': [],
        'missing_data': [],
        'summary': {}
    }

    total_rows = len(df)
    total_cols = len(df.columns)
    total_missing = int(df.isnull().sum().sum())
    total_cells = total_rows * total_cols
    total_missing_pct = round((total_missing / total_cells) * 100, 2) if total_cells > 0 else 0

    results['summary'] = {
        'total_rows': total_rows,
        'total_cols': total_cols,
        'numeric_cols': len(numeric_cols),
        'categorical_cols': len(categorical_cols),
        'datetime_cols': len(datetime_cols),
        'total_missing': total_missing,
        'total_missing_pct': total_missing_pct
    }

    # Missing Data per column
    for col in df.columns:
        nc = int(df[col].isnull().sum())
        results['missing_data'].append({
            'column': col,
            'null_count': nc,
            'null_percentage': round((nc / total_rows) * 100, 2) if total_rows > 0 else 0
        })

    # Descriptive Stats and Outliers
    for col in numeric_cols:
        series = df[col].dropna()
        if len(series) == 0:
            continue
            
        desc = series.describe()
        q1 = desc.get('25%', 0)
        q3 = desc.get('75%', 0)
        iqr = q3 - q1
        
        results['descriptive_stats'][col] = {
            'mean': convert_type(desc.get('mean', 0)),
            'median': convert_type(series.median()),
            'std': convert_type(desc.get('std', 0)),
            'min': convert_type(desc.get('min', 0)),
            'max': convert_type(desc.get('max', 0)),
            'q1': convert_type(q1),
            'q3': convert_type(q3),
            'skewness': convert_type(series.skew())
        }
        
        # Outliers (IQR method)
        lower_bound = q1 - 1.5 * iqr
        upper_bound = q3 + 1.5 * iqr
        outliers = df[(df[col] < lower_bound) | (df[col] > upper_bound)]
        outlier_count = len(outliers)
        
        if outlier_count > 0:
            examples = outliers.head(5)[col].to_dict()
            results['outliers'].append({
                'column': col,
                'count': outlier_count,
                'percentage': round((outlier_count / total_rows) * 100, 2),
                'examples': [{'row_index': k, 'value': convert_type(v)} for k, v in examples.items()]
            })
            
        # Distribution (Histogram)
        counts, edges = np.histogram(series, bins=min(10, len(series.unique())))
        results['column_distributions'][col] = {
            'type': 'histogram',
            'counts': convert_type(counts),
            'edges': convert_type(edges)
        }

    # Categorical Distributions
    for col in categorical_cols:
        val_counts = df[col].value_counts().head(10).to_dict()
        results['column_distributions'][col] = {
            'type': 'categorical',
            'value_counts': {str(k): convert_type(v) for k, v in val_counts.items()}
        }

    # Correlation
    if len(numeric_cols) > 1:
        corr_df = df[numeric_cols].corr()
        results['correlation_matrix'] = corr_df.fillna(0).to_dict()
        
        # Top correlations
        corr_pairs = []
        for i in range(len(corr_df.columns)):
            for j in range(i+1, len(corr_df.columns)):
                c1, c2 = corr_df.columns[i], corr_df.columns[j]
                val = corr_df.iloc[i, j]
                if pd.notna(val):
                    corr_pairs.append({
                        'col1': c1,
                        'col2': c2,
                        'correlation': convert_type(val),
                        'abs_corr': abs(val)
                    })
        corr_pairs.sort(key=lambda x: x['abs_corr'], reverse=True)
        top_10 = corr_pairs[:10]
        for pair in top_10:
            del pair['abs_corr']
        results['top_correlations'] = top_10

    # Trends (Time series)
    if datetime_cols and numeric_cols:
        for dt_col in datetime_cols:
            for num_col in numeric_cols:
                valid_data = df[[dt_col, num_col]].dropna()
                if len(valid_data) > 1:
                    # Convert dates to ordinal for regression
                    x = valid_data[dt_col].map(pd.Timestamp.toordinal)
                    y = valid_data[num_col]
                    
                    if len(x.unique()) > 1:
                        slope, intercept, r_value, p_value, std_err = stats.linregress(x, y)
                        direction = 'stable'
                        if slope > 0.001: direction = 'increasing'
                        elif slope < -0.001: direction = 'decreasing'
                        
                        results['trends'].append({
                            'column': num_col,
                            'time_column': dt_col,
                            'slope': convert_type(slope),
                            'r_squared': convert_type(r_value**2),
                            'direction': direction
                        })

    return results
