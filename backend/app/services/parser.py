import pandas as pd
import numpy as np
from pandas.errors import ParserError
from typing import Dict, Any

def parse_file(filepath: str) -> Dict[str, Any]:
    """
    Parses a CSV or Excel file, infers column types, and returns the dataframe and schema.
    """
    try:
        if filepath.endswith('.csv'):
            try:
                df = pd.read_csv(filepath, encoding='utf-8')
            except UnicodeDecodeError:
                df = pd.read_csv(filepath, encoding='latin-1')
        elif filepath.endswith('.xlsx'):
            df = pd.read_excel(filepath, engine='openpyxl')
        else:
            raise ValueError("Unsupported file format. Please upload a .csv or .xlsx file.")
    except Exception as e:
        raise ValueError(f"Error reading file: {str(e)}")

    # Strip whitespace from column names
    df.columns = df.columns.str.strip()

    row_count, col_count = df.shape
    schema = []

    for col in df.columns:
        dtype = str(df[col].dtype)
        unique_count = df[col].nunique()
        null_count = int(df[col].isnull().sum())
        null_pct = round((null_count / row_count) * 100, 2) if row_count > 0 else 0.0
        
        # Sample values (drop NAs)
        sample_values = df[col].dropna().head(5).tolist()

        # Infer Type
        inferred_type = 'text'
        if pd.api.types.is_numeric_dtype(df[col]):
            inferred_type = 'numeric'
        elif pd.api.types.is_datetime64_any_dtype(df[col]):
            inferred_type = 'datetime'
        elif pd.api.types.is_string_dtype(df[col]) or isinstance(df[col].dtype, pd.CategoricalDtype):
            # Try to convert to datetime first if it looks like dates
            try:
                pd.to_datetime(df[col].dropna().head(20), errors='raise')
                inferred_type = 'datetime'
                df[col] = pd.to_datetime(df[col], errors='coerce')
            except (ValueError, TypeError, ParserError):
                if unique_count <= 50:
                    inferred_type = 'categorical'
                else:
                    inferred_type = 'text'

        schema.append({
            'name': col,
            'dtype': dtype,
            'inferred_type': inferred_type,
            'null_count': null_count,
            'null_pct': null_pct,
            'unique_count': unique_count,
            'sample_values': sample_values
        })

    return {
        'dataframe': df,
        'schema': schema,
        'row_count': row_count,
        'col_count': col_count
    }
