import { spawn } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

interface PythonExecutionRequest {
  code: string;
  csv?: string;
  files?: Record<string, string>;
  timeoutMs?: number;
}

interface PythonExecutionResult {
  prints: string;
  result: unknown;
  error: { message: string; traceback: string } | null;
}

const IMAGE_NAME = "xbase-python-exec";

const runCommand = (command: string, args: string[], timeoutMs: number) =>
  new Promise<{ stdout: string; stderr: string; code: number | null }>((resolve) => {
    const proc = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      proc.kill("SIGKILL");
    }, timeoutMs);

    proc.stdout.on("data", (data) => {
      stdout += data.toString();
    });
    proc.stderr.on("data", (data) => {
      stderr += data.toString();
    });
    proc.on("close", (code) => {
      clearTimeout(timer);
      resolve({ stdout, stderr, code });
    });
  });

export const runPythonInDocker = async ({
  code,
  csv,
  files,
  timeoutMs = 20000,
}: PythonExecutionRequest): Promise<PythonExecutionResult> => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "xbase-python-"));
  try {
    const requestPayload = {
      code,
      csv: csv ?? "",
      files: files ?? {},
    };
    fs.writeFileSync(
      path.join(tempDir, "request.json"),
      JSON.stringify(requestPayload),
      "utf-8"
    );

    const dockerArgs = [
      "run",
      "--rm",
      "-v",
      `${tempDir}:/work`,
      IMAGE_NAME,
    ];

    const { stdout, stderr, code: exitCode } = await runCommand(
      "docker",
      dockerArgs,
      timeoutMs
    );

    if (exitCode !== 0) {
      return {
        prints: "",
        result: null,
        error: {
          message: `Docker execution failed: ${stderr || "unknown error"}`,
          traceback: "",
        },
      };
    }

    const parsed = JSON.parse(stdout.trim());
    return {
      prints: String(parsed.prints ?? ""),
      result: parsed.result ?? null,
      error: parsed.error ?? null,
    };
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
};
