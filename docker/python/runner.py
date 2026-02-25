import json
import os
import sys
import traceback
from contextlib import redirect_stdout
from io import StringIO


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

    if csv_content:
        with open("/work/input.csv", "w", encoding="utf-8") as f:
            f.write(csv_content)

    for name, content in files.items():
        safe_name = name.replace("..", "").replace("\\", "/").split("/")[-1]
        if not safe_name:
            continue
        with open(f"/work/{safe_name}", "w", encoding="utf-8") as f:
            f.write(content)

    local_env = {
        "__name__": "__main__",
        "INPUT_CSV_PATH": "/work/input.csv",
    }

    stdout_buffer = StringIO()
    result = None
    error = None

    try:
        with redirect_stdout(stdout_buffer):
            exec(code, local_env)
        result = local_env.get("result")
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
