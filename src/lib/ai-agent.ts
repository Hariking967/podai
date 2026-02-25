import type {
  ChatCompletionAssistantMessageParam,
  ChatCompletionMessageParam,
  ChatCompletionTool,
  ChatCompletionToolMessageParam,
} from "openai/resources/chat/completions";
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

const TOOL_DEFINITION: ChatCompletionTool = {
  type: "function",
  function: {
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
  const input: ChatCompletionMessageParam[] = [
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

  const response = await openaiClient.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: input,
    tools: [TOOL_DEFINITION],
  });

  let toolOutput: AgentResult["toolOutput"] = null;
  const toolCall = response.choices[0]?.message?.tool_calls?.find(
    (item) =>
      item.type === "function" &&
      "function" in item &&
      item.function.name === "run_python"
  );

  if (toolCall && "function" in toolCall && toolCall.function.arguments) {
    const parsedArgsRaw =
      typeof toolCall.function.arguments === "string"
        ? JSON.parse(toolCall.function.arguments)
        : toolCall.function.arguments;
    const parsedArgs =
      typeof parsedArgsRaw === "object" && parsedArgsRaw !== null
        ? (parsedArgsRaw as {
            code?: string;
            csv?: string;
            files?: Record<string, string>;
          })
        : {};

    toolOutput = await runPythonInDocker({
      code: parsedArgs.code ?? "",
      csv: parsedArgs.csv ?? "",
      files: parsedArgs.files ?? {},
    });

    const assistantToolCallMessage: ChatCompletionAssistantMessageParam = {
      role: "assistant",
      content: response.choices[0]?.message?.content ?? "",
      tool_calls: [toolCall],
    };

    const toolResultMessage: ChatCompletionToolMessageParam = {
      role: "tool",
      tool_call_id: toolCall.id,
      content: JSON.stringify(toolOutput),
    };

    const followUp = await openaiClient.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        ...input,
        assistantToolCallMessage,
        toolResultMessage,
      ],
      tools: [TOOL_DEFINITION],
    });

    return {
      reply: followUp.choices[0]?.message?.content ?? "",
      toolOutput,
    };
  }

  return {
    reply: response.choices[0]?.message?.content ?? "",
    toolOutput,
  };
};
