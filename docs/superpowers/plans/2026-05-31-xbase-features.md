# XBase Feature Enhancement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 7 new features to the XBase AI database platform while preserving all existing UI/UX and functionality.

**Architecture:** Two-repo system — `xbase-app` (Next.js 15 + API routes, main frontend) and `xbase-backend` (FastAPI Python execution service). New features extend the existing dialog-based UI in `project-layout.tsx` (1596 lines), add new Next.js API routes under `src/app/api/`, and add new FastAPI endpoints to `main.py`.

**Tech Stack:** Next.js 15, TypeScript 5, React 19, Tailwind CSS 4, shadcn/ui, Framer Motion, FastAPI, scikit-learn, mlxtend, Upstash Redis (cache), Drizzle ORM, Neon PostgreSQL, OpenAI gpt-4.1-mini/nano

---

## Environment & Conventions

- **xbase-app root:** `c:\HARI\ETAIH\xbase-app`
- **xbase-backend root:** `c:\HARI\ETAIH\xbase-backend`
- **Backend URL:** `process.env.NEXT_PUBLIC_BACKEND_URL` (used in `src/lib/python-adapter.ts`)
- **Cache:** `import { cacheGet, cacheSet } from "@/lib/cache"` — Upstash Redis + in-memory fallback
- **DB:** `import { db } from "@/db"` with Drizzle ORM; tables: `projects`, `queryHistory`, `executionResults`, `projectCollaborators`, `projectApiKeys`
- **Auth:** `import { getSessionUserId, getProjectRole, hasWriteAccess } from "@/lib/project-permissions"`
- **UI style:** Dark `#0a0a0a` bg, neon-green (`rgba(74,222,128,...)`) accents, shadcn/ui Dialog with `bg-[#0b0b0b] border-gray-800 text-white rounded-2xl`, Framer Motion animations
- **PostJson helper:** `postJson<T>(url, body)` already defined in `project-layout.tsx` at line ~100
- **Existing dialogs for reference:** Python dialog, SQL dialog, Collaborator dialog — all in `project-layout.tsx`
- **No tests exist** in this repo — skip TDD, write working code directly and verify via `tsc --noEmit`

---

## File Map

| Task | Files Created | Files Modified |
|------|--------------|----------------|
| 1 | `xbase-app/CLAUDE.md`, `xbase-backend/CLAUDE.md` | — |
| 2 | `xbase-backend/smart_fill.py` | `xbase-backend/main.py`, `xbase-backend/requirements.txt` |
| 3 | `xbase-backend/apriori_mining.py` | `xbase-backend/main.py`, `xbase-backend/requirements.txt` |
| 4 | — | `xbase-app/src/app/api/python/execute/route.ts` |
| 5 | `xbase-app/src/app/api/smart-fill/route.ts`, `xbase-app/src/modules/home/smart-fill-dialog.tsx` | `xbase-app/src/modules/home/project-layout.tsx` |
| 6 | `xbase-app/src/app/api/apriori/route.ts`, `xbase-app/src/modules/home/apriori-dialog.tsx` | `xbase-app/src/modules/home/project-layout.tsx` |
| 7 | `xbase-app/src/modules/home/history-panel.tsx` | `xbase-app/src/modules/home/project-layout.tsx` |
| 8 | `xbase-app/src/modules/home/destructive-guard-dialog.tsx` | `xbase-app/src/modules/home/project-layout.tsx`, `xbase-app/src/lib/ai-agent.ts` |
| 9 | `xbase-app/src/modules/home/api-health-dialog.tsx` | `xbase-app/src/modules/home/project-layout.tsx` |

---

## Task 1: CLAUDE.md Documentation

**Files:**
- Create: `c:\HARI\ETAIH\xbase-app\CLAUDE.md`
- Create: `c:\HARI\ETAIH\xbase-backend\CLAUDE.md`

- [ ] **Step 1: Write xbase-app CLAUDE.md**

```markdown
# XBase App — CLAUDE.md

## What This Is
Next.js 15 full-stack application. AI-powered database IDE where users connect PostgreSQL databases, chat with an AI agent that writes and executes SQL/Python, and view results inline.

## Development
```bash
cd c:\HARI\ETAIH\xbase-app
npm run dev        # Start dev server (port 3000, Turbopack)
npm run build      # Production build
npx tsc --noEmit   # Type-check only
```

## Architecture
- **`src/app/`** — Next.js App Router. Pages and API routes.
- **`src/modules/home/`** — Main feature UI. `project-layout.tsx` is the primary component (1600+ lines). `chat-interface.tsx` is the AI chat panel.
- **`src/lib/`** — Business logic: `ai-agent.ts` (OpenAI tool-calling loop), `python-adapter.ts` (calls xbase-backend), `neon-sql.ts` (Neon DB queries), `cache.ts` (Upstash Redis + in-memory).
- **`src/db/`** — Drizzle ORM schema and client.
- **`docker/python/`** — Python execution harness used when running locally via Docker (alternative to xbase-backend).

## Key APIs
| Route | Method | Purpose |
|-------|--------|---------|
| `/api/chat/send-message` | POST | Non-streaming AI chat |
| `/api/chat/send-message-stream` | POST | SSE streaming AI chat |
| `/api/python/execute` | POST | Run Python via xbase-backend |
| `/api/neon/run-sql` | POST | Execute SQL on Neon |
| `/api/neon/list-tables` | GET | List database tables |
| `/api/neon/get-table-data` | GET | Fetch table rows |
| `/api/project/create` | POST | Create project |
| `/api/project/add-collaborator` | POST | Add project collaborator |
| `/api/execution/history` | GET | Query/execution history |
| `/api/smart-fill` | POST | ML prediction for missing values |
| `/api/apriori` | POST | Association rule mining |

## Database Schema (Drizzle)
- `projects` — user projects with Neon connection strings
- `chats` / `messages` — AI conversation history
- `executionResults` — Python/SQL execution log
- `queryHistory` — all queries run per project
- `projectCollaborators` — sharing with roles (owner/editor/viewer)
- `projectApiKeys` — external API keys

## UI Style Guide
- Background: `#0a0a0a` with neon-green accents (`rgba(74,222,128,...)`)
- Dialogs: `bg-[#0b0b0b] border-gray-800 text-white rounded-2xl`
- Buttons: `bg-black/40 border border-gray-800 hover:border-neon-green/60`
- Text: `text-white` primary, `text-zinc-400` secondary, `text-emerald-400` success

## Environment Variables
See `.env.example`. Key vars:
- `NEXT_PUBLIC_BACKEND_URL` — xbase-backend URL
- `DATABASE_URL` — Neon connection string (for Drizzle migrations)
- `OPENAI_API_KEY` — OpenAI API key
- `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` — Caching

## Common Patterns
```typescript
// Calling an API route with auth
const result = await postJson<ResultType>("/api/endpoint", { projectId, ...data });

// Using cache
const cached = await cacheGet<T>("key");
if (!cached) {
  const data = await fetchData();
  await cacheSet("key", data, 300); // 5 min TTL
}

// DB query
const rows = await db.query.tableName.findMany({
  where: eq(table.projectId, projectId),
  orderBy: [desc(table.createdAt)],
});
```
```

- [ ] **Step 2: Write xbase-backend CLAUDE.md**

```markdown
# XBase Backend — CLAUDE.md

## What This Is
FastAPI Python service that executes arbitrary Python code in a subprocess sandbox. Called by xbase-app when the AI agent needs to run Python (data analysis, visualizations, ML).

## Development
```bash
cd c:\HARI\ETAIH\xbase-backend
pip install -r requirements.txt
python main.py        # Start server (port 8000 or $PORT)
```

## Architecture
- **`main.py`** — FastAPI app with CORS. Endpoints: `/`, `/health`, `/execute`, `/smart-fill`, `/apriori`
- **`runner.py`** — Subprocess harness: reads request JSON, executes user code via `exec()`, captures stdout, converts matplotlib figures to base64, outputs JSON
- **`helpers.py`** — Utilities available inside executed code: `fig_to_base64`, `create_visualization_result`, `rows_to_csv`, `format_table_result`, `fill_missing_with_sklearn`
- **`smart_fill.py`** — RandomForest-based column prediction for Smart Fill feature
- **`apriori_mining.py`** — Apriori association rule mining via mlxtend

