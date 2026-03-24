/**
 * Python Execution Adapter for Vercel Production
 *
 * Vercel serverless functions don't support Docker.
 * This provides alternative execution strategies:
 * - Local: Docker (full Python environment)
 * - Production: External Python API or simplified execution
 */

import { runPythonInDocker } from "./docker-python";

const LOG_PREFIX = "[Python-Adapter]";

interface PythonExecutionRequest {
  code: string;
  csv?: string;
  files?: Record<string, string>;
  inputData?: unknown;
  timeoutMs?: number;
}

interface PythonExecutionResult {
  prints: string;
  result: unknown;
  error: { message: string; traceback: string } | null;
}

/**
 * Check if Docker is available in the current environment
 */
const isDockerAvailable = (): boolean => {
  // Check if we're in any serverless/cloud environment without Docker
  const isServerlessEnvironment = !!(
    process.env.VERCEL ||
    process.env.VERCEL_ENV ||
    process.env.RENDER ||
    process.env.RAILWAY_ENVIRONMENT ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.NETLIFY
  );

  // If in serverless without explicit Docker support, assume unavailable
  if (isServerlessEnvironment && !process.env.DOCKER_AVAILABLE) {
    return false;
  }

  // For local development or Docker-enabled deployments
  return true;
};

/**
 * Execute Python code using external API (for production)
 */
const executePythonViaAPI = async (
  request: PythonExecutionRequest,
): Promise<PythonExecutionResult> => {
  console.log(`${LOG_PREFIX} Using external Python API (production mode)`);

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

  if (!backendUrl) {
    console.error(`${LOG_PREFIX} NEXT_PUBLIC_BACKEND_URL not configured`);
    return {
      prints: "",
      result: null,
      error: {
        message:
          "Python backend URL not configured. Set NEXT_PUBLIC_BACKEND_URL environment variable.",
        traceback: "",
      },
    };
  }

  console.log(`${LOG_PREFIX} Calling Python backend at: ${backendUrl}/execute`);

  try {
    const response = await fetch(`${backendUrl}/execute`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        code: request.code,
        csv: request.csv || "",
        files: request.files || {},
        inputData: request.inputData ?? null,
        timeoutMs: request.timeoutMs || 20000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`${LOG_PREFIX} Backend returned error: ${errorText}`);
      return {
        prints: "",
        result: null,
        error: {
          message: `Backend error (${response.status}): ${errorText}`,
          traceback: "",
        },
      };
    }

    const result = await response.json();
    console.log(`${LOG_PREFIX} Backend execution successful`);
    return result as PythonExecutionResult;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error(`${LOG_PREFIX} Failed to call Python backend:`, errorMessage);
    return {
      prints: "",
      result: null,
      error: {
        message: `Failed to connect to Python backend: ${errorMessage}`,
        traceback: "",
      },
    };
  }
};

/**
 * Main Python execution function - routes to appropriate execution method
 */
export const runPythonCode = async (
  request: PythonExecutionRequest,
): Promise<PythonExecutionResult> => {
  console.log(`${LOG_PREFIX} Execution requested`);

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
  const dockerAvailable = isDockerAvailable();
  const environment = process.env.VERCEL
    ? "Vercel"
    : process.env.RENDER
      ? "Render"
      : process.env.RAILWAY_ENVIRONMENT
        ? "Railway"
        : "Local";

  console.log(`${LOG_PREFIX} Environment: ${environment}`);
  console.log(`${LOG_PREFIX} Backend URL: ${backendUrl || "not set"}`);
  console.log(`${LOG_PREFIX} Docker Available: ${dockerAvailable}`);

  // Priority 1: Use external Python backend if URL is configured (for production)
  if (backendUrl && !dockerAvailable) {
    console.log(`${LOG_PREFIX} Using external Python backend API`);
    return executePythonViaAPI(request);
  }

  // Priority 2: Use local Docker if available (for development)
  if (dockerAvailable) {
    console.log(`${LOG_PREFIX} Using local Docker for Python execution`);
    return runPythonInDocker(request);
  }

  // Fallback: Docker not available and no backend URL
  console.error(`${LOG_PREFIX} No Python execution method available`);
  return {
    prints: "",
    result: null,
    error: {
      message:
        "Python execution unavailable. Either run Docker locally or set NEXT_PUBLIC_BACKEND_URL.",
      traceback: "",
    },
  };
};

/**
 * Check if Python execution is available
 */
export const isPythonExecutionAvailable = (): boolean => {
  return isDockerAvailable();
};

/**
 * Get execution environment info
 */
export const getExecutionEnvironment = () => {
  const dockerAvailable = isDockerAvailable();
  const environment = process.env.VERCEL
    ? "vercel-serverless"
    : process.env.RENDER
      ? "render"
      : process.env.RAILWAY_ENVIRONMENT
        ? "railway"
        : "local-docker";

  return {
    platform: environment,
    pythonAvailable: dockerAvailable,
    dockerAvailable: dockerAvailable,
    visualizationSupported: dockerAvailable,
    recommendedPlatforms: dockerAvailable
      ? []
      : [
          "Railway (railway.app)",
          "Render with Docker (render.com)",
          "Fly.io (fly.io)",
          "AWS ECS/Fargate",
          "Google Cloud Run",
        ],
  };
};
