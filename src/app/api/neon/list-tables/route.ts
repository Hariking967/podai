import { NextResponse } from "next/server";
import { z } from "zod";
import { Pool } from "@neondatabase/serverless";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { eq } from "drizzle-orm";

const ListTablesSchema = z.object({
  projectId: z.string().min(1),
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
    const input = ListTablesSchema.parse({
      projectId: url.searchParams.get("projectId"),
    });

    const connectionString = await getProjectConnectionString(input.projectId);
    const pool = new Pool({ connectionString });
    try {
      const result = await pool.query<{ table_name: string }>(
        "select table_name from information_schema.tables where table_schema = 'public' order by table_name asc"
      );
      return NextResponse.json(result.rows.map((row) => row.table_name));
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