## Execution Flow
1. Client sends `POST /execute` with `{code, csv, files, timeoutMs}`
2. main.py creates temp dir, writes request.json, copies runner.py + helpers.py
3. Subprocess runs `python runner.py` with `REQUEST_PATH` env var
4. runner.py: reads code, writes CSV to `/work/input.csv`, executes code via `exec()`
5. User code MUST set `result` variable; matplotlib figs auto-converted to base64
6. runner.py outputs JSON to stdout; main.py parses and returns

## Available Libraries (in executed code)
- pandas, numpy, matplotlib, seaborn, plotly
- scikit-learn (RandomForestClassifier, RandomForestRegressor, KNNImputer, etc.)
- mlxtend (apriori, association_rules)

## Endpoints
| Route | Method | Purpose |
|-------|--------|---------|
| `/health` | GET | Health check |
| `/execute` | POST | Execute arbitrary Python |
| `/smart-fill` | POST | Predict missing column values |
| `/apriori` | POST | Run Apriori association mining |

## Deployment
- Render.com: see `render.yaml`
- Python 3.12.8 (see `runtime.txt`)
- Port: `$PORT` env var (default 8000)
```

- [ ] **Step 3: Commit**

```bash
cd c:\HARI\ETAIH\xbase-app && git add CLAUDE.md && git commit -m "docs: add CLAUDE.md for xbase-app"
cd c:\HARI\ETAIH\xbase-backend && git add CLAUDE.md && git commit -m "docs: add CLAUDE.md for xbase-backend"
```

---

## Task 2: xbase-backend — Smart Fill Endpoint

**Files:**
- Create: `c:\HARI\ETAIH\xbase-backend\smart_fill.py`
- Modify: `c:\HARI\ETAIH\xbase-backend\requirements.txt`
- Modify: `c:\HARI\ETAIH\xbase-backend\main.py`

Smart Fill uses all other columns as features to predict missing values in a target column (RandomForestClassifier for categorical, RandomForestRegressor for numeric).

- [ ] **Step 1: Add scikit-learn to requirements.txt**

Replace contents of `requirements.txt` with:
```
fastapi==0.104.1
uvicorn[standard]==0.24.0
pydantic==2.5.0
pandas==2.1.3
numpy==1.26.2
matplotlib==3.8.2
seaborn==0.13.0
plotly==5.18.0
scikit-learn==1.3.2
mlxtend==0.23.1
```

- [ ] **Step 2: Create smart_fill.py**

Create `c:\HARI\ETAIH\xbase-backend\smart_fill.py`:

```python
"""Smart Fill: predict missing values in a target column using other columns as features."""

import pandas as pd
import numpy as np
from typing import Any


def smart_fill_column(
    rows: list[dict],
    target_column: str,
    strategy: str = "auto",
) -> dict[str, Any]:
    """
    Predict missing values in target_column using all other columns as features.
    
    Returns dict with:
      - predictions: list of {row_index, predicted_value} for rows that had NaN target
      - filled_rows: all rows with predictions applied
      - fields: column names
      - metrics: stats about the fill operation
      - model_type: 'classifier' or 'regressor'
    """
    if not rows:
        return {"error": "No data provided"}
    
    df = pd.DataFrame(rows)
    
    if target_column not in df.columns:
        return {"error": f"Column '{target_column}' not found. Available: {list(df.columns)}"}
    
    # Identify rows with missing target
    missing_mask = df[target_column].isna() | (df[target_column] == "") | (df[target_column] == "None")
    n_missing = int(missing_mask.sum())
    
    if n_missing == 0:
        return {
            "predictions": [],
            "filled_rows": rows,
            "fields": list(df.columns),
            "metrics": {"n_missing": 0, "n_filled": 0, "message": "No missing values found"},
            "model_type": "none",
        }
    
    n_known = int((~missing_mask).sum())
    if n_known < 5:
        return {"error": f"Not enough labeled rows to train ({n_known} found, need >= 5)"}
    
    # Determine if target is numeric or categorical
    known_target = df.loc[~missing_mask, target_column]
    is_numeric = pd.to_numeric(known_target, errors="coerce").notna().all()
    model_type = "regressor" if is_numeric else "classifier"
    
    # Prepare features: use all other columns, encode categoricals
    feature_cols = [c for c in df.columns if c != target_column]
    X = df[feature_cols].copy()
    
    # Encode each feature column
    encoders: dict = {}
    for col in feature_cols:
        if X[col].dtype == object or not pd.to_numeric(X[col], errors="coerce").notna().all():
            # Categorical: label-encode (use -1 for NaN)
            categories = X[col].dropna().unique().tolist()
            cat_map = {v: i for i, v in enumerate(categories)}
            X[col] = X[col].map(cat_map).fillna(-1).astype(int)
            encoders[col] = cat_map
        else:
            X[col] = pd.to_numeric(X[col], errors="coerce").fillna(X[col].median() if X[col].notna().any() else 0)
    
    X_known = X[~missing_mask]
    X_unknown = X[missing_mask]
    
    if is_numeric:
        y_known = pd.to_numeric(df.loc[~missing_mask, target_column], errors="coerce")
    else:
        y_known = df.loc[~missing_mask, target_column].astype(str)
    
    # Train model
    from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor
    
    if model_type == "regressor":
        model = RandomForestRegressor(n_estimators=50, random_state=42, n_jobs=-1)
    else:
        model = RandomForestClassifier(n_estimators=50, random_state=42, n_jobs=-1)
    
    model.fit(X_known, y_known)
    
    # Predict
    predictions_raw = model.predict(X_unknown)
    
    # Build predictions list
    missing_indices = df.index[missing_mask].tolist()
    predictions = []
    for idx, pred in zip(missing_indices, predictions_raw):
        val = float(pred) if is_numeric else str(pred)
        predictions.append({"row_index": int(idx), "predicted_value": val})
    
    # Apply predictions to a copy
    filled_df = df.copy()
    for p in predictions:
        filled_df.at[p["row_index"], target_column] = p["predicted_value"]
    
    filled_rows = filled_df.to_dict(orient="records")
    
    # Feature importance
    importance = []
    for col, imp in zip(feature_cols, model.feature_importances_):
        importance.append({"feature": col, "importance": round(float(imp), 4)})
    importance.sort(key=lambda x: x["importance"], reverse=True)
    
    return {
        "predictions": predictions,
        "filled_rows": filled_rows,
        "fields": list(df.columns),
        "metrics": {
            "n_missing": n_missing,
            "n_filled": n_missing,
            "n_training_rows": n_known,
            "model_type": model_type,
            "top_features": importance[:5],
        },
        "model_type": model_type,
    }
```

- [ ] **Step 3: Add /smart-fill endpoint to main.py**

Add after the existing imports in main.py:
```python
from smart_fill import smart_fill_column
```

Add this class and endpoint after the existing `/execute` endpoint:
```python
class SmartFillRequest(BaseModel):
    rows: list[dict]
    target_column: str
    strategy: Optional[str] = "auto"


@app.post("/smart-fill")
async def smart_fill(request: SmartFillRequest):
    """Predict missing values in target_column using other columns as features."""
    try:
        result = smart_fill_column(
            rows=request.rows,
            target_column=request.target_column,
            strategy=request.strategy or "auto",
        )
        if "error" in result:
            raise HTTPException(status_code=400, detail=result["error"])
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

Also update the root endpoint's `endpoints` dict to include `"/smart-fill": "POST - Predict missing column values"`.

- [ ] **Step 4: Commit xbase-backend changes**

```bash
cd c:\HARI\ETAIH\xbase-backend && git add requirements.txt smart_fill.py main.py && git commit -m "feat: add smart-fill endpoint with RandomForest prediction"
```

---

## Task 3: xbase-backend — Apriori Association Mining Endpoint

**Files:**
- Create: `c:\HARI\ETAIH\xbase-backend\apriori_mining.py`
- Modify: `c:\HARI\ETAIH\xbase-backend\main.py` (requirements.txt already updated in Task 2)

- [ ] **Step 1: Create apriori_mining.py**

Create `c:\HARI\ETAIH\xbase-backend\apriori_mining.py`:

