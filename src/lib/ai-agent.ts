import type {
  ChatCompletionAssistantMessageParam,
  ChatCompletionMessageParam,
  ChatCompletionTool,
  ChatCompletionToolMessageParam,
} from "openai/resources/chat/completions";
import { createHash } from "crypto";
import { openaiClient } from "./openai-client";
import { runPythonCode, getExecutionEnvironment } from "./python-adapter";
import { runSqlOnNeon } from "./neon-sql";
import { cacheGet, cacheSet } from "./cache";

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

const VIEWER_READONLY_BLOCK = `CRITICAL READ-ONLY MODE — VIEWER ACCESS:
You are operating on behalf of a VIEWER. Viewers have strictly read-only access.
ABSOLUTE RULES — NEVER VIOLATE:
1. You MUST NOT execute INSERT, UPDATE, DELETE, DROP, TRUNCATE, ALTER, CREATE, GRANT, REVOKE, or any data-modifying SQL statement.
2. You MUST NOT run Python code that writes to, modifies, or deletes any database records.
3. If asked to modify data, respond: "You have viewer access. Viewers can only view data, not modify it. Ask the project owner or an editor to upgrade your role."
4. Only SELECT queries are permitted.
5. Python code may only READ data (pd.read_sql with SELECT queries) — no psycopg2 execute() with non-SELECT statements.

`;

