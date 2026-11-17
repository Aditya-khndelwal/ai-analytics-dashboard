import re
import pandas as pd
import numpy as np
from pandas.errors import ParserError
from typing import Dict, Any

import re
import difflib
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
    Parses a CSV or Excel file, robustly cleans dirty real-world values,
    infers column types accurately, and returns the cleaned dataframe and schema.
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

    # Pre-clean string/object columns: strip whitespace and sanitize common sentinel null strings
    null_markers = {'nan', 'none', 'null', 'n/a', 'na', 'not_available', 'not available', '', '-', 'undefined', 'nil', '?'}
    for col in df.columns:
        if df[col].dtype == object or pd.api.types.is_string_dtype(df[col]):
            df[col] = df[col].apply(
                lambda v: np.nan if (isinstance(v, str) and v.strip().lower() in null_markers)
                else (v.strip() if isinstance(v, str) else v)
            )

    row_count, col_count = df.shape
    schema = []

    for col in df.columns:
        col_lower = col.lower()
        non_nulls = df[col].dropna()
        sample = non_nulls.head(50)
        
        # 1. Date / Datetime Detection & Coercion
        is_date = False
        date_keywords = ['date', 'time', 'year', 'month', 'day', 'timestamp', 'created', 'updated', 'dt', 'dob']
        date_name_match = any(k in col_lower for k in date_keywords)
        sample_str = " ".join(str(v) for v in sample.head(10).tolist())
        has_date_symbols = any(sym in sample_str for sym in ['-', '/', ':'])

        if (date_name_match or has_date_symbols) and len(sample) > 0:
            parsed_sample = pd.to_datetime(sample, errors='coerce')
            valid_ratio = parsed_sample.notna().sum() / len(sample)
            threshold = 0.25 if date_name_match else 0.50
            if valid_ratio >= threshold:
                is_date = True
                df[col] = pd.to_datetime(df[col], errors='coerce')
                inferred_type = 'datetime'

        # 2. Check Numeric & ID columns
        if not is_date:
            if is_id_column(col, df[col], row_count):
                inferred_type = 'id'
            elif pd.api.types.is_numeric_dtype(df[col]):
                inferred_type = 'numeric'
            else:
                # Attempt numeric coercion on non-null strings (e.g. '$12.50' or '1,000')
                clean_num_sample = non_nulls.astype(str).str.replace(r'[\$,]', '', regex=True)
                num_conv = pd.to_numeric(clean_num_sample, errors='coerce')
                if len(non_nulls) > 0 and (num_conv.notna().sum() / len(non_nulls)) >= 0.70:
                    df[col] = pd.to_numeric(df[col].astype(str).str.replace(r'[\$,]', '', regex=True), errors='coerce')
                    inferred_type = 'numeric'
                else:
                    unique_count = df[col].nunique()
                    inferred_type = 'categorical' if unique_count <= 50 else 'text'

        # 3. Numeric Sanitization (Clean impossible negative sentinel values)
        if inferred_type == 'numeric':
            clean_num = df[col].dropna()
            if len(clean_num) > 0:
                non_neg_ratio = (clean_num >= 0).sum() / len(clean_num)
                # If >= 95% of data is non-negative, negative values (-5, -25.5, -1) are sentinels/corrupted
                if non_neg_ratio >= 0.95:
                    df[col] = df[col].apply(lambda v: np.nan if pd.notna(v) and v < 0 else v)

        # 4. Categorical Sanitization (Standardize Casing, Conjunctions & Typos)
        if inferred_type == 'categorical':
            s_clean = df[col].dropna().astype(str)
            if len(s_clean) > 0:
                # Title-case normalization if it reduces fragmented duplicate categories
                s_title = s_clean.apply(lambda v: v.title())
                if s_title.nunique() < s_clean.nunique():
                    df[col] = df[col].apply(lambda v: v.title() if pd.notna(v) else v)

                # Harmonize common conjunctions and symbols
                df[col] = df[col].replace({'Home And Kitchen': 'Home & Kitchen', 'Home &kitchen': 'Home & Kitchen'})

                # Fuzzy typo correction for small category groups (<= 25 categories)
                counts = df[col].value_counts()
                if len(counts) <= 25:
                    dominant = [c for c, cnt in counts.items() if cnt >= row_count * 0.05 and pd.notna(c)]
                    rare = [c for c, cnt in counts.items() if cnt < row_count * 0.02 and cnt <= 10 and pd.notna(c)]
                    mapping = {}
                    for r in rare:
                        matches = difflib.get_close_matches(r, dominant, n=1, cutoff=0.75)
                        if matches:
                            mapping[r] = matches[0]
                    if mapping:
                        df[col] = df[col].replace(mapping)

        # Recompute schema metrics on cleaned column
        unique_count = df[col].nunique()
        null_count = int(df[col].isnull().sum())
        null_pct = round((null_count / row_count) * 100, 2) if row_count > 0 else 0.0
        
        # Sample values (drop NAs) formatted cleanly
        clean_samples = df[col].dropna().head(5)
        if inferred_type == 'datetime':
            sample_values = [str(v)[:10] for v in clean_samples.tolist()]
        else:
            sample_values = clean_samples.tolist()

        schema.append({
            'name': col,
            'dtype': str(df[col].dtype),
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
