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

## CRITICAL RULE: ALWAYS SHOW SQL QUERIES
**REQUIRED:** When you generate and execute any SQL query, you MUST:
1. Show the SQL query in a code block (use \`\`\`sql)
2. Provide a brief 1-2 sentence explanation of what the query does
3. Then execute the query using the run_sql tool
4. Show the results

Example response format:
"Here's the SQL query to fetch all students:
\`\`\`sql
SELECT * FROM "Students" ORDER BY "Name";
\`\`\`
This query retrieves all student records sorted by their names.

[Then execute and show results]"

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

3. Allowed SQL operations:
   - **Read:** SELECT, WITH, SHOW, EXPLAIN, VALUES
   - **Write:** INSERT, UPDATE, DELETE
   - **Schema:** CREATE TABLE, ALTER TABLE, DROP TABLE, TRUNCATE

4. When creating tables, use appropriate data types and constraints.

5. Never invent data. Base answers on run_sql results.

6. If a query fails with "relation does not exist", check the exact table name case.

## MANDATORY TOOL USAGE:
- For **database operations** (CREATE, INSERT, UPDATE, DELETE, SELECT, ALTER, DROP) → **MUST call run_sql tool**
- For **data analysis, visualization, charts, plots, or graphs** → **MUST call run_python tool**
- **NEVER** use Python to create tables or modify database - that's SQL's job
- **NEVER** return code as text without executing it
- **ALWAYS** execute code and show the actual results

## CRITICAL: When to use which tool:
**Use run_sql for:**
- Creating tables (CREATE TABLE)
- Inserting data (INSERT INTO)
- Updating records (UPDATE)
- Deleting records (DELETE)
- Querying data (SELECT)
- Modifying schema (ALTER TABLE, DROP TABLE)
- Any database structure or data operations

**Use run_python for:**
- Creating visualizations (charts, plots, graphs)
- Statistical analysis
- Data processing and transformations
- Machine learning operations
- Generating images from data

**Example:** "Create a table employees" → Use run_sql with CREATE TABLE
**Example:** "Show a pie chart of sales" → Use run_sql to get data, then run_python to visualize

## CRITICAL VISUALIZATION WORKFLOW:
When user requests a chart/plot/graph, you MUST follow these steps:
1. **STEP 1:** Call run_sql to fetch the required data
2. **STEP 2:** Convert SQL result to CSV format
3. **STEP 3:** Call run_python with matplotlib code that:
   - Reads the CSV data
   - Creates the requested chart type (pie, bar, line, scatter, etc.)
   - Sets result with image_base64 and data
4. **NEVER stop after step 1** - You must complete ALL THREE STEPS
5. **NEVER return the data without creating the visualization**

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
      'Execute a SQL query against this project\'s Neon database. Supports SELECT, INSERT, UPDATE, DELETE, CREATE TABLE, ALTER TABLE, DROP TABLE. IMPORTANT: Always use double-quoted identifiers for table and column names to preserve case sensitivity (e.g., CREATE TABLE "Students" not CREATE TABLE Students).',
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            'The SQL query to execute. Use double-quoted identifiers for table and column names (e.g., SELECT * FROM "TableName", CREATE TABLE "MyTable").',
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

  // Check if this is a database operation (not visualization)
  const isDatabaseOperation =
    /\b(create\s+(table|database|index)|insert\s+into|update\s+\w+\s+set|delete\s+from|alter\s+table|drop\s+table)\b/i.test(
      message,
    );

  // Only trigger visualization mode if NOT a database operation
  const needsVisualization =
    !isDatabaseOperation &&
    (/\b(chart|plot|visuali[sz]e|graph|pie|bar|line|scatter|histogram|heatmap|distribution)\b/i.test(
      message,
    ) ||
      /\b(matplotlib|seaborn|plotly|figure|diagram|image)\b/i.test(message) ||
      /\b(show|display|draw)\b/i.test(message));

  console.log(
    `${LOG_PREFIX} isDatabaseOperation: ${isDatabaseOperation}, needsVisualization: ${needsVisualization}`,
  );

  let forcedToolRetry = false;
  let secondRetry = false;
  let pythonWasCalled = false;
  let sqlWasCalled = false;

  let response;
  try {
    response = await openaiClient.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: input,
      tools: TOOLS,
      tool_choice: needsVisualization ? "required" : "auto",
    });
  } catch (error) {
    console.error(`${LOG_PREFIX} OpenAI API call failed:`, error);
    const errorMessage =
      error instanceof Error ? error.message : "OpenAI API call failed";
    return {
      reply: `Sorry, I encountered an error: ${errorMessage}. Please try again or rephrase your question.`,
      toolOutput: null,
    };
  }

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
        try {
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
        } catch (error) {
          console.error(`${LOG_PREFIX} OpenAI retry failed:`, error);
          return {
            reply:
              assistantMessage?.content ??
              "Sorry, I encountered an error while processing your request. Please try again.",
            toolOutput,
          };
        }
      }

      if (needsVisualization && forcedToolRetry && !secondRetry) {
        console.warn(
          `${LOG_PREFIX} Second retry: AI still not calling tools, forcing with stronger message`,
        );
        secondRetry = true;
        try {
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
        } catch (error) {
          console.error(`${LOG_PREFIX} OpenAI second retry failed:`, error);
          return {
            reply:
              assistantMessage?.content ??
              "Sorry, I encountered an error while processing your request. Please try again.",
            toolOutput,
          };
        }
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
        sqlWasCalled = true;
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
        pythonWasCalled = true;
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

    // Check if visualization was requested but Python wasn't called yet
    if (needsVisualization && sqlWasCalled && !pythonWasCalled) {
      console.warn(
        `${LOG_PREFIX} Visualization requested: SQL was called but Python was NOT. Forcing run_python execution.`,
      );
      try {
        response = await openaiClient.chat.completions.create({
          model: "gpt-4.1-mini",
          messages: [
            ...conversation,
            {
              role: "system",
              content:
                "CRITICAL: You fetched data but DID NOT create the visualization! You MUST now call run_python tool to generate the chart image. Convert the SQL result to CSV format and pass it to run_python with matplotlib code that creates the requested visualization. DO THIS NOW.",
            },
          ],
          tools: TOOLS,
          tool_choice: "required",
        });
      } catch (error) {
        console.error(
          `${LOG_PREFIX} OpenAI visualization retry failed:`,
          error,
        );
        return {
          reply:
            "I fetched the data but encountered an error while creating the visualization. Here's what I found:\n\n" +
            (assistantMessage?.content ?? "Data retrieved successfully."),
          toolOutput,
        };
      }
    } else if (needsVisualization && sqlWasCalled && pythonWasCalled) {
      // Both SQL and Python were called successfully - get final response and exit
      console.log(
        `${LOG_PREFIX} Visualization complete: Both SQL and Python executed successfully. Getting final response.`,
      );
      try {
        response = await openaiClient.chat.completions.create({
          model: "gpt-4.1-mini",
          messages: conversation,
          tools: TOOLS,
        });

        // Check if there are no more tool calls - if so, we're done
        const finalToolCalls =
          response.choices[0]?.message?.tool_calls?.filter(
            (item) => item.type === "function" && "function" in item,
          ) ?? [];

        if (finalToolCalls.length === 0) {
          console.log(
            `${LOG_PREFIX} Visualization workflow complete, exiting loop`,
          );
          return {
            reply:
              response.choices[0]?.message?.content ??
              "Visualization created successfully.",
            toolOutput,
          };
        }
      } catch (error) {
        console.error(`${LOG_PREFIX} OpenAI final response failed:`, error);
        return {
          reply:
            "Visualization created successfully. " +
            (assistantMessage?.content ?? ""),
          toolOutput,
        };
      }
    } else {
      try {
        response = await openaiClient.chat.completions.create({
          model: "gpt-4.1-mini",
          messages: conversation,
          tools: TOOLS,
        });
      } catch (error) {
        console.error(`${LOG_PREFIX} OpenAI follow-up call failed:`, error);
        // If we already have toolOutput, return it with a success message
        if (toolOutput && !toolOutput.error) {
          console.log(`${LOG_PREFIX} Returning tool output despite API error`);
          return {
            reply: sqlWasCalled
              ? "Query executed successfully. See the results above."
              : pythonWasCalled
                ? "Code executed successfully. See the results above."
                : "Request processed successfully.",
            toolOutput,
          };
        }
        // Otherwise return error
        return {
          reply:
            "Sorry, I encountered an error while processing the results. Please try again.",
          toolOutput,
        };
      }
    }
  }

  // If we exit the loop, check if visualization was completed successfully
  if (
    needsVisualization &&
    pythonWasCalled &&
    toolOutput &&
    !toolOutput.error
  ) {
    console.log(
      `${LOG_PREFIX} Visualization completed successfully (after loop exit)`,
    );
    return {
      reply:
        response?.choices[0]?.message?.content ??
        "I've created the visualization based on your data. You can see the chart and download the results above.",
      toolOutput,
    };
  }

  // If we have successful tool output, return it
  if (toolOutput && !toolOutput.error) {
    console.log(`${LOG_PREFIX} Tool execution successful (after loop exit)`);
    return {
      reply:
        response?.choices[0]?.message?.content ??
        (sqlWasCalled
          ? "Query executed successfully. See the results above."
          : pythonWasCalled
            ? "Code executed successfully. See the results above."
            : "Request processed successfully."),
      toolOutput,
    };
  }

  // Fallback response
  console.log(`${LOG_PREFIX} Returning fallback response`);
  return {
    reply:
      response?.choices[0]?.message?.content ??
      "I processed your request. " +
        (toolOutput?.error
          ? `However, there was an error: ${toolOutput.error.message}`
          : ""),
    toolOutput,
  };
};
