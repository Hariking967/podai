import type {
  ChatCompletionAssistantMessageParam,
  ChatCompletionMessageParam,
  ChatCompletionTool,
  ChatCompletionToolMessageParam,
} from "openai/resources/chat/completions";
import { openaiClient } from "./openai-client";
import { runPythonInDocker } from "./docker-python";
import { runSqlOnNeon } from "./neon-sql";

const LOG_PREFIX = "[AI-Agent]";

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

const buildSystemPrompt = () => `
You are the XBase AI agent for this project.

## CRITICAL RULE: NEVER RETURN CODE AS TEXT
**ABSOLUTELY FORBIDDEN:** Do NOT return Python code as text in your response.
**REQUIRED:** You MUST call the run_python tool to execute any code.
**IF** the user mentions visualization, plotting, charting, or analysis → **CALL run_python TOOL IMMEDIATELY**
**NEVER** say "here's the code" or "you can run this" → **EXECUTE IT YOURSELF**

## CRITICAL SQL RULES:
1. **ALWAYS use double-quoted identifiers** for table and column names to preserve case sensitivity.
   - Correct: SELECT * FROM "Students"
   - Correct: SELECT "FirstName", "LastName" FROM "Users"
   - WRONG: SELECT * FROM Students (this becomes lowercase "students")
   - WRONG: SELECT FirstName FROM Users (these become lowercase)

2. PostgreSQL lowercases unquoted identifiers. ALWAYS quote them.

3. Only generate read-only SQL (SELECT, WITH, SHOW, EXPLAIN, VALUES).

4. Never invent data. Base answers on run_sql results.

5. If a query fails with "relation does not exist", check the exact table name case.

## MANDATORY TOOL USAGE:
- For ANY visualization, chart, plot, or graph request → **MUST call run_python tool**
- For database reads → **MUST call run_sql tool**
- **NEVER** return code as text without executing it
- **ALWAYS** execute code and show the actual results

## For data analysis:
If you need to analyze data or generate plots after fetching data, call \`run_python\`.
The Python tool environment provides:
- A CSV file path at INPUT_CSV_PATH (if provided).
- Any additional files passed in.
- Helper module with utility functions for visualization

When using \`run_python\`:
- Your code MUST set a variable named \`result\` with JSON-serializable output.
- \`result\` should contain the final data the frontend will render (tables, metrics, metadata).
- Avoid relying on \`print()\` for data; use prints only for brief logs.
- Validate inputs and handle empty data so the code runs without errors.

## IMAGE OUTPUT - CRITICAL REQUIREMENTS:
When creating visualizations, you have THREE options:

### Option 1: Using helpers module (RECOMMENDED):
\`\`\`python
import matplotlib.pyplot as plt
from helpers import create_visualization_result

# Create your plot
fig, ax = plt.subplots(figsize=(10, 6))
ax.bar(x_data, y_data)
ax.set_title('My Chart')

# Create complete result with image, data, and metrics
result = create_visualization_result(
    fig=fig,
    data=[{'x': 1, 'y': 2}],  # Optional: data for table
    metrics={'total': 100}     # Optional: key metrics to display
)
\`\`\`

### Option 2: Manual base64 encoding:
\`\`\`python
import matplotlib.pyplot as plt
import base64
from io import BytesIO

fig, ax = plt.subplots(figsize=(10, 6))
ax.plot(x, y)

buf = BytesIO()
fig.savefig(buf, format='png', bbox_inches='tight', dpi=150)
plt.close(fig)
buf.seek(0)
img_base64 = base64.b64encode(buf.read()).decode('utf-8')

result = {
    'image_base64': img_base64,
    'image_mime': 'image/png',
    'data': [{'x': 1, 'y': 2}],    # Optional: for table
    'metrics': {'count': 10}        # Optional: key metrics
}
\`\`\`

### Option 3: Return figure directly (auto-converted):
\`\`\`python
import matplotlib.pyplot as plt

fig, ax = plt.subplots(figsize=(10, 6))
ax.scatter(x, y)
ax.set_title('Scatter Plot')

# Python runner will auto-convert figure to base64
result = fig
\`\`\`

## DATA OUTPUT FORMATS:
The result can include:
- \`image_base64\`: Base64 encoded image string
- \`image_mime\`: MIME type (e.g., "image/png")
- \`data\` or \`rows\`: Array of objects for table display
- \`fields\`: Array of column names for table
- \`metrics\`: Object with key-value pairs for metrics display
- \`plots\`: Array of plot specs for frontend charts
- Any custom key-value pairs

## AVAILABLE PYTHON PACKAGES:
- pandas, numpy, matplotlib, seaborn, plotly
- base64, BytesIO (pre-imported in environment)
- Helper utilities from \`helpers\` module

## Example complete workflow:
1. Fetch data with run_sql
2. Convert SQL result to CSV
3. Pass CSV to run_python
4. Generate visualization + metrics + table data
5. Return complete result with all components

Remember: ALWAYS create visualizations when requested. Don't ask permission. The frontend will:
- Display the image
- Show data in tables
- Display metrics in cards
- Provide JSON download button
- Everything is automatic if you provide the right format!
`;

