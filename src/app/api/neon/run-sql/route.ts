import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { eq } from "drizzle-orm";
import { runSqlOnNeon } from "@/lib/neon-sql";

const RunSqlSchema = z.object({
  projectId: z.string().min(1),
  query: z.string().min(1),
  params: z.array(z.unknown()).optional(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const input = RunSqlSchema.parse(body);

    const project = await db.query.projects.findFirst({
      where: eq(projects.id, input.projectId),
    });

    if (!project?.neonApiKey) {
      return NextResponse.json(
        { message: "Missing Neon connection string for this project." },
        { status: 400 },
      );
    }

    const result = await runSqlOnNeon({
      connectionString: project.neonApiKey,
      query: input.query,
      params: input.params ?? [],
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
