import { NextResponse } from "next/server";
import { z } from "zod";
import { Pool } from "@neondatabase/serverless";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { eq } from "drizzle-orm";

const LOG_PREFIX = "[ListTables]";

const ListTablesSchema = z.object({
  projectId: z.string().min(1),
});

const getProjectConnectionString = async (projectId: string) => {
  console.log(`${LOG_PREFIX} Fetching project: ${projectId}`);
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  });
  if (!project?.neonApiKey) {
    console.error(`${LOG_PREFIX} No Neon API key for project: ${projectId}`);
    throw new Error("Missing Neon connection string for this project.");
  }
  console.log(
    `${LOG_PREFIX} Found connection string (length: ${project.neonApiKey.length})`,
  );
  return project.neonApiKey;
};

export async function GET(req: Request) {
  console.log(`${LOG_PREFIX} ========== LIST TABLES REQUEST ==========`);

  try {
    const url = new URL(req.url);
    const input = ListTablesSchema.parse({
      projectId: url.searchParams.get("projectId"),
    });
    console.log(`${LOG_PREFIX} Project ID: ${input.projectId}`);

    const connectionString = await getProjectConnectionString(input.projectId);
    console.log(`${LOG_PREFIX} Creating connection pool...`);
    const pool = new Pool({ connectionString });

    try {
      console.log(`${LOG_PREFIX} Querying information_schema.tables...`);
      const result = await pool.query<{ table_name: string }>(
        "select table_name from information_schema.tables where table_schema = 'public' order by table_name asc",
      );
      const tableNames = result.rows.map((row) => row.table_name);
      console.log(
        `${LOG_PREFIX} Found ${tableNames.length} tables: ${tableNames.join(", ")}`,
      );
      return NextResponse.json(tableNames);
    } finally {
      await pool.end();
      console.log(`${LOG_PREFIX} Connection pool closed`);
    }
  } catch (error) {
    console.error(`${LOG_PREFIX} ERROR:`, error);
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Invalid query params", issues: error.issues },
        { status: 400 },
      );
    }
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ message }, { status: 500 });
  }
}
