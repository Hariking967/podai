import { spawn } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";

const LOG_PREFIX = "[Docker-Python]";

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
  new Promise<{ stdout: string; stderr: string; code: number | null }>(
    (resolve) => {
      console.log(
        `${LOG_PREFIX} Running command: ${command} ${args.join(" ")}`,
      );
      const proc = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
      let stdout = "";
      let stderr = "";
      const timer = setTimeout(() => {
        console.error(`${LOG_PREFIX} Command timed out after ${timeoutMs}ms`);
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
        console.log(`${LOG_PREFIX} Command exited with code: ${code}`);
        resolve({ stdout, stderr, code });
      });
    },
  );

export const runPythonInDocker = async ({
  code,
  csv,
  files,
  timeoutMs = 20000,
}: PythonExecutionRequest): Promise<PythonExecutionResult> => {
  console.log(`${LOG_PREFIX} runPythonInDocker called`);
  console.log(`${LOG_PREFIX} Code length: ${code.length}`);
  console.log(`${LOG_PREFIX} CSV provided: ${csv ? "YES" : "NO"}`);
  console.log(`${LOG_PREFIX} Files count: ${Object.keys(files ?? {}).length}`);
  console.log(`${LOG_PREFIX} Timeout: ${timeoutMs}ms`);

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "xbase-python-"));
  console.log(`${LOG_PREFIX} Created temp directory: ${tempDir}`);

  try {
    const requestPayload = {
      code,
      csv: csv ?? "",
      files: files ?? {},
    };
    fs.writeFileSync(
      path.join(tempDir, "request.json"),
      JSON.stringify(requestPayload),
      "utf-8",
    );
    console.log(`${LOG_PREFIX} Wrote request.json to temp directory`);

    const dockerArgs = ["run", "--rm", "-v", `${tempDir}:/work`, IMAGE_NAME];

    console.log(`${LOG_PREFIX} Starting Docker container...`);
    const {
      stdout,
      stderr,
      code: exitCode,
    } = await runCommand("docker", dockerArgs, timeoutMs);

    console.log(`${LOG_PREFIX} Docker exit code: ${exitCode}`);
    console.log(`${LOG_PREFIX} Docker stdout length: ${stdout.length}`);
    console.log(`${LOG_PREFIX} Docker stderr length: ${stderr.length}`);

    if (exitCode !== 0) {
      console.error(`${LOG_PREFIX} Docker execution failed`);
      console.error(`${LOG_PREFIX} stderr: ${stderr.substring(0, 500)}`);
      return {
        prints: "",
        result: null,
        error: {
          message: `Docker execution failed: ${stderr || "unknown error"}`,
          traceback: "",
        },
      };
    }

    console.log(`${LOG_PREFIX} Parsing Docker output...`);
    const parsed = JSON.parse(stdout.trim());
    console.log(`${LOG_PREFIX} Parsed successfully`);
    console.log(
      `${LOG_PREFIX} Has result: ${parsed.result !== null && parsed.result !== undefined}`,
    );
    console.log(`${LOG_PREFIX} Has error: ${parsed.error !== null}`);

    return {
      prints: String(parsed.prints ?? ""),
      result: parsed.result ?? null,
      error: parsed.error ?? null,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error(`${LOG_PREFIX} Exception: ${errorMessage}`);
    return {
      prints: "",
      result: null,
      error: {
        message: errorMessage,
        traceback: "",
      },
    };
  } finally {
    console.log(`${LOG_PREFIX} Cleaning up temp directory...`);
    fs.rmSync(tempDir, { recursive: true, force: true });
    console.log(`${LOG_PREFIX} Temp directory removed`);
  }
};
