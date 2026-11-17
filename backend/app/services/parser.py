import re
import pandas as pd
import numpy as np
from pandas.errors import ParserError
from typing import Dict, Any

def is_id_column(col_name: str, series: pd.Series, total_rows: int) -> bool:
    """
    Detects if a column is an ID, Key, Roll Number, or Identifier.
    Excludes it from being treated as continuous numeric features.
    """
    clean_name = re.sub(r'[^a-zA-Z0-9]', ' ', col_name.lower()).strip()
    words = clean_name.split()

    # Exact keywords or word in column name
    id_keywords = {
        'id', 'roll', 'rollno', 'serial', 'sno', 'srno', 'regno',
        'registration', 'uuid', 'guid', 'ssn', 'pin', 'zip', 'zipcode', 'mobile', 'phone'
    }
    if clean_name in id_keywords or any(w in id_keywords for w in words):
        return True

    # Multi-word patterns
    if any(p in clean_name for p in ['roll no', 'roll_no', 'sr no', 'sr_no', 's no', 's_no', 'reg no', 'reg_no', 'student id', 'emp id', 'employee id']):
        return True

    # Suffix checks (e.g. employee_id, order_id, user_no)
    if clean_name.endswith(' id') or clean_name.endswith('_id') or clean_name.startswith('id '):
        return True

    if any(clean_name.endswith(sfx) for sfx in [' no', '_no', ' num', '_num', ' number', '_number']):
        # If unique ratio is substantial, it's an ID
        if series.nunique() / max(1, total_rows) > 0.5:
            return True

    # Data-driven check for numeric columns
    if pd.api.types.is_numeric_dtype(series) and total_rows > 10:
        unique_ratio = series.nunique() / total_rows
        # If nearly all values are unique
        if unique_ratio >= 0.90:
            clean_s = series.dropna()
            if len(clean_s) > 0 and (clean_s % 1 == 0).all():
                # Large numbers (e.g. 10/11 digit student roll numbers, timestamps, IDs)
                if clean_s.mean() > 100000:
                    return True
                # Or strictly sequential row indices (1, 2, 3...)
                if clean_s.max() - clean_s.min() + 1 == len(clean_s) and clean_s.min() in [0, 1]:
                    return True

    return False

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
        if is_id_column(col, df[col], row_count):
            inferred_type = 'id'
        elif pd.api.types.is_numeric_dtype(df[col]):
            inferred_type = 'numeric'
        elif pd.api.types.is_datetime64_any_dtype(df[col]):
            inferred_type = 'datetime'
        elif pd.api.types.is_string_dtype(df[col]) or isinstance(df[col].dtype, pd.CategoricalDtype):
            # Fast check: Only attempt date parsing if column name or samples look date-like
            col_lower = col.lower()
            date_name_match = any(k in col_lower for k in ['date', 'time', 'year', 'month', 'day', 'timestamp', 'created', 'updated', 'dt'])
            sample_str = " ".join(str(v) for v in sample_values)
            has_date_symbols = any(sym in sample_str for sym in ['-', '/', ':'])
            
            if date_name_match or has_date_symbols:
                try:
                    pd.to_datetime(df[col].dropna().head(20), errors='raise')
                    inferred_type = 'datetime'
                    df[col] = pd.to_datetime(df[col], errors='coerce')
                except (ValueError, TypeError, ParserError):
                    inferred_type = 'categorical' if unique_count <= 50 else 'text'
            else:
                inferred_type = 'categorical' if unique_count <= 50 else 'text'

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
