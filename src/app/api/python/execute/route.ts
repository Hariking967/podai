import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { executionResults, projects, queryHistory } from "@/db/schema";
import { eq } from "drizzle-orm";
import { runPythonCode } from "@/lib/python-adapter";
import { nanoid } from "nanoid";
import {
  getProjectRole,
  getSessionUserId,
  hasWriteAccess,
} from "@/lib/project-permissions";

const RunPythonSchema = z.object({
  projectId: z.string().min(1),
  code: z.string().min(1),
  inputData: z.unknown().optional(),
  timeoutMs: z.coerce.number().int().min(1000).max(60000).optional(),
});

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