```python
"""Apriori association rule mining using mlxtend."""

import pandas as pd
from typing import Any


def run_apriori(
    rows: list[dict],
    columns: list[str],
    min_support: float = 0.1,
    min_confidence: float = 0.5,
    min_lift: float = 1.0,
    max_itemset_len: int = 4,
) -> dict[str, Any]:
    """
    Run Apriori algorithm on selected columns of row data.
    
    Each row is treated as a transaction. Column values are binarized:
    - For numeric columns: value > median → True
    - For categorical: each unique value becomes a binary column (one-hot)
    
    Returns dict with:
      - frequent_itemsets: list of {itemset, support}
      - rules: list of {antecedents, consequents, support, confidence, lift}
      - metrics: summary stats
    """
    if not rows:
        return {"error": "No data provided"}
    
    df = pd.DataFrame(rows)
    
    # Validate columns
    missing_cols = [c for c in columns if c not in df.columns]
    if missing_cols:
        return {"error": f"Columns not found: {missing_cols}. Available: {list(df.columns)}"}
    
    if len(columns) < 2:
        return {"error": "Select at least 2 columns for association mining"}
    
    df_sel = df[columns].copy()
    
    # Build binary transaction matrix
    binary_frames = []
    for col in columns:
        col_data = df_sel[col]
        numeric_data = pd.to_numeric(col_data, errors="coerce")
        
        if numeric_data.notna().mean() > 0.8:
            # Numeric: binarize at median
            median = numeric_data.median()
            binary_col = (numeric_data >= median).rename(f"{col}≥median")
            binary_frames.append(binary_col.astype(bool))
        else:
            # Categorical: one-hot encode (top 10 values to avoid explosion)
            top_vals = col_data.value_counts().head(10).index.tolist()
            for val in top_vals:
                binary_col = (col_data == val).rename(f"{col}={val}")
                binary_frames.append(binary_col.astype(bool))
    
    if not binary_frames:
        return {"error": "Could not build binary transaction matrix from selected columns"}
    
    binary_df = pd.concat(binary_frames, axis=1)
    
    from mlxtend.frequent_patterns import apriori, association_rules
    
    # Run apriori
    frequent_itemsets = apriori(
        binary_df,
        min_support=min_support,
        use_colnames=True,
        max_len=max_itemset_len,
    )
    
    if frequent_itemsets.empty:
        return {
            "frequent_itemsets": [],
            "rules": [],
            "metrics": {
                "n_transactions": len(df),
                "n_items": len(binary_df.columns),
                "n_frequent_itemsets": 0,
                "n_rules": 0,
                "message": f"No frequent itemsets found at min_support={min_support}. Try lowering it.",
            },
        }
    
    # Build rules
    rules_df = association_rules(
        frequent_itemsets,
        metric="confidence",
        min_threshold=min_confidence,
    )
    
    # Filter by lift
    rules_df = rules_df[rules_df["lift"] >= min_lift]
    rules_df = rules_df.sort_values("lift", ascending=False).head(100)
    
    # Serialize
    itemsets_out = []
    for _, row in frequent_itemsets.iterrows():
        itemsets_out.append({
            "itemset": sorted(list(row["itemsets"])),
            "support": round(float(row["support"]), 4),
        })
    itemsets_out.sort(key=lambda x: x["support"], reverse=True)
    
    rules_out = []
    for _, row in rules_df.iterrows():
        rules_out.append({
            "antecedents": sorted(list(row["antecedents"])),
            "consequents": sorted(list(row["consequents"])),
            "support": round(float(row["support"]), 4),
            "confidence": round(float(row["confidence"]), 4),
            "lift": round(float(row["lift"]), 4),
        })
    
    return {
        "frequent_itemsets": itemsets_out[:50],
        "rules": rules_out,
        "metrics": {
            "n_transactions": len(df),
            "n_items": len(binary_df.columns),
            "n_frequent_itemsets": len(frequent_itemsets),
            "n_rules": len(rules_df),
            "min_support": min_support,
            "min_confidence": min_confidence,
        },
    }
```

- [ ] **Step 2: Add /apriori endpoint to main.py**

Add after the smart_fill import:
```python
from apriori_mining import run_apriori
```

Add this class and endpoint after the `/smart-fill` endpoint:
```python
class AprioriRequest(BaseModel):
    rows: list[dict]
    columns: list[str]
    min_support: Optional[float] = 0.1
    min_confidence: Optional[float] = 0.5
    min_lift: Optional[float] = 1.0
    max_itemset_len: Optional[int] = 4


@app.post("/apriori")
async def run_apriori_endpoint(request: AprioriRequest):
    """Run Apriori association rule mining on selected columns."""
    try:
        result = run_apriori(
            rows=request.rows,
            columns=request.columns,
            min_support=request.min_support or 0.1,
            min_confidence=request.min_confidence or 0.5,
            min_lift=request.min_lift or 1.0,
            max_itemset_len=request.max_itemset_len or 4,
        )
        if "error" in result:
            raise HTTPException(status_code=400, detail=result["error"])
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

Also add `"/apriori": "POST - Association rule mining (Apriori)"` to the root endpoint's endpoints dict.

- [ ] **Step 3: Commit**

```bash
cd c:\HARI\ETAIH\xbase-backend && git add apriori_mining.py main.py && git commit -m "feat: add apriori association mining endpoint"
```

---

## Task 4: Python Execution Caching

**Files:**
- Modify: `c:\HARI\ETAIH\xbase-app\src\app\api\python\execute\route.ts`

Cache Python execution results by a hash of (code + inputData). TTL 10 minutes. Skips cache for executions with errors.

- [ ] **Step 1: Add caching to execute route**

Replace the file content with:

```typescript
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { executionResults, projects, queryHistory } from "@/db/schema";
import { eq } from "drizzle-orm";
import { runPythonCode } from "@/lib/python-adapter";
import { nanoid } from "nanoid";
import { createHash } from "crypto";
import {
  getProjectRole,
  getSessionUserId,
  hasWriteAccess,
} from "@/lib/project-permissions";
import { cacheGet, cacheSet } from "@/lib/cache";

const RunPythonSchema = z.object({
  projectId: z.string().min(1),
  code: z.string().min(1),
  inputData: z.unknown().optional(),
  timeoutMs: z.coerce.number().int().min(1000).max(60000).optional(),
});

function buildCacheKey(code: string, inputData: unknown): string {
  const payload = JSON.stringify({ code, inputData: inputData ?? null });
  return "py:" + createHash("sha1").update(payload).digest("hex");
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const input = RunPythonSchema.parse(body);

    const sessionUserId = await getSessionUserId();
    if (!sessionUserId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    const role = await getProjectRole(input.projectId, sessionUserId);
    if (!role) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }
    if (!hasWriteAccess(role)) {
      return NextResponse.json(
        { message: "Read-only access for this project." },
        { status: 403 },
      );
    }

    const project = await db.query.projects.findFirst({
      where: eq(projects.id, input.projectId),
    });

    if (!project?.neonApiKey) {
      return NextResponse.json(
        { message: "Missing Neon connection string for this project." },
        { status: 400 },
      );
    }

    // Check cache before execution
    const cacheKey = buildCacheKey(input.code, input.inputData);
    const cached = await cacheGet<ReturnType<typeof runPythonCode> extends Promise<infer T> ? T : never>(cacheKey);
    if (cached && !cached.error) {
      return NextResponse.json(cached);
    }

    const historyId = nanoid();
    await db.insert(queryHistory).values({
      id: historyId,
      projectId: input.projectId,
      userId: sessionUserId,
      query: input.code,
      type: "python",
    });

    const result = await runPythonCode({
      code: input.code,
      inputData: input.inputData ?? null,
      timeoutMs: input.timeoutMs ?? 20000,
    });

    const status = result.error ? "error" : "success";
    await db.insert(executionResults).values({
      id: nanoid(),
      type: "python",
      status,
      errorMessage: result.error?.message ?? null,
      executionJson:
        result.result ??
        (result.error ? { error: result.error } : { output: null }),
      stdout: result.prints ?? null,
    });

    // Cache successful results for 10 minutes
    if (!result.error) {
      await cacheSet(cacheKey, result, 600);
    }

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Invalid request payload", issues: error.issues },
        { status: 400 },
      );
    }
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Type-check**

```bash
cd c:\HARI\ETAIH\xbase-app && npx tsc --noEmit 2>&1 | head -30
```

