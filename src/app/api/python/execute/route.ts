import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { eq } from "drizzle-orm";
import { runPythonCode } from "@/lib/python-adapter";

const RunPythonSchema = z.object({
  projectId: z.string().min(1),
  code: z.string().min(1),
  timeoutMs: z.coerce.number().int().min(1000).max(60000).optional(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const input = RunPythonSchema.parse(body);

    const project = await db.query.projects.findFirst({
      where: eq(projects.id, input.projectId),
    });

    if (!project?.neonApiKey) {
      return NextResponse.json(
        { message: "Missing Neon connection string for this project." },
        { status: 400 },
      );
    }

    const result = await runPythonCode({
      code: input.code,
      timeoutMs: input.timeoutMs ?? 20000,
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
