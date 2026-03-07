import { NextResponse } from "next/server";
import { z } from "zod";
import { getNeonPool } from "@/lib/neon-pool";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { eq } from "drizzle-orm";

const LOG_PREFIX = "[GetTableData]";
const TABLE_NAME_REGEX = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

const GetTableDataSchema = z.object({
  projectId: z.string().min(1),
  tableName: z.string().min(1),
  limit: z.coerce.number().int().min(1).max(500).default(200),
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
  console.log(`${LOG_PREFIX} ========== GET TABLE DATA REQUEST ==========`);

  try {
    const url = new URL(req.url);
    const input = GetTableDataSchema.parse({
      projectId: url.searchParams.get("projectId"),
      tableName: url.searchParams.get("tableName"),
      limit: url.searchParams.get("limit") ?? 200,
    });
    console.log(`${LOG_PREFIX} Project ID: ${input.projectId}`);
    console.log(`${LOG_PREFIX} Table name: ${input.tableName}`);
    console.log(`${LOG_PREFIX} Limit: ${input.limit}`);

    if (!TABLE_NAME_REGEX.test(input.tableName)) {
      console.error(
        `${LOG_PREFIX} Invalid table name format: ${input.tableName}`,
      );
      return NextResponse.json(
        { message: "Invalid table name." },
        { status: 400 },
      );
    }

    const connectionString = await getProjectConnectionString(input.projectId);
    console.log(`${LOG_PREFIX} Getting connection pool...`);
    const pool = getNeonPool(connectionString);

    // Use double quotes to preserve case sensitivity
    const query = `select * from "${input.tableName}" limit $1`;
    console.log(`${LOG_PREFIX} Executing query: ${query}`);

    const result = await pool.query<Record<string, unknown>>(query, [
      input.limit,
    ]);
    console.log(
      `${LOG_PREFIX} Query successful, rows returned: ${result.rows.length}`,
    );

    return NextResponse.json(result.rows);
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
