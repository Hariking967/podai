# XBase App — CLAUDE.md

## What This Is
Next.js 15 full-stack AI-powered database IDE. Users connect PostgreSQL databases, chat with an AI agent that writes and executes SQL/Python, and view results inline.

## Development
```bash
cd c:\HARI\ETAIH\xbase-app
npm run dev        # Start dev server (port 3000, Turbopack)
npm run build      # Production build
npx tsc --noEmit   # Type-check without building
```

## Stack
- **Runtime:** Next.js 15 App Router, React 19, TypeScript 5
- **UI:** Tailwind CSS 4, shadcn/ui (Radix UI), Framer Motion
- **DB:** Drizzle ORM + Neon (serverless PostgreSQL)
- **Auth:** Better Auth (sessions)
- **Cache:** Upstash Redis + in-memory fallback (`src/lib/cache.ts`)
- **AI:** OpenAI gpt-4.1-mini (smart) / gpt-4.1-nano (fast) via `src/lib/ai-agent.ts`
- **Charts:** Recharts

## Directory Layout
```
src/
  app/            # Next.js App Router — pages + API routes
    api/
      chat/       # AI chat: send-message, send-message-stream, list-agents, etc.
      neon/       # Database: list-tables, get-table-data, run-sql
      python/     # Python execution proxy to xbase-backend
      project/    # Project CRUD + collaborators + API keys
      execution/  # Query history
      smart-fill/ # ML column prediction (new)
      apriori/    # Association mining (new)
  modules/
    home/         # Main feature UI
      project-layout.tsx    # Primary component ~1600 lines (panels, dialogs, data viewer)
      chat-interface.tsx    # AI chat panel ~1300 lines
      smart-fill-dialog.tsx # Smart Fill feature (new)
      apriori-dialog.tsx    # Association Mining (new)
      history-panel.tsx     # Query History (new)
      destructive-guard-dialog.tsx # Accept/Decline for destructive SQL (new)
      api-health-dialog.tsx # Endpoint health checker (new)
    auth/         # Sign-in / sign-up views
    landing/      # Marketing landing page
  lib/
    ai-agent.ts       # OpenAI tool-calling loop (run_sql, run_python, get_schema)
    python-adapter.ts # Calls xbase-backend /execute
    neon-sql.ts       # Runs SQL on Neon
    cache.ts          # cacheGet/cacheSet (Upstash Redis + memory)
  db/
    schema.ts    # Drizzle ORM table definitions
    index.ts     # DB client
  components/ui/ # shadcn/ui components
docker/python/   # Alternative local Python execution (Dockerfile + runner.py + helpers.py)
```

## Key API Routes
| Route | Method | Purpose |
|-------|--------|---------|
| `/api/chat/send-message` | POST | Non-streaming AI chat |
| `/api/chat/send-message-stream` | POST | SSE streaming AI chat |
| `/api/python/execute` | POST | Run Python via xbase-backend |
| `/api/neon/run-sql` | POST | Execute SQL on Neon DB |
| `/api/neon/list-tables` | GET | List database tables |
| `/api/neon/get-table-data` | GET | Fetch table rows with pagination |
| `/api/project/create` | POST | Create project with Neon connection |
| `/api/project/add-collaborator` | POST | Share project with user |
| `/api/project/api-keys` | GET | List project API keys |
| `/api/execution/history` | GET | Query/execution history |
| `/api/smart-fill` | POST | Predict missing column values via ML |
| `/api/apriori` | POST | Run Apriori association mining |
| `/api/external/run` | POST | External API execution (API key auth) |

## Database Schema (Drizzle)
- `projects` — name, userId, neonApiKey (Neon connection string), chatId
- `chats` / `messages` — AI conversation history per project
- `executionResults` — Python/SQL execution log (type, status, executionJson, stdout)
- `queryHistory` — all queries run per project (query, type: python|sql)
- `projectCollaborators` — role-based sharing (owner|editor|viewer)
- `projectApiKeys` — external API keys (apiKey, isActive)

## UI Style Guide
- Background: `#0a0a0a` with neon-green accents (`rgba(74,222,128,...)`)
- Dialogs: `bg-[#0b0b0b] border-gray-800 text-white rounded-2xl`
- Buttons: `bg-black/40 border border-gray-800 hover:border-neon-green/60`
- New dialogs match existing color accent per feature (Smart Fill: neon-green, Apriori: purple, History: amber, Health: cyan, Guard: red)

## Environment Variables (see .env.example)
- `NEXT_PUBLIC_BACKEND_URL` — xbase-backend service URL
- `DATABASE_URL` — Neon PostgreSQL connection string (for Drizzle migrations)
- `OPENAI_API_KEY` — OpenAI API key
- `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` — Cache

## Common Patterns
```typescript
// Fetch with auth + error handling
const result = await postJson<ResultType>("/api/endpoint", { projectId, ...data });

// Cache read-through
const key = "prefix:" + hash;
const cached = await cacheGet<T>(key);
if (!cached) {
  const data = await fetchExpensiveData();
  await cacheSet(key, data, 300); // 300s TTL
}

// Drizzle query
const rows = await db.query.queryHistory.findMany({
  where: eq(queryHistory.projectId, projectId),
  orderBy: [desc(queryHistory.createdAt)],
  limit: 50,
});
```

## AI Agent Architecture
`src/lib/ai-agent.ts` exports `runAgent({message, neonApiKey, history})`.

The agent uses a 4-iteration tool loop with three tools:
1. `get_schema` — discovers table structure (cached 5 min in Upstash)
2. `run_sql` — executes SQL on Neon
3. `run_python` — delegates to xbase-backend via `python-adapter.ts`

Fast path (gpt-4.1-nano, ~420 tokens): simple SQL queries
Slow path (gpt-4.1-mini, ~900 tokens): visualizations, complex analysis

## Python Execution Caching
`src/app/api/python/execute/route.ts` caches successful Python results by `sha1(code + inputData)` for 10 minutes using the existing cache layer. Cache is skipped for executions that return errors.
