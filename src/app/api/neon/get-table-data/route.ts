import { NextResponse } from "next/server";
import { z } from "zod";
import { Pool } from "@neondatabase/serverless";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { eq } from "drizzle-orm";

const TABLE_NAME_REGEX = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

const GetTableDataSchema = z.object({
  projectId: z.string().min(1),
  tableName: z.string().min(1),
  limit: z.coerce.number().int().min(1).max(500).default(200),
});

const getProjectConnectionString = async (projectId: string) => {
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  });
  if (!project?.neonApiKey) {
    throw new Error("Missing Neon connection string for this project.");
  }
  return project.neonApiKey;
};

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const input = GetTableDataSchema.parse({
      projectId: url.searchParams.get("projectId"),
      tableName: url.searchParams.get("tableName"),
      limit: url.searchParams.get("limit") ?? 200,
    });

    if (!TABLE_NAME_REGEX.test(input.tableName)) {
      return NextResponse.json({ message: "Invalid table name." }, { status: 400 });
    }

    const connectionString = await getProjectConnectionString(input.projectId);
    const pool = new Pool({ connectionString });
    try {
      const result = await pool.query<Record<string, unknown>>(
        `select * from "${input.tableName}" limit $1`,
        [input.limit]
      );
      return NextResponse.json(result.rows);
    } finally {
      await pool.end();
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Invalid query params", issues: error.issues },
        { status: 400 }
      );
    }
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ message }, { status: 500 });
  }
}
