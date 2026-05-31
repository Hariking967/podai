"""
Helper utilities for XBase Python execution environment.
Provides easy-to-use functions for data visualization and JSON output.
"""

import base64
from io import BytesIO
import json


def fill_missing_with_sklearn(
    rows,
    strategy='knn',
    n_neighbors=5,
    categorical_fill='most_frequent',
):
    """
    Fill missing values in tabular rows using sklearn imputers.

    Args:
        rows: list of dict-like records
        strategy: 'knn' or 'simple'
        n_neighbors: neighbors for KNNImputer
        categorical_fill: strategy for categorical columns (SimpleImputer)

    Returns:
        dict containing rows, fields, and metrics
    """
    import pandas as pd
    from sklearn.impute import KNNImputer, SimpleImputer

    if rows is None:
        rows = []
    if not isinstance(rows, list):
        raise ValueError("rows must be a list of records")

    if len(rows) == 0:
        return {
            'rows': [],
            'fields': [],
            'metrics': {
                'rows_total': 0,
                'missing_before': 0,
                'missing_after': 0,
                'filled_values': 0,
                'strategy': strategy,
            },
            'summary': 'No input rows provided.',
        }

    df = pd.DataFrame(rows)
    fields = df.columns.tolist()

    missing_before = int(df.isna().sum().sum())
    if missing_before == 0:
        return {
            'rows': df.to_dict(orient='records'),
            'fields': fields,
            'metrics': {
                'rows_total': int(len(df)),
                'missing_before': 0,
                'missing_after': 0,
                'filled_values': 0,
                'strategy': strategy,
            },
            'summary': 'No missing values found.',
        }

    numeric_cols = df.select_dtypes(include=['number']).columns.tolist()
    categorical_cols = [col for col in fields if col not in numeric_cols]

    imputed = df.copy()

    if numeric_cols:
        if strategy == 'knn' and len(numeric_cols) > 0:
            knn_imputer = KNNImputer(n_neighbors=max(1, int(n_neighbors)))
            imputed[numeric_cols] = knn_imputer.fit_transform(imputed[numeric_cols])
        else:
            num_imputer = SimpleImputer(strategy='median')
            imputed[numeric_cols] = num_imputer.fit_transform(imputed[numeric_cols])

    if categorical_cols:
        cat_strategy = categorical_fill if categorical_fill in ['most_frequent', 'constant'] else 'most_frequent'
        cat_imputer = SimpleImputer(strategy=cat_strategy, fill_value='unknown')
        imputed[categorical_cols] = cat_imputer.fit_transform(imputed[categorical_cols])

    missing_after = int(imputed.isna().sum().sum())
    filled_values = max(0, missing_before - missing_after)

    return {
        'rows': imputed.to_dict(orient='records'),
        'fields': fields,
        'metrics': {
            'rows_total': int(len(imputed)),
            'columns_total': int(len(fields)),
            'numeric_columns': int(len(numeric_cols)),
            'categorical_columns': int(len(categorical_cols)),
            'missing_before': missing_before,
            'missing_after': missing_after,
            'filled_values': filled_values,
            'strategy': strategy,
        },
        'summary': f'Filled {filled_values} missing values using sklearn {strategy} imputation.',
    }


def fill_missing_df(df, strategy='knn', n_neighbors=5):
    """Convenience wrapper for DataFrame input."""
    if df is None:
        return {'rows': [], 'fields': [], 'metrics': {'rows_total': 0}}
    return fill_missing_with_sklearn(
        rows=df.to_dict(orient='records'),
        strategy=strategy,
        n_neighbors=n_neighbors,
    )


