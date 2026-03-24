import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { projectApiKeys, projects, queryHistory } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { runSqlOnNeon } from "@/lib/neon-sql";
import { runPythonCode } from "@/lib/python-adapter";
import { nanoid } from "nanoid";

const RATE_LIMIT_MAX = 60;
const RATE_LIMIT_WINDOW_MS = 60_000;
const rateLimitBucket = new Map<string, number[]>();

const RunExternalSchema = z.object({
  type: z.enum(["sql", "python"]),
  query: z.string().min(1),
  input_data: z.unknown().optional(),
});

const hitRateLimit = (apiKey: string) => {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;
  const timestamps = rateLimitBucket.get(apiKey) ?? [];
  const filtered = timestamps.filter((ts) => ts > windowStart);
  filtered.push(now);
  rateLimitBucket.set(apiKey, filtered);
  return filtered.length > RATE_LIMIT_MAX;
};

export async function POST(req: Request) {
  try {
    const apiKey = req.headers.get("x-api-key");
    if (!apiKey) {
      return NextResponse.json(
        { success: false, data: null, error: "Missing API key" },
        { status: 401 },
      );
    }

    if (hitRateLimit(apiKey)) {
      return NextResponse.json(
        { success: false, data: null, error: "Rate limit exceeded" },
        { status: 429 },
      );
    }

    const body = await req.json();
    const input = RunExternalSchema.parse(body);

    const keyRecord = await db.query.projectApiKeys.findFirst({
      where: and(
        eq(projectApiKeys.apiKey, apiKey),
        eq(projectApiKeys.isActive, true),
      ),
    });

    if (!keyRecord) {
      return NextResponse.json(
        { success: false, data: null, error: "Invalid API key" },
        { status: 403 },
      );
    }

    const project = await db.query.projects.findFirst({
      where: eq(projects.id, keyRecord.projectId),
    });

    if (!project?.neonApiKey) {
      return NextResponse.json(
        { success: false, data: null, error: "Project not configured" },
        { status: 400 },
      );
    }

    await db.insert(queryHistory).values({
      id: nanoid(),
      projectId: keyRecord.projectId,
      userId: keyRecord.createdBy,
      query: input.query,
      type: input.type,
    });

    if (input.type === "sql") {
      const result = await runSqlOnNeon({
        connectionString: project.neonApiKey,
        query: input.query,
        params: [],
      });
      const limitedRows = result.rows.slice(0, 1000);
      return NextResponse.json({
        success: true,
        data: {
          rows: limitedRows,
          fields: result.fields,
          rowCount: limitedRows.length,
        },
        error: null,
      });
    }

    const pyResult = await runPythonCode({
      code: input.query,
      inputData: input.input_data ?? null,
      timeoutMs: 20000,
    });

    return NextResponse.json({ success: true, data: pyResult, error: null });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, data: null, error: "Invalid request payload" },
        { status: 400 },
      );
    }
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { success: false, data: null, error: message },
      { status: 500 },
    );
  }
}