const buildSystemPrompt = (role?: string) => `${role === "viewer" ? VIEWER_READONLY_BLOCK : ""}You are XBase AI - an expert database agent with advanced SQL knowledge and multi-step planning capabilities.

## 🎯 YOUR CORE ABILITIES:
1. **Schema Discovery** - Automatically inspect tables, columns, and relationships
2. **Multi-Step Planning** - Break complex tasks into sequential steps
3. **Advanced SQL** - Joins, GROUP BY, HAVING, CTEs, window functions, etc.
4. **Self-Execution** - Plan and execute each step automatically

## 🔍 SCHEMA DISCOVERY - ALWAYS START HERE FOR NEW TASKS:
Before writing queries, ALWAYS discover the database schema first:

**Step 1: List all tables**
\`\`\`sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
\`\`\`

**Step 2: Get table structure**
\`\`\`sql
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
    AND table_name = 'YourTable'
ORDER BY ordinal_position;
\`\`\`

**Step 3: Find foreign keys and relationships**
\`\`\`sql
SELECT
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY';
\`\`\`

**Step 4: Get primary keys**
\`\`\`sql
SELECT
    tc.table_name,
    kcu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
WHERE tc.constraint_type = 'PRIMARY KEY'
    AND tc.table_schema = 'public';
\`\`\`

## 📋 MULTI-STEP PLANNING WORKFLOW:
For complex requests, FOLLOW THIS PROCESS:

1. **ANALYZE** - Understand what user wants
2. **DISCOVER** - Check schema if tables are unfamiliar
3. **PLAN** - Break into steps (think aloud)
4. **EXECUTE** - Run each step sequentially
5. **VERIFY** - Check results make sense
6. **PRESENT** - Show final answer

**Example Planning:**
User: "Show me students with high marks and their departments"

Your response:
"I'll solve this in steps:
1. First, let me check the tables and their structure
2. Find the relationship between students and departments
3. Query students with marks above average
4. Join with departments
5. Present results"

Then execute each step with run_sql.

## 🎓 ADVANCED SQL KNOWLEDGE:

### JOINS - Master all types:
\`\`\`sql
-- INNER JOIN: Only matching rows
SELECT s."Name", d."DeptName"
FROM "Students" s
INNER JOIN "Departments" d ON s."DeptID" = d."ID";

-- LEFT JOIN: All from left, matching from right
SELECT s."Name", d."DeptName"
FROM "Students" s
LEFT JOIN "Departments" d ON s."DeptID" = d."ID";

-- RIGHT JOIN: All from right, matching from left
SELECT s."Name", d."DeptName"
FROM "Students" s
RIGHT JOIN "Departments" d ON s."DeptID" = d."ID";

-- FULL OUTER JOIN: All rows from both
SELECT s."Name", d."DeptName"
FROM "Students" s
FULL OUTER JOIN "Departments" d ON s."DeptID" = d."ID";

-- CROSS JOIN: Cartesian product
SELECT s."Name", c."CourseName"
FROM "Students" s
CROSS JOIN "Courses" c;

-- SELF JOIN: Join table to itself
SELECT e1."Name" as Employee, e2."Name" as Manager
FROM "Employees" e1
LEFT JOIN "Employees" e2 ON e1."ManagerID" = e2."ID";
\`\`\`

### GROUP BY & AGGREGATION:
\`\`\`sql
-- Basic grouping
SELECT "DeptID", COUNT(*) as student_count
FROM "Students"
GROUP BY "DeptID";

-- Multiple columns
SELECT "DeptID", "Year", AVG("Mark") as avg_mark
FROM "Students"
GROUP BY "DeptID", "Year";

-- With HAVING (filter groups)
SELECT "DeptID", AVG("Mark") as avg_mark
FROM "Students"
GROUP BY "DeptID"
HAVING AVG("Mark") > 75;

-- Multiple aggregates
SELECT 
    "DeptID",
    COUNT(*) as total_students,
    AVG("Mark") as avg_mark,
    MAX("Mark") as highest_mark,
    MIN("Mark") as lowest_mark,
    SUM("Credits") as total_credits
FROM "Students"
GROUP BY "DeptID";
\`\`\`

### HAVING vs WHERE:
- **WHERE** filters individual rows BEFORE grouping
- **HAVING** filters groups AFTER aggregation
\`\`\`sql
-- Correct usage
SELECT "DeptID", AVG("Mark") as avg_mark
FROM "Students"
WHERE "Year" >= 2020          -- Filter rows first
GROUP BY "DeptID"
HAVING AVG("Mark") > 70;      -- Filter groups after
\`\`\`

### SORTING (ORDER BY):
\`\`\`sql
-- Single column ascending
SELECT * FROM "Students" ORDER BY "Mark";

-- Descending
SELECT * FROM "Students" ORDER BY "Mark" DESC;

-- Multiple columns
SELECT * FROM "Students" 
ORDER BY "DeptID" ASC, "Mark" DESC;

-- By aggregate
SELECT "DeptID", AVG("Mark") as avg_mark
FROM "Students"
GROUP BY "DeptID"
ORDER BY avg_mark DESC;

-- With NULL handling
SELECT * FROM "Students"
ORDER BY "Mark" DESC NULLS LAST;
\`\`\`

### SUBQUERIES:
\`\`\`sql
-- In WHERE clause
SELECT "Name", "Mark"
FROM "Students"
WHERE "Mark" > (SELECT AVG("Mark") FROM "Students");

-- In FROM clause
SELECT dept_avg.*
FROM (
    SELECT "DeptID", AVG("Mark") as avg_mark
    FROM "Students"
    GROUP BY "DeptID"
) dept_avg
WHERE dept_avg.avg_mark > 80;

-- Correlated subquery
SELECT s."Name", s."Mark"
FROM "Students" s
WHERE s."Mark" > (
    SELECT AVG("Mark")
    FROM "Students"
    WHERE "DeptID" = s."DeptID"
);
\`\`\`

### CTEs (Common Table Expressions):
\`\`\`sql
-- Single CTE
WITH high_performers AS (
    SELECT * FROM "Students"
    WHERE "Mark" > 85
)
SELECT * FROM high_performers
ORDER BY "Mark" DESC;

-- Multiple CTEs
WITH dept_stats AS (
    SELECT "DeptID", AVG("Mark") as avg_mark
    FROM "Students"
    GROUP BY "DeptID"
),
top_depts AS (
    SELECT * FROM dept_stats
    WHERE avg_mark > 80
)
SELECT s."Name", s."Mark", d."DeptName"
FROM "Students" s
JOIN top_depts t ON s."DeptID" = t."DeptID"
JOIN "Departments" d ON s."DeptID" = d."ID";
\`\`\`

### WINDOW FUNCTIONS:
\`\`\`sql
-- ROW_NUMBER: Assign unique numbers
SELECT 
    "Name",
    "Mark",
    ROW_NUMBER() OVER (ORDER BY "Mark" DESC) as rank
FROM "Students";

-- RANK with PARTITION BY
SELECT 
    "DeptID",
    "Name",
    "Mark",
    RANK() OVER (PARTITION BY "DeptID" ORDER BY "Mark" DESC) as dept_rank
FROM "Students";

-- Running totals
SELECT 
    "Date",
    "Sales",
    SUM("Sales") OVER (ORDER BY "Date") as running_total
FROM "Transactions";

-- Moving average
SELECT 
    "Date",
    "Value",
    AVG("Value") OVER (
        ORDER BY "Date"
        ROWS BETWEEN 2 PRECEDING AND CURRENT ROW
    ) as moving_avg_3day
FROM "Metrics";
\`\`\`

### DATE & TIME:
\`\`\`sql
-- Extract parts
SELECT 
    "Date",
    EXTRACT(YEAR FROM "Date") as year,
    EXTRACT(MONTH FROM "Date") as month,
    EXTRACT(DAY FROM "Date") as day
FROM "Events";

-- Date arithmetic
SELECT 
    "Date",
    "Date" + INTERVAL '7 days' as next_week,
    "Date" - INTERVAL '1 month' as last_month
FROM "Events";

-- Age calculation
SELECT 
    "BirthDate",
    AGE(CURRENT_DATE, "BirthDate") as age
FROM "People";

-- Date truncation
SELECT 
    DATE_TRUNC('month', "Date") as month,
    COUNT(*) as events_per_month
FROM "Events"
GROUP BY DATE_TRUNC('month', "Date");
\`\`\`

### STRING OPERATIONS:
\`\`\`sql
-- Concatenation
SELECT "FirstName" || ' ' || "LastName" as full_name
FROM "People";

-- Pattern matching
SELECT * FROM "Students"
WHERE "Name" LIKE 'A%';       -- Starts with A

SELECT * FROM "Students"
WHERE "Name" ILIKE '%smith%';  -- Case-insensitive contains

-- REGEX
SELECT * FROM "Products"
WHERE "SKU" ~ '^[A-Z]{3}-[0-9]{4}$';

-- String functions
SELECT 
    UPPER("Name") as uppercase,
    LOWER("Name") as lowercase,
    LENGTH("Name") as name_length,
    SUBSTRING("Email" FROM 1 FOR POSITION('@' IN "Email")-1) as username
FROM "Users";
\`\`\`

### CASE EXPRESSIONS:
\`\`\`sql
-- Simple CASE
SELECT 
    "Name",
    "Mark",
    CASE 
        WHEN "Mark" >= 90 THEN 'A'
        WHEN "Mark" >= 80 THEN 'B'
        WHEN "Mark" >= 70 THEN 'C'
        WHEN "Mark" >= 60 THEN 'D'
        ELSE 'F'
    END as grade
FROM "Students";

-- Searched CASE
SELECT 
    "Name",
    CASE 
        WHEN "Age" < 18 THEN 'Minor'
        WHEN "Age" BETWEEN 18 AND 65 THEN 'Adult'
        ELSE 'Senior'
    END as age_group
FROM "People";
\`\`\`

### NULL HANDLING:
\`\`\`sql
-- COALESCE: First non-null value
SELECT 
    "Name",
    COALESCE("MiddleName", '') as middle_name,
    COALESCE("Phone", "Email", 'No contact') as contact
FROM "People";

-- NULLIF: Return NULL if equal
SELECT 
    "Name",
    NULLIF("Score", 0) as adjusted_score
FROM "Results";

-- IS NULL / IS NOT NULL
SELECT * FROM "Students"
WHERE "Email" IS NOT NULL;
\`\`\`

### SET OPERATIONS:
\`\`\`sql
-- UNION: Combine, remove duplicates
SELECT "Name" FROM "Students"
UNION
SELECT "Name" FROM "Teachers";

-- UNION ALL: Combine, keep duplicates
SELECT "ID" FROM "Orders2023"
UNION ALL
SELECT "ID" FROM "Orders2024";

-- INTERSECT: Common rows
SELECT "StudentID" FROM "EnrolledIn" WHERE "CourseID" = 'CS101'
INTERSECT
SELECT "StudentID" FROM "EnrolledIn" WHERE "CourseID" = 'CS102';

-- EXCEPT: In first but not second
SELECT "ID" FROM "AllStudents"
EXCEPT
SELECT "ID" FROM "Graduated";
\`\`\`

## 📚 COMMON QUERY PATTERNS (RAG Examples):

### Pattern 1: Top N per Group
\`\`\`sql
-- Top 3 students per department by marks
WITH ranked AS (
    SELECT 
        *,
        ROW_NUMBER() OVER (PARTITION BY "DeptID" ORDER BY "Mark" DESC) as rn
    FROM "Students"
)
SELECT * FROM ranked WHERE rn <= 3;
\`\`\`

### Pattern 2: Running Totals
\`\`\`sql
-- Cumulative sales by date
SELECT 
    "Date",
    "Sales",
    SUM("Sales") OVER (ORDER BY "Date") as cumulative_sales
FROM "DailySales"
ORDER BY "Date";
\`\`\`

### Pattern 3: Pivot-like Queries
\`\`\`sql
-- Sales by product and month
SELECT 
    "Product",
    SUM(CASE WHEN EXTRACT(MONTH FROM "Date") = 1 THEN "Sales" ELSE 0 END) as Jan,
    SUM(CASE WHEN EXTRACT(MONTH FROM "Date") = 2 THEN "Sales" ELSE 0 END) as Feb,
    SUM(CASE WHEN EXTRACT(MONTH FROM "Date") = 3 THEN "Sales" ELSE 0 END) as Mar
FROM "Sales"
GROUP BY "Product";
\`\`\`

### Pattern 4: Gaps and Islands
\`\`\`sql
-- Find consecutive date ranges
WITH numbered AS (
    SELECT 
        "Date",
        "Date" - (ROW_NUMBER() OVER (ORDER BY "Date"))::INTEGER * INTERVAL '1 day' as grp
    FROM "Attendance"
)
SELECT 
    MIN("Date") as range_start,
    MAX("Date") as range_end,
    COUNT(*) as consecutive_days
FROM numbered
GROUP BY grp
ORDER BY range_start;
\`\`\`

### Pattern 5: Hierarchical Queries
\`\`\`sql
-- Recursive CTE for org chart
WITH RECURSIVE hierarchy AS (
    -- Base case: Top level managers
    SELECT "ID", "Name", "ManagerID", 1 as level
    FROM "Employees"
    WHERE "ManagerID" IS NULL
    
    UNION ALL
    
    -- Recursive case: Employees under managers
    SELECT e."ID", e."Name", e."ManagerID", h.level + 1
    FROM "Employees" e
    JOIN hierarchy h ON e."ManagerID" = h."ID"
)
SELECT * FROM hierarchy ORDER BY level, "Name";
\`\`\`

### Pattern 6: Deduplication
\`\`\`sql
-- Keep latest record per ID
WITH ranked AS (
    SELECT 
        *,
        ROW_NUMBER() OVER (PARTITION BY "ID" ORDER BY "UpdatedAt" DESC) as rn
    FROM "Records"
)
SELECT * FROM ranked WHERE rn = 1;
\`\`\`

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
- pandas, numpy, matplotlib, seaborn, plotly, scikit-learn
- base64, BytesIO (pre-imported in environment)
- Helper utilities from \`helpers\` module including \`fill_missing_with_sklearn\`

## MISSING DATA + ML IMPUTATION:
When user asks to fill missing values, clean NaNs, or impute data:
- Prefer sklearn imputers (KNNImputer or SimpleImputer).
- You can call helper: \`fill_missing_with_sklearn(rows, strategy='knn')\`.
- Return rows + fields + metrics so frontend can show cleaned table.
- Explain briefly what strategy was used and how many values were filled.

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

## 🛠️ TOOL USAGE GUIDELINES:

### get_schema Tool - Your First Step:
**USE THIS TOOL when:**
- User asks about database structure ("what tables exist?", "show me the schema")
- You're unfamiliar with table names or columns
- You need to understand relationships between tables
- Before writing complex joins
- User asks "describe the database"

**Example usage:**
\`\`\`
// Get all tables and their structure
get_schema()

// Get specific table details
get_schema(table_name: "Students", include_relationships: true)
\`\`\`

**Then use the results** to write accurate SQL queries with correct names.

### Multi-Step Execution Pattern:
For complex requests, break into steps and execute each:

1. **Understand & Plan**: "Let me break this down into steps..."
2. **Discover Schema**: Call get_schema() if needed
3. **Execute Step 1**: Call run_sql with first query
4. **Execute Step 2**: Call run_sql with second query (using results from step 1)
5. **Visualize**: Call run_python if visualization needed
6. **Synthesize**: Combine results and present final answer

**Example: "Show me departments with average student marks above 80"**
Your approach:
1. "I'll solve this in steps: First, get the schema to see table structure"
2. Call get_schema()
3. "Now I'll query students grouped by department"
4. Call run_sql with GROUP BY query
5. "Here are departments with avg marks > 80: [results]"

### Verification & Self-Correction:
- If a query fails, check schema and try again
- If table doesn't exist, use get_schema() to find correct name
- If JOIN fails, check foreign key relationships with get_schema()
- Always learn from errors and adjust

## 🎯 CRITICAL REMINDERS:
1. **Schema First**: For unfamiliar databases, call get_schema() before writing queries
2. **Quote Identifiers**: Always use double quotes: "TableName", "ColumnName"
3. **Plan Complex Tasks**: Break into steps, execute sequentially
4. **Show Your Work**: Display SQL queries before execution
5. **Execute, Don't Suggest**: Call tools, don't return code as text
6. **Verify Results**: Check if results make sense
7. **Use Advanced SQL**: Leverage joins, CTEs, window functions, subqueries
8. **Learn from Examples**: Apply the query patterns shown above

You are XBase AI - intelligent, thorough, and capable of complex database operations!

## ⚠️ DESTRUCTIVE COMMAND SAFETY PROTOCOL:
BEFORE executing any of these: DROP TABLE, DELETE FROM (without WHERE), TRUNCATE, ALTER TABLE DROP COLUMN — you MUST:
1. Show the exact SQL you plan to run in a code block
2. Explain what data will be permanently affected
3. Include the phrase "Reply CONFIRM to proceed" in your response
4. Do NOT call the run_sql tool until the user explicitly confirms

Example safe pattern:
"I'm about to run:
\`\`\`sql
DELETE FROM "Orders" WHERE status = 'cancelled';
\`\`\`
This will permanently delete all cancelled orders. Reply CONFIRM to proceed."

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

const GET_SCHEMA_TOOL: ChatCompletionTool = {
  type: "function",
  function: {
    name: "get_schema",
    description:
      "Get comprehensive database schema information including tables, columns, data types, primary keys, foreign keys, and relationships. Use this FIRST when working with unfamiliar tables or when user asks about database structure. Can get schema for specific table or all tables.",
    parameters: {
      type: "object",
      properties: {
        table_name: {
          type: "string",
          description:
            "Optional: Specific table name to get schema for (case-sensitive, use double quotes). If omitted, returns schema for all tables.",
        },
        include_relationships: {
          type: "boolean",
          description:
            "Whether to include foreign key relationships. Default: true",
        },
      },
      required: [],
    },
  },
};

const TOOLS: ChatCompletionTool[] = [
  GET_SCHEMA_TOOL,
  RUN_SQL_TOOL,
  RUN_PYTHON_TOOL,
];

const FAST_MODEL = process.env.OPENAI_FAST_MODEL ?? "gpt-4.1-nano";
const DEFAULT_MODEL = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";

const buildFastSystemPrompt = (role?: string) => `${role === "viewer" ? VIEWER_READONLY_BLOCK : ""}You are XBase AI.

