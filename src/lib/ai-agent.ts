import type { Responses } from "openai/resources/responses";
import { openaiClient } from "./openai-client";
import { runPythonInDocker } from "./docker-python";

export interface AgentMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AgentResult {
  reply: string;
  toolOutput: {
    prints: string;
    result: unknown;
    error: { message: string; traceback: string } | null;
  } | null;
}

const buildSystemPrompt = (neonApiKey: string) => `
You are the XBase AI agent for this project.
Always use this project's Neon API key when accessing the database:
${neonApiKey}

If you need to analyze data or generate plots, call the run_python tool.
The Python tool environment provides:
- A CSV file path at INPUT_CSV_PATH (if provided).
- Any additional files passed in.

When using run_python, your code MUST set a variable named "result" with
the JSON-serializable output (e.g., data for charts). Use print() for logs.
The tool will capture prints and return them along with the result.
`;

const TOOL_DEFINITION: Responses.Tool = {
  type: "function",
  name: "run_python",
  description:
    "Run Python code in a Docker sandbox. Provide code and optional CSV string.",
  parameters: {
    type: "object",
    properties: {
      code: { type: "string" },
      csv: { type: "string" },
      files: {
        type: "object",
        additionalProperties: { type: "string" },
      },
    },
    required: ["code"],
  },
};

export const runAgent = async ({
  message,
  neonApiKey,
  history = [],
}: {
  message: string;
  neonApiKey: string;
  history?: AgentMessage[];
}): Promise<AgentResult> => {
  const input: Responses.InputItem[] = [
    {
      role: "system",
      content: buildSystemPrompt(neonApiKey),
    },
    ...history.map((entry) => ({
      role: entry.role,
      content: entry.content,
    })),
    { role: "user", content: message },
  ];

  const response = await openaiClient.responses.create({
    model: "gpt-4.1-mini",
    input,
    tools: [TOOL_DEFINITION],
  });

  let toolOutput: AgentResult["toolOutput"] = null;
  const toolCalls = response.output?.filter(
    (item) => item.type === "function_call" && item.name === "run_python"
  ) as Responses.FunctionCallOutputItem[];

  if (toolCalls?.length) {
    const toolCall = toolCalls[0];
    const parsedArgs =
      typeof toolCall.arguments === "string"
        ? JSON.parse(toolCall.arguments)
        : toolCall.arguments;

    toolOutput = await runPythonInDocker({
      code: parsedArgs.code ?? "",
      csv: parsedArgs.csv ?? "",
      files: parsedArgs.files ?? {},
    });

    const followUp = await openaiClient.responses.create({
      model: "gpt-4.1-mini",
      input: [
        ...input,
        {
          type: "function_call_output",
          call_id: toolCall.call_id,
          output: JSON.stringify(toolOutput),
        },
      ],
      tools: [TOOL_DEFINITION],
    });

    return {
      reply: followUp.output_text ?? "",
      toolOutput,
    };
  }

  return {
    reply: response.output_text ?? "",
    toolOutput,
  };
};
