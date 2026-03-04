# URGENT FIX - AI Agent Now Executes Code Instead of Returning Text

## Problem Fixed

The AI agent was returning Python code as **text** instead of **executing** it with the `run_python` tool.

## Changes Made

### 1. Enhanced System Prompt (`src/lib/ai-agent.ts`)

Added critical rules at the top:

```
## CRITICAL RULE: NEVER RETURN CODE AS TEXT
**ABSOLUTELY FORBIDDEN:** Do NOT return Python code as text in your response.
**REQUIRED:** You MUST call the run_python tool to execute any code.
**IF** the user mentions visualization, plotting, charting, or analysis → **CALL run_python TOOL IMMEDIATELY**
**NEVER** say "here's the code" or "you can run this" → **EXECUTE IT YOURSELF**
```

### 2. Improved Visualization Detection

Enhanced regex to catch more keywords:

- **Before:** Only matched exact visualization terms
- **Now:** Matches: chart, plot, visualize, graph, show, create, generate, make, draw, display, render, matplotlib, seaborn, plotly, figure, diagram, image

### 3. Double Retry Logic

Added second retry attempt if AI still doesn't call tools:

- **First attempt:** Initial request with tools
- **First retry:** System message forcing tool use
- **Second retry:** User message explicitly demanding tool execution

## How to Test

### Test 1: Direct Visualization Request

```
"Create a line plot of Mark by id from the Students table"
```

**Expected:**
✅ AI calls `run_sql` to fetch data
✅ AI calls `run_python` with matplotlib code
✅ Python executes and generates image
✅ Result shows: image + table + download button

**Should NOT:**
❌ Return Python code as text
❌ Say "here's the code to run"
❌ Skip tool execution

### Test 2: Analysis Request

```
"Analyze the top 10 students by marks and show a bar chart"
```

**Expected:**
✅ Fetches data from Students table
✅ Generates bar chart automatically
✅ Shows visualization + data

### Test 3: Implicit Visualization

```
"Show me the distribution of marks"
```

**Expected:**
✅ Creates histogram or appropriate chart
✅ Executes Python code
✅ Displays result

## Technical Details

### Detection Logic

```typescript
const needsVisualization =
  /\b(chart|plot|visualize|graph|pie|bar|line|scatter|histogram|heatmap|distribution|show|create|generate|make|draw|display|render)\b/i.test(
    message,
  ) || /\b(matplotlib|seaborn|plotly|figure|diagram|image)\b/i.test(message);
```

### Forced Tool Execution

1. If `needsVisualization === true`, set `tool_choice: "required"`
2. If AI returns no tools, retry with strong system message
3. If still no tools, retry with user message demanding execution
4. Maximum 4 tool execution loops

### Retry Messages

**First retry:**

```
"CRITICAL: You must call tools now. For visualization requests, first call run_sql to fetch the needed rows, then call run_python to render a matplotlib chart and return result.image_base64 and result.image_mime. Do not answer without using tools. DO NOT return Python code as text."
```

**Second retry:**

```
"Execute the visualization using run_python tool RIGHT NOW. Do not return code as text. Call the run_python tool with the matplotlib code."
```

## Verification Checklist

After these changes, verify:

- [ ] AI calls `run_python` tool for visualization requests
- [ ] Python code executes in Docker
- [ ] Results include `image_base64` field
- [ ] Frontend displays the generated image
- [ ] JSON data is uploaded to Supabase
- [ ] Image is uploaded to Supabase
- [ ] Download button appears
- [ ] No Python code returned as text in chat

## Next Steps

1. **Test immediately** with a visualization request
2. **Check backend logs** to verify tool calls are happening
3. **Verify Supabase uploads** in the storage buckets
4. **Confirm frontend rendering** of images and tables

## Expected Log Output

You should see in the backend logs:

```
[AI-Agent] Starting agent run
[AI-Agent] User message: Create a line plot...
[AI-Agent] OpenAI response received, finish_reason: tool_calls
[AI-Agent] Tool calls count: 1 (or 2 if SQL + Python)
[AI-Agent] [run_sql] Query: SELECT...
[AI-Agent] [run_sql] SUCCESS - Rows returned: 5
[AI-Agent] [run_python] Code length: 450
[Docker-Python] runPythonInDocker called
[Docker-Python] Docker exit code: 0
[Docker-Python] Parsed successfully
[SendMessage] Supabase upload successful
```

## Troubleshooting

### If AI still returns code as text:

1. Check if `needsVisualization` regex matched (check logs)
2. Verify OpenAI API key is valid
3. Check if model is responding to tool_choice: "required"
4. Increase retry attempts if needed

### If tools are called but no result:

1. Check Docker is running
2. Verify Python code syntax
3. Check Supabase credentials
4. Review backend error logs

## Status

✅ **Fix Applied**
✅ **No TypeScript Errors**
✅ **Ready for Testing**

The system should now **always execute** Python code instead of returning it as text.