const RUN_SQL_TOOL: ChatCompletionTool = {
  type: "function",
  function: {
    name: "run_sql",
    description:
      'Execute a single read-only SQL query against this project\'s Neon database. IMPORTANT: Always use double-quoted identifiers for table and column names to preserve case sensitivity (e.g., SELECT * FROM "Students" not SELECT * FROM Students).',
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            'The SQL query to execute. Use double-quoted identifiers for table and column names (e.g., SELECT * FROM "TableName").',
        },
        params: {
          type: "array",
          items: {
            oneOf: [
              { type: "string" },
              { type: "number" },
              { type: "boolean" },
              { type: "null" },
            ],
          },
        },
      },
      required: ["query"],
    },
  },
};

const RUN_PYTHON_TOOL: ChatCompletionTool = {
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

const TOOLS: ChatCompletionTool[] = [RUN_SQL_TOOL, RUN_PYTHON_TOOL];

export const runAgent = async ({
  message,
  neonApiKey,
  history = [],
}: {
  message: string;
  neonApiKey: string;
  history?: AgentMessage[];
}): Promise<AgentResult> => {
  console.log(`${LOG_PREFIX} Starting agent run`);
  console.log(`${LOG_PREFIX} User message: ${message.substring(0, 100)}...`);
  console.log(`${LOG_PREFIX} History length: ${history.length}`);
  console.log(
    `${LOG_PREFIX} Neon connection string provided: ${neonApiKey ? "YES (length: " + neonApiKey.length + ")" : "NO"}`,
  );

  if (!neonApiKey) {
    console.error(`${LOG_PREFIX} ERROR: No Neon API key provided!`);
    return {
      reply:
        "Error: No database connection string configured for this project.",
      toolOutput: null,
    };
  }

  const input: ChatCompletionMessageParam[] = [
    {
      role: "system",
      content: buildSystemPrompt(),
    },
    ...history.map((entry) => ({
      role: entry.role,
      content: entry.content,
    })),
    { role: "user", content: message },
  ];

  console.log(`${LOG_PREFIX} Calling OpenAI with ${input.length} messages`);

  const needsVisualization =
    /\b(chart|plot|visuali[sz]e|graph|pie|bar|line|scatter|histogram|heatmap|distribution|show|create|generate|make|draw|display|render)\b/i.test(
      message,
    ) || /\b(matplotlib|seaborn|plotly|figure|diagram|image)\b/i.test(message);
  let forcedToolRetry = false;
  let secondRetry = false;

  let response = await openaiClient.chat.completions.create({
    model: "gpt-4.1-mini",
    messages: input,
    tools: TOOLS,
    tool_choice: needsVisualization ? "required" : "auto",
  });

  console.log(
    `${LOG_PREFIX} OpenAI response received, finish_reason: ${response.choices[0]?.finish_reason}`,
  );

  let toolOutput: AgentResult["toolOutput"] = null;
  const conversation = [...input];

  for (let i = 0; i < 4; i += 1) {
    console.log(`${LOG_PREFIX} Tool loop iteration ${i + 1}/4`);
    const assistantMessage = response.choices[0]?.message;
    const toolCalls =
      assistantMessage?.tool_calls?.filter(
        (item) => item.type === "function" && "function" in item,
      ) ?? [];

    console.log(`${LOG_PREFIX} Tool calls count: ${toolCalls.length}`);

    if (!toolCalls.length) {
      if (needsVisualization && !forcedToolRetry) {
        console.warn(
          `${LOG_PREFIX} No tool calls for visualization request, retrying with strict tool instruction`,
        );
        forcedToolRetry = true;
        response = await openaiClient.chat.completions.create({
          model: "gpt-4.1-mini",
          messages: [
            ...conversation,
            {
              role: "system",
              content:
                "CRITICAL: You must call tools now. For visualization requests, first call run_sql to fetch the needed rows, then call run_python to render a matplotlib chart and return result.image_base64 and result.image_mime. Do not answer without using tools. DO NOT return Python code as text.",
            },
          ],
          tools: TOOLS,
          tool_choice: "required",
        });
        continue;
      }

      if (needsVisualization && forcedToolRetry && !secondRetry) {
        console.warn(
          `${LOG_PREFIX} Second retry: AI still not calling tools, forcing with stronger message`,
        );
        secondRetry = true;
        response = await openaiClient.chat.completions.create({
          model: "gpt-4.1-mini",
          messages: [
            ...conversation,
            {
              role: "user",
              content:
                "Execute the visualization using run_python tool RIGHT NOW. Do not return code as text. Call the run_python tool with the matplotlib code.",
            },
          ],
          tools: TOOLS,
          tool_choice: "required",
        });
        continue;
      }

      console.log(`${LOG_PREFIX} No tool calls, returning final response`);
      return {
        reply: assistantMessage?.content ?? "",
        toolOutput,
      };
    }

    const assistantToolCallMessage: ChatCompletionAssistantMessageParam = {
      role: "assistant",
      content: assistantMessage?.content ?? "",
      tool_calls: toolCalls,
    };
    conversation.push(assistantToolCallMessage);

    for (const toolCall of toolCalls) {
      const parsedArgsRaw =
        typeof toolCall.function.arguments === "string"
          ? JSON.parse(toolCall.function.arguments)
          : toolCall.function.arguments;
      const parsedArgs =
        typeof parsedArgsRaw === "object" && parsedArgsRaw !== null
          ? parsedArgsRaw
          : {};

      if (toolCall.function.name === "run_sql") {
        const sqlArgs = parsedArgs as { query?: string; params?: unknown[] };
        console.log(`${LOG_PREFIX} [run_sql] Query: ${sqlArgs.query}`);
        console.log(
          `${LOG_PREFIX} [run_sql] Params: ${JSON.stringify(sqlArgs.params)}`,
        );
        console.log(
          `${LOG_PREFIX} [run_sql] Using connection string (first 50 chars): ${neonApiKey.substring(0, 50)}...`,
        );

        try {
          const sqlResult = await runSqlOnNeon({
            connectionString: neonApiKey,
            query: sqlArgs.query ?? "",
            params: Array.isArray(sqlArgs.params) ? sqlArgs.params : [],
          });

          console.log(
            `${LOG_PREFIX} [run_sql] SUCCESS - Rows returned: ${sqlResult.rowCount}`,
          );
          console.log(
            `${LOG_PREFIX} [run_sql] Fields: ${sqlResult.fields.join(", ")}`,
          );

          toolOutput = {
            prints: `SQL rows returned: ${sqlResult.rowCount}`,
            result: sqlResult,
            error: null,
          };
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "SQL execution failed.";
          console.error(`${LOG_PREFIX} [run_sql] ERROR: ${errorMessage}`);

          toolOutput = {
            prints: "",
            result: null,
            error: {
              message: errorMessage,
              traceback: "",
            },
          };
        }
      } else if (toolCall.function.name === "run_python") {
        const pyArgs = parsedArgs as {
          code?: string;
          csv?: string;
          files?: Record<string, string>;
        };
        console.log(
          `${LOG_PREFIX} [run_python] Code length: ${(pyArgs.code ?? "").length}`,
        );
        console.log(
          `${LOG_PREFIX} [run_python] CSV provided: ${pyArgs.csv ? "YES" : "NO"}`,
        );
        console.log(
          `${LOG_PREFIX} [run_python] Files count: ${Object.keys(pyArgs.files ?? {}).length}`,
        );

        toolOutput = await runPythonInDocker({
          code: pyArgs.code ?? "",
          csv: pyArgs.csv ?? "",
          files: pyArgs.files ?? {},
        });

        console.log(
          `${LOG_PREFIX} [run_python] Result: ${toolOutput.error ? "ERROR" : "SUCCESS"}`,
        );
        if (toolOutput.error) {
          console.error(
            `${LOG_PREFIX} [run_python] Error: ${toolOutput.error.message}`,
          );
        }
      } else {
        toolOutput = {
          prints: "",
          result: null,
          error: {
            message: `Unsupported tool call: ${toolCall.function.name}`,
            traceback: "",
          },
        };
      }

      const toolResultMessage: ChatCompletionToolMessageParam = {
        role: "tool",
        tool_call_id: toolCall.id,
        content: JSON.stringify(toolOutput),
      };
      conversation.push(toolResultMessage);
    }

    response = await openaiClient.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: conversation,
      tools: TOOLS,
    });
  }

  return {
    reply:
      response.choices[0]?.message?.content ??
      "I could not finish the tool execution flow.",
    toolOutput,
  };
};