def fig_to_base64(fig, format='png', dpi=150):
    """
    Convert a matplotlib figure to base64 string.
    
    Args:
        fig: matplotlib figure object
        format: image format (png, jpg, svg)
        dpi: dots per inch for raster formats
        
    Returns:
        dict with image_base64 and image_mime keys
    """
    import matplotlib.pyplot as plt
    
    buf = BytesIO()
    fig.savefig(buf, format=format, bbox_inches='tight', dpi=dpi)
    plt.close(fig)
    buf.seek(0)
    
    img_base64 = base64.b64encode(buf.read()).decode('utf-8')
    mime_types = {
        'png': 'image/png',
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'svg': 'image/svg+xml'
    }
    
    return {
        'image_base64': img_base64,
        'image_mime': mime_types.get(format, 'image/png')
    }


def create_visualization_result(fig, data=None, metrics=None, **kwargs):
    """
    Create a complete result object with visualization and data.
    
    Args:
        fig: matplotlib figure object
        data: optional data to include (list of dicts for tables)
        metrics: optional dict of metrics to display
        **kwargs: additional key-value pairs to include in result
        
    Returns:
        dict ready to be assigned to `result` variable
    """
    result = fig_to_base64(fig)
    
    if data is not None:
        result['data'] = data
    
    if metrics is not None:
        result['metrics'] = metrics
    
    result.update(kwargs)
    
    return result


def rows_to_csv(rows, fields=None):
    """
    Convert SQL rows to CSV string.
    
    Args:
        rows: list of dicts
        fields: optional list of field names (uses all keys if not provided)
        
    Returns:
        CSV string
    """
    import csv
    from io import StringIO
    
    if not rows:
        return ""
    
    if fields is None:
        fields = list(rows[0].keys())
    
    output = StringIO()
    writer = csv.DictWriter(output, fieldnames=fields)
    writer.writeheader()
    writer.writerows(rows)
    
    return output.getvalue()


def format_table_result(rows, fields=None):
    """
    Format SQL query results for frontend table display.
    
    Args:
        rows: list of dicts from SQL query
        fields: optional list of field names to include
        
    Returns:
        dict with rows and fields keys
    """
    if not rows:
        return {"rows": [], "fields": []}
    
    if fields is None:
        fields = list(rows[0].keys())
    
    return {
        "rows": rows,
        "fields": fields
    }


# Example usage templates for AI agent:
USAGE_EXAMPLES = """
# Example 0: Fill missing values with sklearn
from helpers import fill_missing_with_sklearn

result = fill_missing_with_sklearn(rows, strategy='knn', n_neighbors=5)

# Example 1: Create a bar chart with data
import matplotlib.pyplot as plt
from helpers import create_visualization_result

fig, ax = plt.subplots(figsize=(10, 6))
ax.bar(data['x'], data['y'])
ax.set_title('Sales by Month')
ax.set_xlabel('Month')
ax.set_ylabel('Sales')

result = create_visualization_result(
    fig=fig,
    data=data_for_table,  # list of dicts
    metrics={'total_sales': 10000, 'avg_sale': 500}
)

# Example 2: Simple image-only result
import matplotlib.pyplot as plt
from helpers import fig_to_base64

fig, ax = plt.subplots(figsize=(10, 6))
ax.plot(x_values, y_values)

result = fig_to_base64(fig)

# Example 3: Table-only result
from helpers import format_table_result

result = format_table_result(
    rows=[{'name': 'John', 'age': 30}, {'name': 'Jane', 'age': 25}],
    fields=['name', 'age']
)

# Example 4: Direct result with base64 image
import matplotlib.pyplot as plt
import base64
from io import BytesIO

fig, ax = plt.subplots()
ax.plot([1, 2, 3], [4, 5, 6])

buf = BytesIO()
fig.savefig(buf, format='png', bbox_inches='tight', dpi=150)
buf.seek(0)
img_base64 = base64.b64encode(buf.read()).decode('utf-8')
plt.close(fig)

result = {
    'image_base64': img_base64,
    'image_mime': 'image/png',
    'data': [{'x': 1, 'y': 4}, {'x': 2, 'y': 5}, {'x': 3, 'y': 6}]
}
"""
