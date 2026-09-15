"""
ML Engine — Local machine learning features that run without any API calls.
Implements: Anomaly Detection, Clustering, Forecasting, Feature Importance, Data Cleaning.
"""

import numpy as np
import pandas as pd
from scipy import stats as scipy_stats


def detect_anomalies(df: pd.DataFrame) -> dict:
    """
    Detect anomalies using Z-score and IQR methods on numeric columns.
    Returns flagged rows and per-column anomaly stats.
    """
    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    if not numeric_cols:
        return {"anomalies": [], "column_stats": {}, "total_anomalous_rows": 0}

    anomaly_mask = pd.DataFrame(False, index=df.index, columns=numeric_cols)
    column_stats = {}

    for col in numeric_cols:
        series = df[col].dropna()
        if len(series) < 10:
            continue

        # Z-score method
        z_scores = np.abs(scipy_stats.zscore(series, nan_policy='omit'))
        z_outliers = z_scores > 3

        # IQR method
        q1 = series.quantile(0.25)
        q3 = series.quantile(0.75)
        iqr = q3 - q1
        lower = q1 - 1.5 * iqr
        upper = q3 + 1.5 * iqr
        iqr_outliers = (series < lower) | (series > upper)

        # Combine: flagged by EITHER method
        combined = z_outliers | iqr_outliers
        anomaly_mask.loc[series.index, col] = combined

        n_anomalies = int(combined.sum())
        column_stats[col] = {
            "anomaly_count": n_anomalies,
            "anomaly_pct": round(n_anomalies / len(series) * 100, 1),
            "lower_bound": round(float(lower), 2),
            "upper_bound": round(float(upper), 2),
            "mean": round(float(series.mean()), 2),
            "std": round(float(series.std()), 2),
        }

    # Rows with ANY anomaly
    row_has_anomaly = anomaly_mask.any(axis=1)
    anomalous_indices = df.index[row_has_anomaly].tolist()[:100]  # Cap at 100

    # Build flagged rows detail
    anomalies = []
    for idx in anomalous_indices[:50]:
        flagged_cols = anomaly_mask.columns[anomaly_mask.loc[idx]].tolist()
        anomalies.append({
            "row_index": int(idx),
            "flagged_columns": flagged_cols,
            "values": {col: _safe_val(df.at[idx, col]) for col in flagged_cols},
        })

    return {
        "anomalies": anomalies,
        "column_stats": column_stats,
        "total_anomalous_rows": int(row_has_anomaly.sum()),
        "total_rows": len(df),
        "method": "Z-Score (|z| > 3) + IQR (1.5×IQR)",
    }


def cluster_data(df: pd.DataFrame, columns: list = None, n_clusters: int = 3) -> dict:
    """
    K-Means clustering on selected numeric columns.
    Returns cluster labels, centroids, and scatter data for visualization.
    """
    from sklearn.cluster import KMeans
    from sklearn.preprocessing import StandardScaler

    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    if columns:
        use_cols = [c for c in columns if c in numeric_cols]
    else:
        use_cols = numeric_cols[:5]  # Auto-pick first 5

    if len(use_cols) < 2:
        return {"error": "Need at least 2 numeric columns for clustering"}

    subset = df[use_cols].dropna()
    if len(subset) < n_clusters:
        return {"error": f"Not enough data rows ({len(subset)}) for {n_clusters} clusters"}

    # Standardize
    scaler = StandardScaler()
    scaled = scaler.fit_transform(subset)

    # K-Means
    n_clusters = min(n_clusters, len(subset))
    kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
    labels = kmeans.fit_predict(scaled)

    # Inertia for elbow info
    inertia = float(kmeans.inertia_)

    # Cluster summary
    cluster_summary = []
    for i in range(n_clusters):
        mask = labels == i
        cluster_data = subset[mask]
        summary = {"cluster": i, "size": int(mask.sum())}
        for col in use_cols:
            summary[f"{col}_mean"] = round(float(cluster_data[col].mean()), 2)
        cluster_summary.append(summary)

    # Scatter data for first 2 columns
    x_col, y_col = use_cols[0], use_cols[1]
    scatter_data = {
        "x": subset[x_col].tolist()[:500],
        "y": subset[y_col].tolist()[:500],
        "labels": labels.tolist()[:500],
        "x_label": x_col,
        "y_label": y_col,
    }

    return {
        "n_clusters": n_clusters,
        "columns_used": use_cols,
        "cluster_summary": cluster_summary,
        "scatter_data": scatter_data,
        "inertia": round(inertia, 2),
        "total_points": len(subset),
        "method": "K-Means Clustering (StandardScaler + KMeans)",
    }


