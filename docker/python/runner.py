import json
import os
import sys
import traceback
import base64
from contextlib import redirect_stdout
from io import StringIO, BytesIO

# Make helpers module available
sys.path.insert(0, '/')

try:
    from helpers import fill_missing_df, fill_missing_with_sklearn
except Exception:
    fill_missing_df = None
    fill_missing_with_sklearn = None


def process_result(result):
    """
    Process the result to ensure images are properly base64 encoded.
    Looks for matplotlib figures and converts them automatically.
    """
    if result is None:
        return None
    
    # If result is a matplotlib figure, convert it to base64
    try:
        import matplotlib.pyplot as plt
        if hasattr(result, 'savefig'):  # It's a matplotlib figure
            buf = BytesIO()
            result.savefig(buf, format='png', bbox_inches='tight', dpi=150)
            plt.close(result)
            buf.seek(0)
            img_base64 = base64.b64encode(buf.read()).decode('utf-8')
            return {
                "image_base64": img_base64,
                "image_mime": "image/png",
                "type": "matplotlib_figure"
            }
    except ImportError:
        pass
    
    # If result is a dict, check for figure objects within it
    if isinstance(result, dict):
        processed_result = {}
        for key, value in result.items():
            if hasattr(value, 'savefig'):  # matplotlib figure in dict
                try:
                    import matplotlib.pyplot as plt
                    buf = BytesIO()
                    value.savefig(buf, format='png', bbox_inches='tight', dpi=150)
                    plt.close(value)
                    buf.seek(0)
                    img_base64 = base64.b64encode(buf.read()).decode('utf-8')
                    processed_result['image_base64'] = img_base64
                    processed_result['image_mime'] = 'image/png'
                except Exception:
                    pass
            else:
                processed_result[key] = value
        return processed_result
    
    return result


def main():
    request_path = os.path.join("/work", "request.json")
    if not os.path.exists(request_path):
        print(json.dumps({"error": "request.json not found"}))
        return

    with open(request_path, "r", encoding="utf-8") as f:
        payload = json.load(f)

    code = payload.get("code", "")
    csv_content = payload.get("csv", "")
    files = payload.get("files", {})
    input_data = payload.get("input_data")

    if csv_content:
        with open("/work/input.csv", "w", encoding="utf-8") as f:
            f.write(csv_content)

    for name, content in files.items():
        safe_name = name.replace("..", "").replace("\\", "/").split("/")[-1]
        if not safe_name:
            continue
        with open(f"/work/{safe_name}", "w", encoding="utf-8") as f:
            f.write(content)

    # Enhanced environment with helper utilities
    local_env = {
        "__name__": "__main__",
        "INPUT_CSV_PATH": "/work/input.csv",
        "base64": base64,
        "BytesIO": BytesIO,
        "input_data": input_data,
        "fill_missing_df": fill_missing_df,
        "fill_missing_with_sklearn": fill_missing_with_sklearn,
    }

    try:
        import pandas as pd

        if input_data is None:
            local_env["df"] = pd.DataFrame()
        elif isinstance(input_data, list):
            local_env["df"] = pd.DataFrame(input_data)
        elif isinstance(input_data, dict):
            local_env["df"] = pd.DataFrame([input_data])
        else:
            local_env["df"] = pd.DataFrame()
    except Exception:
        local_env["df"] = None

    stdout_buffer = StringIO()
    result = None
    error = None

    try:
        with redirect_stdout(stdout_buffer):
            exec(code, local_env)
        result = local_env.get("result")
        # Process result to handle matplotlib figures
        result = process_result(result)
    except Exception as exc:  # noqa: BLE001
        error = {
            "message": str(exc),
            "traceback": traceback.format_exc(),
        }

    output = {
        "prints": stdout_buffer.getvalue(),
        "result": result,
        "error": error,
    }
    sys.stdout.write(json.dumps(output))


if __name__ == "__main__":
    main()