If there are type errors on the cache generic, simplify to:
```typescript
const cached = await cacheGet<{ prints: string; result: unknown; error: { message: string; traceback: string } | null }>(cacheKey);
```

- [ ] **Step 3: Commit**

```bash
cd c:\HARI\ETAIH\xbase-app && git add src/app/api/python/execute/route.ts && git commit -m "feat: add result caching to Python execution endpoint (10min TTL)"
```

---

## Task 5: Smart Fill Feature — API Route + Dialog

**Files:**
- Create: `c:\HARI\ETAIH\xbase-app\src\app\api\smart-fill\route.ts`
- Create: `c:\HARI\ETAIH\xbase-app\src\modules\home\smart-fill-dialog.tsx`
- Modify: `c:\HARI\ETAIH\xbase-app\src\modules\home\project-layout.tsx`

### Step 5a: API Route

- [ ] **Step 1: Create src/app/api/smart-fill/route.ts**

```typescript
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getProjectRole, getSessionUserId, hasWriteAccess } from "@/lib/project-permissions";

const SmartFillSchema = z.object({
  projectId: z.string().min(1),
  rows: z.array(z.record(z.unknown())),
  targetColumn: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const input = SmartFillSchema.parse(body);

    const sessionUserId = await getSessionUserId();
    if (!sessionUserId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    const role = await getProjectRole(input.projectId, sessionUserId);
    if (!role || !hasWriteAccess(role)) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
    if (!backendUrl) {
      return NextResponse.json({ message: "Backend URL not configured" }, { status: 500 });
    }

    const res = await fetch(`${backendUrl}/smart-fill`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rows: input.rows,
        target_column: input.targetColumn,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Backend error" }));
      return NextResponse.json({ message: err.detail || "Smart fill failed" }, { status: res.status });
    }

    const result = await res.json();
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "Invalid request", issues: error.issues }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ message }, { status: 500 });
  }
}
```

### Step 5b: Smart Fill Dialog Component

- [ ] **Step 2: Create src/modules/home/smart-fill-dialog.tsx**

