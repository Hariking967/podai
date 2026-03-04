"""
Helper utilities for XBase Python execution environment.
Provides easy-to-use functions for data visualization and JSON output.
"""

import base64
from io import BytesIO
import json


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