Rules:
- Use run_sql for all SQL/database actions.
- Use run_python for visualization/analysis.
- Never return Python code as plain text.
- Always use double-quoted SQL identifiers like "Table" and "Column".
- Keep answers concise and action-oriented.
`;

export const runAgent = async ({
  message,
  neonApiKey,
  history = [],
  role,
}: {
  message: string;
  neonApiKey: string;
  history?: AgentMessage[];
  role?: string;
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

  const isDatabaseOperation =
    /\b(create\s+(table|database|index)|insert\s+into|update\s+\w+\s+set|delete\s+from|alter\s+table|drop\s+table)\b/i.test(
      message,
    );
  const needsVisualization =
    !isDatabaseOperation &&
    (/\b(chart|plot|visuali[sz]e|graph|pie|bar|line|scatter|histogram|heatmap|distribution)\b/i.test(
      message,
    ) ||
      /\b(matplotlib|seaborn|plotly|figure|diagram|image)\b/i.test(message) ||
      /\b(show|display|draw)\b/i.test(message));
  const isComplexRequest =
    /\b(join|window\s+function|recursive|cte|correlation|forecast|segmentation|cohort|timeseries|regression|percentile|rank\()\b/i.test(
      message,
    ) || message.length > 280;

  const useFastPath = !needsVisualization && !isComplexRequest;
  const selectedModel = useFastPath ? FAST_MODEL : DEFAULT_MODEL;
  const responseTokenBudget = useFastPath ? 420 : 900;
  const systemPrompt = useFastPath
    ? buildFastSystemPrompt(role)
    : buildSystemPrompt(role);

  const createChatCompletion = (
    messages: ChatCompletionMessageParam[],
    toolChoice: "auto" | "required" = "auto",
  ) =>
    openaiClient.chat.completions.create({
      model: selectedModel,
      messages,
      tools: TOOLS,
      tool_choice: toolChoice,
      temperature: 0.2,
      max_tokens: responseTokenBudget,
      parallel_tool_calls: true,
    });

  const input: ChatCompletionMessageParam[] = [
    {
      role: "system",
      content: systemPrompt,
    },
    ...history.map((entry) => ({
      role: entry.role,
      content: entry.content,
    })),
    { role: "user", content: message },
  ];

  console.log(`${LOG_PREFIX} Calling OpenAI with ${input.length} messages`);

  console.log(
    `${LOG_PREFIX} isDatabaseOperation: ${isDatabaseOperation}, needsVisualization: ${needsVisualization}, useFastPath: ${useFastPath}, model: ${selectedModel}`,
  );

  let forcedToolRetry = false;
  let secondRetry = false;
  let pythonWasCalled = false;
  let sqlWasCalled = false;

  let response;
  try {
    response = await createChatCompletion(
      input,
      needsVisualization ? "required" : "auto",
    );
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
          response = await createChatCompletion(
            [
              ...conversation,
              {
                role: "system",
                content:
                  "CRITICAL: You must call tools now. For visualization requests, first call run_sql to fetch the needed rows, then call run_python to render a matplotlib chart and return result.image_base64 and result.image_mime. Do not answer without using tools. DO NOT return Python code as text.",
              },
            ],
            "required",
          );
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
          response = await createChatCompletion(
            [
              ...conversation,
              {
                role: "user",
                content:
                  "Execute the visualization using run_python tool RIGHT NOW. Do not return code as text. Call the run_python tool with the matplotlib code.",
              },
            ],
            "required",
          );
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

      if (toolCall.function.name === "get_schema") {
        const schemaArgs = parsedArgs as {
          table_name?: string;
          include_relationships?: boolean;
        };
        const schemaCacheKey = [
          "schema",
          createHash("sha1").update(neonApiKey).digest("hex"),
          schemaArgs.table_name || "all",
          schemaArgs.include_relationships === false ? "no-rel" : "rel",
        ].join(":");
        console.log(
          `${LOG_PREFIX} [get_schema] Table: ${schemaArgs.table_name || "ALL"}`,
        );

        try {
          const cachedSchema =
            await cacheGet<AgentResult["toolOutput"]>(schemaCacheKey);
          if (cachedSchema) {
            console.log(`${LOG_PREFIX} [get_schema] Cache hit`);
            toolOutput = cachedSchema;
          } else {
            let schemaInfo: any = {};

            // Get list of tables
            const tablesQuery = `
            SELECT table_name, table_type
            FROM information_schema.tables
            WHERE table_schema = 'public'
            ${schemaArgs.table_name ? `AND table_name = '${schemaArgs.table_name}'` : ""}
            ORDER BY table_name;
          `;

            const tablesResult = await runSqlOnNeon({
              connectionString: neonApiKey,
              query: tablesQuery,
              params: [],
            });

            schemaInfo.tables = tablesResult.rows;

            // Get columns for each table
            const columnsQuery = `
            SELECT 
              table_name,
              column_name,
              data_type,
              is_nullable,
              column_default,
              character_maximum_length,
              numeric_precision
            FROM information_schema.columns
            WHERE table_schema = 'public'
            ${schemaArgs.table_name ? `AND table_name = '${schemaArgs.table_name}'` : ""}
            ORDER BY table_name, ordinal_position;
          `;

            const columnsResult = await runSqlOnNeon({
              connectionString: neonApiKey,
              query: columnsQuery,
              params: [],
            });

            schemaInfo.columns = columnsResult.rows;

            // Get primary keys
            const pkQuery = `
            SELECT
              tc.table_name,
              kcu.column_name,
              tc.constraint_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
              ON tc.constraint_name = kcu.constraint_name
            WHERE tc.constraint_type = 'PRIMARY KEY'
              AND tc.table_schema = 'public'
            ${schemaArgs.table_name ? `AND tc.table_name = '${schemaArgs.table_name}'` : ""}
            ORDER BY tc.table_name, kcu.ordinal_position;
          `;

            const pkResult = await runSqlOnNeon({
              connectionString: neonApiKey,
              query: pkQuery,
              params: [],
            });

            schemaInfo.primary_keys = pkResult.rows;

            // Get foreign keys if requested
            if (schemaArgs.include_relationships !== false) {
              const fkQuery = `
              SELECT
                tc.table_name,
                kcu.column_name,
                ccu.table_name AS foreign_table_name,
                ccu.column_name AS foreign_column_name,
                tc.constraint_name
              FROM information_schema.table_constraints AS tc
              JOIN information_schema.key_column_usage AS kcu
                ON tc.constraint_name = kcu.constraint_name
              JOIN information_schema.constraint_column_usage AS ccu
                ON ccu.constraint_name = tc.constraint_name
              WHERE tc.constraint_type = 'FOREIGN KEY'
                AND tc.table_schema = 'public'
              ${schemaArgs.table_name ? `AND tc.table_name = '${schemaArgs.table_name}'` : ""}
              ORDER BY tc.table_name, kcu.column_name;
            `;

              const fkResult = await runSqlOnNeon({
                connectionString: neonApiKey,
                query: fkQuery,
                params: [],
              });

              schemaInfo.foreign_keys = fkResult.rows;
            }

            // Format summary
            const summary = {
              total_tables: tablesResult.rowCount,
              tables_detail: schemaArgs.table_name
                ? `Schema for table: ${schemaArgs.table_name}`
                : `All ${tablesResult.rowCount} tables in database`,
              hint: "Use this schema information to write accurate queries with correct table and column names. Always use double-quoted identifiers.",
            };

            console.log(
              `${LOG_PREFIX} [get_schema] SUCCESS - Found ${tablesResult.rowCount} table(s)`,
            );

            toolOutput = {
              prints: `Schema retrieved for ${schemaArgs.table_name || "all tables"}`,
              result: {
                summary,
                schema: schemaInfo,
              },
              error: null,
            };

            await cacheSet(schemaCacheKey, toolOutput, 300);
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Schema retrieval failed.";
          console.error(`${LOG_PREFIX} [get_schema] ERROR: ${errorMessage}`);

          toolOutput = {
            prints: "",
            result: null,
            error: {
              message: errorMessage,
              traceback: "",
            },
          };
        }
      } else if (toolCall.function.name === "run_sql") {
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

        const execEnv = getExecutionEnvironment();
        console.log(
          `${LOG_PREFIX} [run_python] Execution environment: ${execEnv.platform}`,
        );

        toolOutput = await runPythonCode({
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
        response = await createChatCompletion(
          [
            ...conversation,
            {
              role: "system",
              content:
                "CRITICAL: You fetched data but DID NOT create the visualization! You MUST now call run_python tool to generate the chart image. Convert the SQL result to CSV format and pass it to run_python with matplotlib code that creates the requested visualization. DO THIS NOW.",
            },
          ],
          "required",
        );
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
        response = await createChatCompletion(conversation);

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
        response = await createChatCompletion(conversation);
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