```tsx
"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, CheckCircle2, TrendingUp } from "lucide-react";
import { toast } from "sonner";

interface Prediction {
  row_index: number;
  predicted_value: string | number;
}

interface SmartFillResult {
  predictions: Prediction[];
  filled_rows: Record<string, unknown>[];
  fields: string[];
  metrics: {
    n_missing: number;
    n_filled: number;
    n_training_rows: number;
    model_type: string;
    top_features: Array<{ feature: string; importance: number }>;
    message?: string;
  };
  model_type: string;
}

interface SmartFillDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projectId: string;
  rows: Record<string, unknown>[];
  columns: string[];
  tableName: string;
}

export function SmartFillDialog({
  open,
  onOpenChange,
  projectId,
  rows,
  columns,
  tableName,
}: SmartFillDialogProps) {
  const [targetColumn, setTargetColumn] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SmartFillResult | null>(null);

  const handleRun = async () => {
    if (!targetColumn) {
      toast.error("Select a target column first");
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/smart-fill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, rows, targetColumn }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Smart fill failed");
      setResult(data);
      if (data.metrics?.n_filled > 0) {
        toast.success(`Predicted ${data.metrics.n_filled} missing values`);
      } else {
        toast.info(data.metrics?.message || "No missing values found");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Smart fill failed");
    } finally {
      setLoading(false);
    }
  };

  const handleCopySQL = () => {
    if (!result || result.predictions.length === 0) return;
    const lines = result.predictions.map((p) => {
      const val =
        typeof p.predicted_value === "string"
          ? `'${p.predicted_value.replace(/'/g, "''")}'`
          : p.predicted_value;
      return `  WHEN ctid = (SELECT ctid FROM "${tableName}" OFFSET ${p.row_index} LIMIT 1) THEN ${val}`;
    });
    const sql = `UPDATE "${tableName}" SET "${targetColumn}" = CASE\n${lines.join("\n")}\nEND\nWHERE "${targetColumn}" IS NULL;`;
    navigator.clipboard.writeText(sql);
    toast.success("SQL UPDATE copied to clipboard");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0b0b0b] border-gray-800 text-white sm:max-w-2xl shadow-2xl p-0 overflow-hidden rounded-2xl">
        <div className="h-1 w-full bg-gradient-to-r from-transparent via-neon-green to-transparent opacity-50 absolute top-0 left-0" />
        <div className="p-6">
          <DialogHeader className="mb-5">
            <DialogTitle className="text-xl font-bold text-white flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-neon-green" />
              Smart Fill — AI Prediction
            </DialogTitle>
            <p className="text-sm text-zinc-400 mt-1">
              Select a column with missing values. XBase will train a model using the other columns to predict the unknown values.
            </p>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-xs text-zinc-400 mb-1.5 block">Target Column (has missing values)</label>
              <Select value={targetColumn} onValueChange={setTargetColumn}>
                <SelectTrigger className="bg-black/40 border-gray-700 text-white">
                  <SelectValue placeholder="Select column to predict..." />
                </SelectTrigger>
                <SelectContent className="bg-[#111] border-gray-700 text-white">
                  {columns.map((col) => (
                    <SelectItem key={col} value={col} className="hover:bg-white/5">
                      {col}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <p className="text-xs text-zinc-500">{rows.length} rows · {columns.length} features</p>
              <Button
                onClick={handleRun}
                disabled={loading || !targetColumn}
                className="bg-neon-green/10 border border-neon-green/40 text-neon-green hover:bg-neon-green/20 hover:border-neon-green/60"
              >
                {loading ? (
                  <><Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> Predicting...</>
                ) : (
                  <><Sparkles className="h-3.5 w-3.5 mr-2" /> Run Smart Fill</>
                )}
              </Button>
            </div>

            {result && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-3"
              >
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-black/30 border border-white/10 rounded-lg p-3 text-center">
                    <div className="text-lg font-bold text-neon-green">{result.metrics.n_filled}</div>
                    <div className="text-xs text-zinc-400">Values Filled</div>
                  </div>
                  <div className="bg-black/30 border border-white/10 rounded-lg p-3 text-center">
                    <div className="text-lg font-bold text-white">{result.metrics.n_training_rows}</div>
                    <div className="text-xs text-zinc-400">Training Rows</div>
                  </div>
                  <div className="bg-black/30 border border-white/10 rounded-lg p-3 text-center">
                    <div className="text-sm font-bold text-blue-400 capitalize">{result.model_type}</div>
                    <div className="text-xs text-zinc-400">Model Type</div>
                  </div>
                </div>

                {result.metrics.top_features && result.metrics.top_features.length > 0 && (
                  <div className="bg-black/20 border border-white/10 rounded-lg p-3">
                    <div className="flex items-center gap-1.5 mb-2">
                      <TrendingUp className="h-3.5 w-3.5 text-zinc-400" />
                      <span className="text-xs text-zinc-400 font-medium">Top Predictive Features</span>
                    </div>
                    <div className="space-y-1.5">
                      {result.metrics.top_features.map((f) => (
                        <div key={f.feature} className="flex items-center gap-2">
                          <span className="text-xs text-zinc-300 w-24 truncate">{f.feature}</span>
                          <div className="flex-1 bg-white/5 rounded-full h-1.5">
                            <div
                              className="bg-neon-green/60 h-1.5 rounded-full"
                              style={{ width: `${f.importance * 100}%` }}
                            />
                          </div>
                          <span className="text-xs text-zinc-500">{(f.importance * 100).toFixed(1)}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {result.predictions.length > 0 && (
                  <div className="bg-black/20 border border-white/10 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-zinc-400 font-medium">Predicted Values Preview</span>
                      <Button
                        size="sm"
                        onClick={handleCopySQL}
                        className="h-6 text-xs bg-black/40 border border-gray-700 text-zinc-300 hover:border-neon-green/40"
                      >
                        Copy SQL UPDATE
                      </Button>
                    </div>
                    <div className="max-h-36 overflow-y-auto space-y-1">
                      {result.predictions.slice(0, 20).map((p) => (
                        <div key={p.row_index} className="flex items-center gap-2 text-xs">
                          <Badge variant="outline" className="text-zinc-500 border-gray-700 text-xs py-0">Row {p.row_index}</Badge>
                          <span className="text-neon-green font-mono">{String(p.predicted_value)}</span>
                        </div>
                      ))}
                      {result.predictions.length > 20 && (
                        <p className="text-xs text-zinc-500">…and {result.predictions.length - 20} more</p>
                      )}
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

### Step 5c: Wire into project-layout.tsx

- [ ] **Step 3: Add SmartFillDialog to project-layout.tsx**

In `src/modules/home/project-layout.tsx`:

1. Add import at top (after existing imports):
```typescript
import { SmartFillDialog } from "./smart-fill-dialog";
```

2. Add state variable (near other dialog states, around line 200):
```typescript
const [smartFillOpen, setSmartFillOpen] = useState(false);
```

3. Add the SmartFillDialog component at the end of the JSX return (before the final closing `</div>`):
```tsx
<SmartFillDialog
  open={smartFillOpen}
  onOpenChange={setSmartFillOpen}
  projectId={projectId ?? ""}
  rows={tableRows ?? []}
  columns={tableColumns ?? []}
  tableName={selectedTable ?? ""}
/>
```

4. Find the existing ML imputation button (search for `handleRunMlImputation`) and add a Smart Fill button next to it:
```tsx
<Button
  size="sm"
  onClick={() => {
    if (!selectedTable || !tableRows?.length) {
      toast.error("Load a table first");
      return;
    }
    setSmartFillOpen(true);
  }}
  className="h-7 text-xs bg-black/30 border border-gray-700 text-zinc-300 hover:border-neon-green/40 hover:text-neon-green gap-1"
>
  <Sparkles className="h-3 w-3" />
  Smart Fill
</Button>
```

Note: `tableColumns` should already be derived from `tableRows` in the component. If it doesn't exist, derive it: 
```typescript
const tableColumns = tableRows && tableRows.length > 0 ? Object.keys(tableRows[0]) : [];
```

- [ ] **Step 4: Type-check**

```bash
cd c:\HARI\ETAIH\xbase-app && npx tsc --noEmit 2>&1 | head -40
```

Fix any type errors before proceeding.

- [ ] **Step 5: Commit**

```bash
cd c:\HARI\ETAIH\xbase-app && git add src/app/api/smart-fill/route.ts src/modules/home/smart-fill-dialog.tsx src/modules/home/project-layout.tsx && git commit -m "feat: add Smart Fill dialog with RandomForest column prediction"
```

---

## Task 6: Apriori Association Mining — API Route + Dialog

**Files:**
- Create: `c:\HARI\ETAIH\xbase-app\src\app\api\apriori\route.ts`
- Create: `c:\HARI\ETAIH\xbase-app\src\modules\home\apriori-dialog.tsx`
- Modify: `c:\HARI\ETAIH\xbase-app\src\modules\home\project-layout.tsx`

### Step 6a: API Route

- [ ] **Step 1: Create src/app/api/apriori/route.ts**

```typescript
import { NextResponse } from "next/server";
import { z } from "zod";
import { getProjectRole, getSessionUserId } from "@/lib/project-permissions";

const AprioriSchema = z.object({
  projectId: z.string().min(1),
  rows: z.array(z.record(z.unknown())),
  columns: z.array(z.string()).min(2),
  minSupport: z.number().min(0.01).max(1).default(0.1),
  minConfidence: z.number().min(0.01).max(1).default(0.5),
  minLift: z.number().min(0).default(1.0),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const input = AprioriSchema.parse(body);

    const sessionUserId = await getSessionUserId();
    if (!sessionUserId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    const role = await getProjectRole(input.projectId, sessionUserId);
    if (!role) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
    if (!backendUrl) {
      return NextResponse.json({ message: "Backend URL not configured" }, { status: 500 });
    }

    const res = await fetch(`${backendUrl}/apriori`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rows: input.rows,
        columns: input.columns,
        min_support: input.minSupport,
        min_confidence: input.minConfidence,
        min_lift: input.minLift,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Backend error" }));
      return NextResponse.json({ message: err.detail || "Apriori failed" }, { status: res.status });
    }

    const result = await res.json();
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "Invalid request", issues: error.issues }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ message }, { status: 500 });
  }
}
```

### Step 6b: Apriori Dialog Component

- [ ] **Step 2: Create src/modules/home/apriori-dialog.tsx**

```tsx
"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { GitBranch, Loader2, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface AssociationRule {
  antecedents: string[];
  consequents: string[];
  support: number;
  confidence: number;
  lift: number;
}

interface AprioriResult {
  frequent_itemsets: Array<{ itemset: string[]; support: number }>;
  rules: AssociationRule[];
  metrics: {
    n_transactions: number;
    n_items: number;
    n_frequent_itemsets: number;
    n_rules: number;
    message?: string;
  };
}

interface AprioriDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projectId: string;
  rows: Record<string, unknown>[];
  columns: string[];
}

export function AprioriDialog({
  open,
  onOpenChange,
  projectId,
  rows,
  columns,
}: AprioriDialogProps) {
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [minSupport, setMinSupport] = useState(0.1);
  const [minConfidence, setMinConfidence] = useState(0.5);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AprioriResult | null>(null);
  const [activeTab, setActiveTab] = useState<"rules" | "itemsets">("rules");

  const toggleColumn = (col: string) => {
    setSelectedColumns((prev) =>
      prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]
    );
  };

  const handleRun = async () => {
    if (selectedColumns.length < 2) {
      toast.error("Select at least 2 columns");
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/apriori", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          rows,
          columns: selectedColumns,
          minSupport,
          minConfidence,
          minLift: 1.0,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Apriori failed");
      setResult(data);
      toast.success(`Found ${data.metrics.n_rules} association rules`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Apriori failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0b0b0b] border-gray-800 text-white sm:max-w-3xl shadow-2xl p-0 overflow-hidden rounded-2xl max-h-[85vh] flex flex-col">
        <div className="h-1 w-full bg-gradient-to-r from-transparent via-purple-400 to-transparent opacity-50 absolute top-0 left-0" />
        <div className="p-6 overflow-y-auto flex-1">
          <DialogHeader className="mb-5">
            <DialogTitle className="text-xl font-bold text-white flex items-center gap-2">
              <GitBranch className="h-5 w-5 text-purple-400" />
              Association Mining (Apriori)
            </DialogTitle>
            <p className="text-sm text-zinc-400 mt-1">
              Discover patterns and associations between values in your data.
            </p>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-zinc-400 mb-2 block">Select Columns ({selectedColumns.length} selected)</label>
              <div className="bg-black/20 border border-white/10 rounded-lg p-3 max-h-48 overflow-y-auto space-y-1.5">
                {columns.map((col) => (
                  <label key={col} className="flex items-center gap-2 cursor-pointer hover:bg-white/5 rounded px-1 py-0.5">
                    <Checkbox
                      checked={selectedColumns.includes(col)}
                      onCheckedChange={() => toggleColumn(col)}
                      className="border-gray-600"
                    />
                    <span className="text-xs text-zinc-300 truncate">{col}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-zinc-400 mb-2 block">
                  Min Support: <span className="text-white font-mono">{minSupport.toFixed(2)}</span>
                </label>
                <Slider
                  value={[minSupport]}
                  onValueChange={([v]) => setMinSupport(v)}
                  min={0.01}
                  max={0.9}
                  step={0.01}
                  className="w-full"
                />
                <p className="text-xs text-zinc-600 mt-1">Fraction of rows that must contain the itemset</p>
              </div>
              <div>
                <label className="text-xs text-zinc-400 mb-2 block">
                  Min Confidence: <span className="text-white font-mono">{minConfidence.toFixed(2)}</span>
                </label>
                <Slider
                  value={[minConfidence]}
                  onValueChange={([v]) => setMinConfidence(v)}
                  min={0.01}
                  max={1.0}
                  step={0.01}
                  className="w-full"
                />
                <p className="text-xs text-zinc-600 mt-1">How often the rule is correct when antecedent holds</p>
              </div>

              <Button
                onClick={handleRun}
                disabled={loading || selectedColumns.length < 2}
                className="w-full bg-purple-500/10 border border-purple-500/40 text-purple-300 hover:bg-purple-500/20 hover:border-purple-400/60"
              >
                {loading ? (
                  <><Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> Mining...</>
                ) : (
                  <><GitBranch className="h-3.5 w-3.5 mr-2" /> Run Apriori</>
                )}
              </Button>
            </div>
          </div>

          {result && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 space-y-3"
            >
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: "Transactions", value: result.metrics.n_transactions },
                  { label: "Items", value: result.metrics.n_items },
                  { label: "Itemsets", value: result.metrics.n_frequent_itemsets },
                  { label: "Rules", value: result.metrics.n_rules, accent: true },
                ].map((m) => (
                  <div key={m.label} className="bg-black/30 border border-white/10 rounded-lg p-2.5 text-center">
                    <div className={`text-lg font-bold ${m.accent ? "text-purple-400" : "text-white"}`}>{m.value}</div>
                    <div className="text-xs text-zinc-500">{m.label}</div>
                  </div>
                ))}
              </div>

              {result.metrics.message && (
                <p className="text-xs text-yellow-400 bg-yellow-400/10 border border-yellow-400/20 rounded-lg p-2.5">{result.metrics.message}</p>
              )}

              <div className="flex gap-2">
                {(["rules", "itemsets"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`text-xs px-3 py-1.5 rounded-lg border transition-colors capitalize ${activeTab === tab ? "bg-purple-500/20 border-purple-500/40 text-purple-300" : "bg-black/20 border-white/10 text-zinc-400 hover:border-white/20"}`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              {activeTab === "rules" && result.rules.length > 0 && (
                <div className="border border-white/10 rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                  <Table className="text-xs">
                    <TableHeader>
                      <TableRow className="border-white/10">
                        <TableHead className="text-zinc-400 bg-black/40">If</TableHead>
                        <TableHead className="text-zinc-400 bg-black/40 w-6"></TableHead>
                        <TableHead className="text-zinc-400 bg-black/40">Then</TableHead>
                        <TableHead className="text-zinc-400 bg-black/40">Support</TableHead>
                        <TableHead className="text-zinc-400 bg-black/40">Confidence</TableHead>
                        <TableHead className="text-zinc-400 bg-black/40">Lift</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {result.rules.map((rule, i) => (
                        <TableRow key={i} className="border-white/5">
                          <TableCell className="text-zinc-200">{rule.antecedents.join(", ")}</TableCell>
                          <TableCell><ArrowRight className="h-3 w-3 text-zinc-600" /></TableCell>
                          <TableCell className="text-purple-300">{rule.consequents.join(", ")}</TableCell>
                          <TableCell className="text-zinc-400 font-mono">{(rule.support * 100).toFixed(1)}%</TableCell>
                          <TableCell className="text-zinc-400 font-mono">{(rule.confidence * 100).toFixed(1)}%</TableCell>
                          <TableCell className="font-mono" style={{ color: rule.lift > 2 ? "#4ade80" : rule.lift > 1.5 ? "#fbbf24" : "#9ca3af" }}>
                            {rule.lift.toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {activeTab === "itemsets" && result.frequent_itemsets.length > 0 && (
                <div className="max-h-64 overflow-y-auto space-y-1.5">
                  {result.frequent_itemsets.slice(0, 30).map((is, i) => (
                    <div key={i} className="flex items-center justify-between bg-black/20 border border-white/5 rounded-lg px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {is.itemset.map((item) => (
                          <Badge key={item} variant="outline" className="text-xs border-gray-700 text-zinc-300">{item}</Badge>
                        ))}
                      </div>
                      <span className="text-xs text-zinc-500 font-mono ml-2">{(is.support * 100).toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

### Step 6c: Wire into project-layout.tsx

- [ ] **Step 3: Add AprioriDialog to project-layout.tsx**

1. Add import:
```typescript
import { AprioriDialog } from "./apriori-dialog";
```

2. Add state:
```typescript
const [aprioriOpen, setAprioriOpen] = useState(false);
```

3. Add dialog component in JSX (after SmartFillDialog):
```tsx
<AprioriDialog
  open={aprioriOpen}
  onOpenChange={setAprioriOpen}
  projectId={projectId ?? ""}
  rows={tableRows ?? []}
  columns={tableColumns ?? []}
/>
```

4. Add Apriori button next to the Smart Fill button:
```tsx
<Button
  size="sm"
  onClick={() => {
    if (!selectedTable || !tableRows?.length) {
      toast.error("Load a table first");
      return;
    }
    setAprioriOpen(true);
  }}
  className="h-7 text-xs bg-black/30 border border-gray-700 text-zinc-300 hover:border-purple-400/40 hover:text-purple-300 gap-1"
>
  <GitBranch className="h-3 w-3" />
  Association Mining
</Button>
```

5. Add `GitBranch` to the lucide-react import.

- [ ] **Step 4: Type-check + Commit**

```bash
cd c:\HARI\ETAIH\xbase-app && npx tsc --noEmit 2>&1 | head -30
git add src/app/api/apriori/route.ts src/modules/home/apriori-dialog.tsx src/modules/home/project-layout.tsx && git commit -m "feat: add Apriori association mining dialog"
```

---

## Task 7: Execution History Panel + Save Button

**Files:**
- Create: `c:\HARI\ETAIH\xbase-app\src\modules\home\history-panel.tsx`
- Modify: `c:\HARI\ETAIH\xbase-app\src\modules\home\project-layout.tsx`

The history API (`GET /api/execution/history?projectId=...`) already exists and returns `queryHistory` rows with `{id, projectId, userId, query, type, createdAt}`.

- [ ] **Step 1: Create src/modules/home/history-panel.tsx**

```tsx
"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { History, Copy, Terminal, Database, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";

interface HistoryEntry {
  id: string;
  query: string;
  type: "python" | "sql";
  createdAt: string;
}

interface HistoryPanelProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projectId: string;
  onLoadQuery?: (query: string, type: "python" | "sql") => void;
}

export function HistoryPanel({
  open,
  onOpenChange,
  projectId,
  onLoadQuery,
}: HistoryPanelProps) {
  const [filter, setFilter] = useState<"all" | "python" | "sql">("all");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["history", projectId],
    queryFn: async () => {
      const res = await fetch(`/api/execution/history?projectId=${encodeURIComponent(projectId)}&limit=100`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to fetch history");
      return json.data as HistoryEntry[];
    },
    enabled: open && !!projectId,
  });

  const filtered = (data ?? []).filter(
    (e) => filter === "all" || e.type === filter
  );

  const handleCopy = (query: string) => {
    navigator.clipboard.writeText(query);
    toast.success("Copied to clipboard");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0b0b0b] border-gray-800 text-white sm:max-w-2xl shadow-2xl p-0 overflow-hidden rounded-2xl max-h-[80vh] flex flex-col">
        <div className="h-1 w-full bg-gradient-to-r from-transparent via-amber-400 to-transparent opacity-50 absolute top-0 left-0" />
        <div className="p-6 flex-shrink-0">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-white flex items-center gap-2">
              <History className="h-5 w-5 text-amber-400" />
              Query History
            </DialogTitle>
          </DialogHeader>
          <div className="flex items-center gap-2 mt-4">
            {(["all", "python", "sql"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setFilter(t)}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-colors capitalize ${filter === t ? "bg-amber-500/20 border-amber-500/40 text-amber-300" : "bg-black/20 border-white/10 text-zinc-400 hover:border-white/20"}`}
              >
                {t}
              </button>
            ))}
            <button
              onClick={() => refetch()}
              className="ml-auto text-zinc-500 hover:text-white transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-8 text-zinc-500 text-sm">No history yet</div>
          ) : (
            <div className="space-y-2">
              {filtered.map((entry) => (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="bg-black/20 border border-white/10 rounded-lg p-3 hover:border-white/20 transition-colors group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge
                        variant="outline"
                        className={`text-xs border flex-shrink-0 ${entry.type === "python" ? "border-blue-500/40 text-blue-400" : "border-orange-500/40 text-orange-400"}`}
                      >
                        {entry.type === "python" ? (
                          <Terminal className="h-2.5 w-2.5 mr-1" />
                        ) : (
                          <Database className="h-2.5 w-2.5 mr-1" />
                        )}
                        {entry.type.toUpperCase()}
                      </Badge>
                      <span className="text-xs text-zinc-500 flex-shrink-0">
                        {formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                      <Button
                        size="icon"
                        className="h-6 w-6 bg-black/40 border border-gray-700 text-zinc-400 hover:text-white"
                        onClick={() => handleCopy(entry.query)}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                      {onLoadQuery && (
                        <Button
                          size="sm"
                          className="h-6 text-xs bg-black/40 border border-gray-700 text-zinc-400 hover:text-neon-green hover:border-neon-green/40"
                          onClick={() => {
                            onLoadQuery(entry.query, entry.type);
                            onOpenChange(false);
                          }}
                        >
                          Load
                        </Button>
                      )}
                    </div>
                  </div>
                  <pre className="text-xs text-zinc-300 mt-2 whitespace-pre-wrap line-clamp-3 font-mono leading-relaxed">
                    {entry.query}
                  </pre>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Wire HistoryPanel into project-layout.tsx**

1. Add import:
```typescript
import { HistoryPanel } from "./history-panel";
```

2. Add state:
```typescript
const [historyOpen, setHistoryOpen] = useState(false);
```

3. Add dialog in JSX:
```tsx
<HistoryPanel
  open={historyOpen}
  onOpenChange={setHistoryOpen}
  projectId={projectId ?? ""}
  onLoadQuery={(query, type) => {
    if (type === "python") {
      setPythonCode(query);
      setPythonDialogOpen(true);
    } else {
      setSqlQuery(query);
      setSqlDialogOpen(true);
    }
  }}
/>
```

4. Add History button to toolbar (near the Python/SQL run buttons):
```tsx
<Button
  size="sm"
  onClick={() => setHistoryOpen(true)}
  className="h-7 text-xs bg-black/30 border border-gray-700 text-zinc-300 hover:border-amber-400/40 hover:text-amber-300 gap-1"
>
  <History className="h-3 w-3" />
  History
</Button>
```

5. Add `History` to lucide-react imports.

- [ ] **Step 3: Type-check + Commit**

```bash
cd c:\HARI\ETAIH\xbase-app && npx tsc --noEmit 2>&1 | head -30
git add src/modules/home/history-panel.tsx src/modules/home/project-layout.tsx && git commit -m "feat: add execution history panel with load-back support"
```

---

## Task 8: Accept/Decline for Destructive AI Commands

**Files:**
- Create: `c:\HARI\ETAIH\xbase-app\src\modules\home\destructive-guard-dialog.tsx`
- Modify: `c:\HARI\ETAIH\xbase-app\src\modules\home\project-layout.tsx`
- Modify: `c:\HARI\ETAIH\xbase-app\src\lib\ai-agent.ts` (system prompt update)

**Design decision:** Intercept at the *user message send* level. Before sending a message, scan it for destructive intent. If detected, show an Accept/Decline confirmation. Also update the AI system prompt to always describe and seek confirmation before executing DROP/DELETE/TRUNCATE/UPDATE-all. This is the simplest viable approach that doesn't require stateful SSE flow.

- [ ] **Step 1: Create destructive-guard-dialog.tsx**

```tsx
"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ShieldAlert } from "lucide-react";

interface DestructiveGuardDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  detectedPattern: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DestructiveGuardDialog({
  open,
  onOpenChange,
  detectedPattern,
  message,
  onConfirm,
  onCancel,
}: DestructiveGuardDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0b0b0b] border-red-900/60 text-white sm:max-w-md shadow-2xl p-0 overflow-hidden rounded-2xl">
        <div className="h-1 w-full bg-gradient-to-r from-transparent via-red-500 to-transparent opacity-60 absolute top-0 left-0" />
        <div className="p-6">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-xl font-bold text-white flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-red-400" />
              Destructive Command Detected
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
                <span className="text-xs text-red-400 font-medium">Matched: {detectedPattern}</span>
              </div>
              <p className="text-sm text-zinc-300">
                Your message may cause the AI to execute irreversible database operations.
              </p>
            </div>

            <div className="bg-black/30 border border-white/10 rounded-lg p-3">
              <p className="text-xs text-zinc-400 mb-1">Your message:</p>
              <p className="text-sm text-zinc-200 line-clamp-3">{message}</p>
            </div>

            <p className="text-xs text-zinc-500">
              The AI will be asked to confirm before executing any destructive operations. Do you want to proceed?
            </p>

            <div className="flex gap-2">
              <Button
                onClick={() => { onCancel(); onOpenChange(false); }}
                className="flex-1 bg-black/40 border border-gray-700 text-zinc-300 hover:text-white"
              >
                Cancel
              </Button>
              <Button
                onClick={() => { onConfirm(); onOpenChange(false); }}
                className="flex-1 bg-red-500/20 border border-red-500/40 text-red-300 hover:bg-red-500/30 hover:border-red-400/60"
              >
                Proceed Anyway
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Add destructive detection to project-layout.tsx**

Add a helper function (near the top of the component, after state declarations):
```typescript
const DESTRUCTIVE_PATTERNS = [
  { pattern: /\bdrop\s+(table|database|schema|index)\b/i, label: "DROP" },
  { pattern: /\bdelete\s+from\b/i, label: "DELETE" },
  { pattern: /\btruncate\b/i, label: "TRUNCATE" },
  { pattern: /\bupdate\s+\w+\s+set\b.*without\s+where/i, label: "UPDATE without WHERE" },
  { pattern: /delete\s+all\s+rows/i, label: "DELETE ALL ROWS" },
  { pattern: /\bdrop\s+all\b/i, label: "DROP ALL" },
  { pattern: /\bclear\s+(the\s+)?(entire|whole|all)\s+(table|database|data)\b/i, label: "CLEAR TABLE/DB" },
];

function detectDestructiveIntent(message: string): string | null {
  for (const { pattern, label } of DESTRUCTIVE_PATTERNS) {
    if (pattern.test(message)) return label;
  }
  return null;
}
```

Add state:
```typescript
const [destructiveGuardOpen, setDestructiveGuardOpen] = useState(false);
const [pendingDestructiveMessage, setPendingDestructiveMessage] = useState("");
const [detectedDestructivePattern, setDetectedDestructivePattern] = useState("");
const pendingDestructiveSendRef = useRef<(() => void) | null>(null);
```

Modify the send message handler (find where `handleSendMessage` or the send mutation is called) to add this guard:

```typescript
// Before sending: check for destructive intent
const destructiveMatch = detectDestructiveIntent(messageText);
if (destructiveMatch) {
  setPendingDestructiveMessage(messageText);
  setDetectedDestructivePattern(destructiveMatch);
  pendingDestructiveSendRef.current = () => {
    // original send logic here
    actualSend(messageText);
  };
  setDestructiveGuardOpen(true);
  return;
}
actualSend(messageText);
```

The exact integration point depends on the current send flow. Find the function that sends the chat message (look for `sendMessage` mutation or `postSseJson`) and wrap it.

Add dialog component in JSX:
```tsx
<DestructiveGuardDialog
  open={destructiveGuardOpen}
  onOpenChange={setDestructiveGuardOpen}
  detectedPattern={detectedDestructivePattern}
  message={pendingDestructiveMessage}
  onConfirm={() => pendingDestructiveSendRef.current?.()}
  onCancel={() => {
    setPendingDestructiveMessage("");
    pendingDestructiveSendRef.current = null;
  }}
/>
```

- [ ] **Step 3: Update AI system prompt to preview destructive commands**

In `src/lib/ai-agent.ts`, find `buildSystemPrompt()`. Add this section near the end of the prompt (before the final closing):

```typescript
## ⚠️ DESTRUCTIVE COMMAND SAFETY PROTOCOL:
BEFORE executing any of these operations: DROP TABLE, DELETE FROM, TRUNCATE, ALTER TABLE DROP COLUMN, UPDATE without WHERE clause — you MUST:
1. Announce the exact SQL you plan to run in a code block
2. Explain what data will be permanently lost
3. Wait for explicit user confirmation in your reply (e.g., "I'll execute this when you confirm")
4. Only run the tool call AFTER showing the preview

Example safe pattern:
"I'm about to run:
\`\`\`sql
DELETE FROM "Orders" WHERE status = 'cancelled';
\`\`\`
This will permanently delete all cancelled orders. Please reply 'confirm' to proceed."
```

- [ ] **Step 4: Type-check + Commit**

```bash
cd c:\HARI\ETAIH\xbase-app && npx tsc --noEmit 2>&1 | head -30
git add src/modules/home/destructive-guard-dialog.tsx src/modules/home/project-layout.tsx src/lib/ai-agent.ts && git commit -m "feat: add destructive command guard with accept/decline dialog"
```

---

## Task 9: API Health Check Dialog

**Files:**
- Create: `c:\HARI\ETAIH\xbase-app\src\modules\home\api-health-dialog.tsx`
- Modify: `c:\HARI\ETAIH\xbase-app\src\modules\home\project-layout.tsx`

- [ ] **Step 1: Create api-health-dialog.tsx**

```tsx
"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Activity, CheckCircle2, XCircle, Clock, Loader2, RefreshCw, ExternalLink } from "lucide-react";
import { toast } from "sonner";

interface EndpointStatus {
  name: string;
  url: string;
  status: "idle" | "checking" | "ok" | "error";
  latencyMs?: number;
  message?: string;
}

interface ApiHealthDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projectId: string;
  apiKeys: Array<{ apiKey: string; isActive: boolean }>;
}

export function ApiHealthDialog({
  open,
  onOpenChange,
  projectId,
  apiKeys,
}: ApiHealthDialogProps) {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? "";
  
  const [endpoints, setEndpoints] = useState<EndpointStatus[]>([
    { name: "Python Backend /health", url: `${backendUrl}/health`, status: "idle" },
    { name: "Python Backend /execute", url: `${backendUrl}/execute`, status: "idle" },
    { name: "XBase API /api/hello", url: "/api/hello", status: "idle" },
    { name: "XBase API /api/neon/list-tables", url: `/api/neon/list-tables?projectId=${projectId}`, status: "idle" },
    { name: "XBase API /api/execution/history", url: `/api/execution/history?projectId=${projectId}`, status: "idle" },
  ]);

  const checkEndpoint = async (index: number) => {
    const ep = endpoints[index];
    setEndpoints((prev) => prev.map((e, i) => i === index ? { ...e, status: "checking" } : e));
    
    const start = Date.now();
    try {
      const method = ep.url.includes("/execute") ? "POST" : "GET";
      const body = ep.url.includes("/execute") ? JSON.stringify({ code: "result = {'status': 'ok'}", timeoutMs: 5000 }) : undefined;
      
      const res = await fetch(ep.url, {
        method,
        headers: method === "POST" ? { "Content-Type": "application/json" } : undefined,
        body,
        signal: AbortSignal.timeout(10000),
      });
      
      const latencyMs = Date.now() - start;
      setEndpoints((prev) => prev.map((e, i) => i === index ? {
        ...e,
        status: res.ok ? "ok" : "error",
        latencyMs,
        message: res.ok ? `HTTP ${res.status}` : `HTTP ${res.status}`,
      } : e));
    } catch (err) {
      setEndpoints((prev) => prev.map((e, i) => i === index ? {
        ...e,
        status: "error",
        latencyMs: Date.now() - start,
        message: err instanceof Error ? err.message : "Failed",
      } : e));
    }
  };

  const checkAll = async () => {
    for (let i = 0; i < endpoints.length; i++) {
      await checkEndpoint(i);
    }
    toast.success("Health check complete");
  };

  const StatusIcon = ({ status }: { status: EndpointStatus["status"] }) => {
    if (status === "idle") return <Clock className="h-4 w-4 text-zinc-500" />;
    if (status === "checking") return <Loader2 className="h-4 w-4 text-blue-400 animate-spin" />;
    if (status === "ok") return <CheckCircle2 className="h-4 w-4 text-neon-green" />;
    return <XCircle className="h-4 w-4 text-red-400" />;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[#0b0b0b] border-gray-800 text-white sm:max-w-xl shadow-2xl p-0 overflow-hidden rounded-2xl">
        <div className="h-1 w-full bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-50 absolute top-0 left-0" />
        <div className="p-6">
          <DialogHeader className="mb-5">
            <DialogTitle className="text-xl font-bold text-white flex items-center gap-2">
              <Activity className="h-5 w-5 text-cyan-400" />
              API Health Check
            </DialogTitle>
            <p className="text-sm text-zinc-400 mt-1">Verify all service endpoints are responding correctly.</p>
          </DialogHeader>

          <div className="space-y-2 mb-4">
            {endpoints.map((ep, i) => (
              <motion.div
                key={ep.url}
                className="flex items-center gap-3 bg-black/20 border border-white/10 rounded-lg px-3 py-2.5 hover:border-white/20 transition-colors"
              >
                <StatusIcon status={ep.status} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-zinc-200 font-medium truncate">{ep.name}</p>
                  <p className="text-xs text-zinc-600 truncate font-mono">{ep.url}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {ep.latencyMs !== undefined && (
                    <span className={`text-xs font-mono ${ep.latencyMs < 500 ? "text-neon-green" : ep.latencyMs < 2000 ? "text-yellow-400" : "text-red-400"}`}>
                      {ep.latencyMs}ms
                    </span>
                  )}
                  {ep.message && ep.status === "error" && (
                    <span className="text-xs text-red-400 max-w-24 truncate">{ep.message}</span>
                  )}
                  <button
                    onClick={() => checkEndpoint(i)}
                    disabled={ep.status === "checking"}
                    className="text-zinc-500 hover:text-white transition-colors"
                  >
                    <RefreshCw className="h-3 w-3" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>

          {apiKeys.length > 0 && (
            <div className="mb-4 bg-black/20 border border-white/10 rounded-lg p-3">
              <p className="text-xs text-zinc-400 mb-2">External API Keys ({apiKeys.filter(k => k.isActive).length} active)</p>
              <div className="text-xs text-zinc-500 font-mono">
                Usage: POST /api/external/run with header <span className="text-cyan-400">x-api-key: YOUR_KEY</span>
              </div>
            </div>
          )}

          <Button
            onClick={checkAll}
            className="w-full bg-cyan-500/10 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-500/20"
          >
            <Activity className="h-3.5 w-3.5 mr-2" />
            Check All Endpoints
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Wire into project-layout.tsx**

1. Add import:
```typescript
import { ApiHealthDialog } from "./api-health-dialog";
```

2. Add state:
```typescript
const [apiHealthOpen, setApiHealthOpen] = useState(false);
```

3. Add dialog in JSX:
```tsx
<ApiHealthDialog
  open={apiHealthOpen}
  onOpenChange={setApiHealthOpen}
  projectId={projectId ?? ""}
  apiKeys={apiKeys}
/>
```

4. Add health check button to toolbar:
```tsx
<Button
  size="sm"
  onClick={() => setApiHealthOpen(true)}
  className="h-7 text-xs bg-black/30 border border-gray-700 text-zinc-300 hover:border-cyan-400/40 hover:text-cyan-300 gap-1"
>
  <Activity className="h-3 w-3" />
  API Status
</Button>
```

5. Add `Activity` to lucide-react imports.

- [ ] **Step 3: Type-check + Commit**

```bash
cd c:\HARI\ETAIH\xbase-app && npx tsc --noEmit 2>&1 | head -30
git add src/modules/home/api-health-dialog.tsx src/modules/home/project-layout.tsx && git commit -m "feat: add API health check dialog for endpoint monitoring"
```

---

## Final: Push All Changes

- [ ] **Push xbase-app to origin**

```bash
cd c:\HARI\ETAIH\xbase-app && git push origin master
```

- [ ] **Push xbase-backend to origin**

```bash
cd c:\HARI\ETAIH\xbase-backend && git push origin master
```

---

## Self-Review

**Spec coverage check:**
1. CLAUDE.md for both repos ✅ Task 1
2. Fast Python runner (caching) ✅ Task 4 
3. Smart Fill (ML prediction) ✅ Tasks 2 + 5
4. Association Mining (Apriori) ✅ Tasks 3 + 6
5. API support endpoints check ✅ Task 9
6. Collaborate option — existing feature preserved, no changes needed (it already works)
7. Accept/Decline for destructive AI commands ✅ Task 8
8. Save button + History ✅ Task 7

**Placeholder scan:** No TBDs or "fill in later" items present.

**Type consistency:** 
- `SmartFillDialog` uses `columns: string[]` — `project-layout.tsx` derives this as `tableColumns = tableRows && tableRows.length > 0 ? Object.keys(tableRows[0]) : []`
- `AprioriDialog` uses same `columns: string[]` — consistent
- `HistoryPanel` uses `onLoadQuery?: (query: string, type: "python" | "sql") => void` — matches usage
- All `projectId` passed as `projectId ?? ""` — consistent with existing dialog patterns