def forecast_timeseries(df: pd.DataFrame, date_col: str = None, value_col: str = None, periods: int = 10) -> dict:
    """
    Simple time series forecasting using linear regression + moving average.
    Auto-detects date and value columns if not specified.
    Falls back to index-based trend analysis if no date column exists.
    """
    from sklearn.linear_model import LinearRegression

    use_index = False

    # Auto-detect date column
    if not date_col:
        for col in df.columns:
            if pd.api.types.is_datetime64_any_dtype(df[col]):
                date_col = col
                break
        if not date_col:
            for col in df.columns:
                try:
                    parsed = pd.to_datetime(df[col], errors='coerce')
                    if parsed.notna().sum() > len(df) * 0.7:
                        date_col = col
                        df[col] = parsed
                        break
                except:
                    continue

    if not date_col:
        use_index = True

    # Auto-detect value column
    if not value_col:
        numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
        if not numeric_cols:
            return {"error": "No numeric column found for forecasting"}
        value_col = numeric_cols[0]

    # Prepare data
    if use_index:
        values = df[value_col].dropna().values.astype(float)
        if len(values) < 5:
            return {"error": "Not enough data points for forecasting (need 5+)"}
        historical_dates = list(range(len(values)))
        x_label = "Row Index"
    else:
        ts = df[[date_col, value_col]].dropna()
        ts = ts.sort_values(date_col)
        ts[date_col] = pd.to_datetime(ts[date_col], errors='coerce')
        ts = ts.dropna()
        if len(ts) < 5:
            return {"error": "Not enough data points for forecasting (need 5+)"}
        values = ts[value_col].values.astype(float)
        dates = ts[date_col].values
        historical_dates = [pd.Timestamp(d).isoformat() for d in dates]
        x_label = date_col

    # Feature: numeric index
    X = np.arange(len(values)).reshape(-1, 1)

    # Linear Regression
    lr = LinearRegression()
    lr.fit(X, values)
    trend_line = lr.predict(X).tolist()

    # Moving Average (window = min(7, len/3))
    window = max(3, min(7, len(values) // 3))
    ma = pd.Series(values).rolling(window=window, center=False).mean().tolist()

    # Forecast next N periods
    future_X = np.arange(len(values), len(values) + periods).reshape(-1, 1)
    forecast_values = lr.predict(future_X).tolist()

    # Generate future labels
    if use_index:
        future_dates = list(range(len(values), len(values) + periods))
    else:
        last_date = pd.Timestamp(dates[-1])
        if len(dates) > 1:
            avg_delta = (pd.Timestamp(dates[-1]) - pd.Timestamp(dates[0])) / (len(dates) - 1)
        else:
            avg_delta = pd.Timedelta(days=1)
        future_dates = [(last_date + avg_delta * (i + 1)).isoformat() for i in range(periods)]

    return {
        "date_col": date_col or "Row Index",
        "value_col": value_col,
        "historical_dates": historical_dates,
        "historical_values": values.tolist(),
        "trend_line": trend_line,
        "moving_average": ma,
        "ma_window": window,
        "forecast_dates": future_dates,
        "forecast_values": forecast_values,
        "slope": round(float(lr.coef_[0]), 4),
        "r_squared": round(float(lr.score(X, values)), 4),
        "method": f"Linear Regression (R²={round(float(lr.score(X, values)), 3)}) + Moving Average (window={window})",
    }


def compute_feature_importance(df: pd.DataFrame, target_col: str = None) -> dict:
    """
    Compute feature importance using correlation + mutual information.
    If no target, returns inter-feature correlation ranking.
    """
    from sklearn.feature_selection import mutual_info_regression, mutual_info_classif
    from sklearn.preprocessing import LabelEncoder

    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()

    # Auto-pick target: first numeric column with most variance
    if not target_col:
        if len(numeric_cols) >= 2:
            variances = {c: df[c].var() for c in numeric_cols}
            target_col = max(variances, key=variances.get)
        else:
            return {"error": "Need at least 2 numeric columns"}

    if target_col not in df.columns:
        return {"error": f"Column '{target_col}' not found"}

    feature_cols = [c for c in numeric_cols if c != target_col]
    if not feature_cols:
        return {"error": "Need at least 1 feature column besides target"}

    # Correlation-based importance
    correlations = {}
    for col in feature_cols:
        corr = df[[col, target_col]].dropna().corr().iloc[0, 1]
        correlations[col] = round(abs(float(corr)) if not np.isnan(corr) else 0, 4)

    # Mutual Information
    mi_scores = {}
    subset = df[feature_cols + [target_col]].dropna()
    if len(subset) > 10:
        try:
            X = subset[feature_cols].values
            y = subset[target_col].values
            mi = mutual_info_regression(X, y, random_state=42)
            for col, score in zip(feature_cols, mi):
                mi_scores[col] = round(float(score), 4)
        except:
            pass

    # Combined ranking
    rankings = []
    for col in feature_cols:
        corr_score = correlations.get(col, 0)
        mi_score = mi_scores.get(col, 0)
        # Normalize MI to 0-1 range for combination
        max_mi = max(mi_scores.values()) if mi_scores else 1
        mi_norm = mi_score / max_mi if max_mi > 0 else 0
        combined = round((corr_score + mi_norm) / 2, 4)
        rankings.append({
            "feature": col,
            "correlation": corr_score,
            "mutual_info": mi_score,
            "combined_score": combined,
        })

    rankings.sort(key=lambda x: x["combined_score"], reverse=True)

    return {
        "target_column": target_col,
        "rankings": rankings,
        "method": "Pearson Correlation + Mutual Information Regression",
    }


def suggest_cleaning(df: pd.DataFrame) -> dict:
    """
    Analyze data quality and suggest cleaning actions.
    """
    suggestions = []
    summary = {
        "total_rows": len(df),
        "total_cols": len(df.columns),
        "total_missing": int(df.isnull().sum().sum()),
        "total_duplicates": int(df.duplicated().sum()),
    }

    # 1. Missing values
    missing = df.isnull().sum()
    for col in missing[missing > 0].index:
        count = int(missing[col])
        pct = round(count / len(df) * 100, 1)
        dtype = str(df[col].dtype)

        if pct > 50:
            action = "Consider dropping this column"
            severity = "high"
        elif 'float' in dtype or 'int' in dtype:
            median_val = round(float(df[col].median()), 2) if df[col].notna().any() else 0
            action = f"Fill with median ({median_val})"
            severity = "medium"
        else:
            mode_val = df[col].mode().iloc[0] if len(df[col].mode()) > 0 else "N/A"
            action = f"Fill with mode ('{mode_val}')"
            severity = "medium"

        suggestions.append({
            "type": "missing_values",
            "column": col,
            "issue": f"{count} missing values ({pct}%)",
            "suggestion": action,
            "severity": severity,
        })

    # 2. Duplicate rows
    n_dupes = int(df.duplicated().sum())
    if n_dupes > 0:
        suggestions.append({
            "type": "duplicates",
            "column": "all",
            "issue": f"{n_dupes} duplicate rows ({round(n_dupes/len(df)*100, 1)}%)",
            "suggestion": "Remove duplicate rows",
            "severity": "medium",
        })

    # 3. Constant columns (zero variance)
    for col in df.columns:
        if df[col].nunique() <= 1:
            suggestions.append({
                "type": "constant_column",
                "column": col,
                "issue": "Column has only 1 unique value (zero variance)",
                "suggestion": "Drop this column — adds no information",
                "severity": "low",
            })

    # 4. High cardinality categorical
    cat_cols = df.select_dtypes(include=['object']).columns
    for col in cat_cols:
        n_unique = df[col].nunique()
        if n_unique > len(df) * 0.5 and n_unique > 50:
            suggestions.append({
                "type": "high_cardinality",
                "column": col,
                "issue": f"{n_unique} unique values (likely an ID column)",
                "suggestion": "Consider dropping — too many categories for analysis",
                "severity": "low",
            })

    # 5. Outliers in numeric columns
    numeric_cols = df.select_dtypes(include=[np.number]).columns
    for col in numeric_cols:
        series = df[col].dropna()
        if len(series) < 10:
            continue
        q1 = series.quantile(0.25)
        q3 = series.quantile(0.75)
        iqr = q3 - q1
        n_outliers = int(((series < q1 - 1.5 * iqr) | (series > q3 + 1.5 * iqr)).sum())
        if n_outliers > 0:
            pct = round(n_outliers / len(series) * 100, 1)
            suggestions.append({
                "type": "outliers",
                "column": col,
                "issue": f"{n_outliers} outliers detected ({pct}%)",
                "suggestion": f"Cap values to [{round(float(q1-1.5*iqr),2)}, {round(float(q3+1.5*iqr),2)}] or investigate",
                "severity": "medium" if pct > 5 else "low",
            })

    # 6. Potential type mismatches
    for col in df.select_dtypes(include=['object']).columns:
        sample = df[col].dropna().head(100)
        numeric_count = sum(1 for v in sample if _is_numeric_str(str(v)))
        if numeric_count > len(sample) * 0.8 and len(sample) > 5:
            suggestions.append({
                "type": "type_mismatch",
                "column": col,
                "issue": f"Stored as text but {round(numeric_count/len(sample)*100)}% values are numeric",
                "suggestion": "Convert to numeric type",
                "severity": "medium",
            })

    # Sort by severity
    severity_order = {"high": 0, "medium": 1, "low": 2}
    suggestions.sort(key=lambda x: severity_order.get(x["severity"], 3))

    # Data quality score
    issues_score = len([s for s in suggestions if s["severity"] == "high"]) * 15 + \
                   len([s for s in suggestions if s["severity"] == "medium"]) * 5 + \
                   len([s for s in suggestions if s["severity"] == "low"]) * 1
    quality_score = max(0, min(100, 100 - issues_score))

    return {
        "suggestions": suggestions,
        "summary": summary,
        "quality_score": quality_score,
        "method": "Statistical analysis: missing values, duplicates, outliers (IQR), cardinality, type inference",
    }


def _safe_val(v):
    """Convert value to JSON-safe format."""
    if pd.isna(v):
        return None
    if isinstance(v, (np.integer,)):
        return int(v)
    if isinstance(v, (np.floating,)):
        return round(float(v), 4)
    return v


def _is_numeric_str(s: str) -> bool:
    """Check if a string looks numeric."""
    try:
        float(s.replace(',', ''))
        return True
    except:
        return False


def run_pca(df: pd.DataFrame, n_components: int = 2) -> dict:
    """
    Principal Component Analysis for dimensionality reduction.
    """
    from sklearn.decomposition import PCA
    from sklearn.preprocessing import StandardScaler

    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    if len(numeric_cols) < 2:
        return {"error": "Need at least 2 numeric columns for PCA"}

    subset = df[numeric_cols].dropna()
    if len(subset) < 5:
        return {"error": "Not enough data points for PCA"}

    n_components = min(n_components, len(numeric_cols), len(subset))

    scaler = StandardScaler()
    scaled = scaler.fit_transform(subset)

    pca = PCA(n_components=n_components)
    transformed = pca.fit_transform(scaled)

    explained = pca.explained_variance_ratio_
    loadings = pca.components_

    # Top contributing features per component
    component_features = []
    for i in range(n_components):
        abs_loadings = np.abs(loadings[i])
        top_indices = abs_loadings.argsort()[::-1][:5]
        features = [
            {"feature": numeric_cols[idx], "loading": round(float(loadings[i][idx]), 4)}
            for idx in top_indices
        ]
        component_features.append({
            "component": i + 1,
            "explained_variance": round(float(explained[i]) * 100, 2),
            "top_features": features,
        })

    scatter = {
        "x": transformed[:, 0].tolist()[:500],
        "y": transformed[:, 1].tolist()[:500] if n_components >= 2 else [0] * min(500, len(transformed)),
    }

    return {
        "n_components": n_components,
        "total_explained_variance": round(float(sum(explained)) * 100, 2),
        "components": component_features,
        "scatter_data": scatter,
        "n_features": len(numeric_cols),
        "features_used": numeric_cols,
        "method": f"PCA ({n_components} components, StandardScaler)",
    }


def auto_ml(df: pd.DataFrame, target_col: str = None) -> dict:
    """
    Auto ML — trains multiple models and compares performance.
    Auto-detects classification vs regression based on target column.
    """
    from sklearn.model_selection import train_test_split
    from sklearn.preprocessing import StandardScaler, LabelEncoder
    from sklearn.linear_model import LinearRegression, LogisticRegression
    from sklearn.tree import DecisionTreeClassifier, DecisionTreeRegressor
    from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
    from sklearn.neighbors import KNeighborsClassifier, KNeighborsRegressor
    from sklearn.metrics import accuracy_score, f1_score, mean_squared_error, r2_score

    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()

    if not target_col:
        if numeric_cols:
            target_col = numeric_cols[-1]
        else:
            return {"error": "No suitable target column found"}

    if target_col not in df.columns:
        return {"error": f"Column '{target_col}' not found"}

    feature_cols = [c for c in numeric_cols if c != target_col]
    if not feature_cols:
        return {"error": "Need at least 1 numeric feature column"}

    subset = df[feature_cols + [target_col]].dropna()
    if len(subset) < 20:
        return {"error": f"Not enough clean data rows ({len(subset)}), need 20+"}

    X = subset[feature_cols].values
    y = subset[target_col].values

    # Determine task type
    n_unique = len(np.unique(y))
    is_classification = n_unique <= 20 and (not np.issubdtype(type(y[0]), np.floating) or n_unique <= 10)

    # Scale features
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    # Split
    test_size = min(0.2, max(0.1, 10 / len(subset)))
    X_train, X_test, y_train, y_test = train_test_split(X_scaled, y, test_size=test_size, random_state=42)

    results = []

    if is_classification:
        le = LabelEncoder()
        y_train_enc = le.fit_transform(y_train.astype(str))
        y_test_enc = le.transform(y_test.astype(str))

        models = [
            ("Logistic Regression", LogisticRegression(max_iter=500, random_state=42)),
            ("Decision Tree", DecisionTreeClassifier(max_depth=10, random_state=42)),
            ("Random Forest", RandomForestClassifier(n_estimators=50, max_depth=10, random_state=42)),
            ("K-Nearest Neighbors", KNeighborsClassifier(n_neighbors=min(5, len(X_train)))),
        ]

        for name, model in models:
            try:
                model.fit(X_train, y_train_enc)
                y_pred = model.predict(X_test)
                acc = round(accuracy_score(y_test_enc, y_pred) * 100, 2)
                f1 = round(f1_score(y_test_enc, y_pred, average='weighted', zero_division=0) * 100, 2)
                results.append({"model": name, "accuracy": acc, "f1_score": f1})
            except Exception as e:
                results.append({"model": name, "accuracy": 0, "f1_score": 0, "error": str(e)})

        results.sort(key=lambda x: x.get("accuracy", 0), reverse=True)
        best = results[0]
        task_type = "Classification"
        metric_name = "Accuracy"
    else:
        models = [
            ("Linear Regression", LinearRegression()),
            ("Decision Tree", DecisionTreeRegressor(max_depth=10, random_state=42)),
            ("Random Forest", RandomForestRegressor(n_estimators=50, max_depth=10, random_state=42)),
            ("K-Nearest Neighbors", KNeighborsRegressor(n_neighbors=min(5, len(X_train)))),
        ]

        for name, model in models:
            try:
                model.fit(X_train, y_train)
                y_pred = model.predict(X_test)
                r2 = round(r2_score(y_test, y_pred) * 100, 2)
                rmse = round(float(np.sqrt(mean_squared_error(y_test, y_pred))), 4)
                results.append({"model": name, "r2_score": r2, "rmse": rmse})
            except Exception as e:
                results.append({"model": name, "r2_score": 0, "rmse": 0, "error": str(e)})

        results.sort(key=lambda x: x.get("r2_score", 0), reverse=True)
        best = results[0]
        task_type = "Regression"
        metric_name = "R² Score"

    return {
        "task_type": task_type,
        "target_column": target_col,
        "feature_columns": feature_cols,
        "n_features": len(feature_cols),
        "train_size": len(X_train),
        "test_size": len(X_test),
        "results": results,
        "best_model": best["model"],
        "metric_name": metric_name,
        "method": f"Auto ML — {task_type} with StandardScaler + 80/20 split",
    }


def correlation_heatmap(df: pd.DataFrame) -> dict:
    """
    Generate correlation matrix data for a heatmap visualization.
    """
    numeric_cols = df.select_dtypes(include=[np.number]).columns.tolist()
    if len(numeric_cols) < 2:
        return {"error": "Need at least 2 numeric columns"}

    # Cap at 20 columns for readability
    use_cols = numeric_cols[:20]
    corr = df[use_cols].corr().round(4)

    # Convert to list of lists for Plotly heatmap
    z = corr.values.tolist()
    labels = use_cols

    # Find strongest correlations
    pairs = []
    for i in range(len(use_cols)):
        for j in range(i + 1, len(use_cols)):
            pairs.append({
                "col1": use_cols[i],
                "col2": use_cols[j],
                "correlation": round(float(corr.iloc[i, j]), 4),
            })
    pairs.sort(key=lambda x: abs(x["correlation"]), reverse=True)

    return {
        "labels": labels,
        "matrix": z,
        "top_pairs": pairs[:10],
        "n_features": len(use_cols),
        "method": "Pearson Correlation Matrix",
    }
