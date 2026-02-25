import { z } from "zod";
import { Pool } from "@neondatabase/serverless";
import { baseProcedure, createTRPCRouter } from "../init";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { eq } from "drizzle-orm";

const TABLE_NAME_REGEX = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

const getProjectConnectionString = async (projectId: string) => {
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  });
  if (!project?.neonApiKey) {
    throw new Error("Missing Neon connection string for this project.");
  }
  return project.neonApiKey;
};

const queryNeon = async <T>(
  connectionString: string,
  sql: string,
  params: unknown[] = []
) => {
  const pool = new Pool({ connectionString });
  try {
    const result = await pool.query(sql, params);
    return result.rows as T[];
  } finally {
    await pool.end();
  }
};

export const neonRouter = createTRPCRouter({
  listTables: baseProcedure
    .input(z.object({ projectId: z.string().min(1) }))
    .query(async ({ input }) => {
      const connectionString = await getProjectConnectionString(input.projectId);
      const tables = await queryNeon<{ table_name: string }>(
        connectionString,
        "select table_name from information_schema.tables where table_schema = 'public' order by table_name asc"
      );
      return tables.map((t) => t.table_name);
    }),

  getTableData: baseProcedure
    .input(
      z.object({
        projectId: z.string().min(1),
        tableName: z.string().min(1),
        limit: z.number().int().min(1).max(500).default(200),
      })
    )
    .query(async ({ input }) => {
      if (!TABLE_NAME_REGEX.test(input.tableName)) {
        throw new Error("Invalid table name.");
      }
      const connectionString = await getProjectConnectionString(input.projectId);
      const rows = await queryNeon<Record<string, unknown>>(
        connectionString,
        `select * from "${input.tableName}" limit $1`,
        [input.limit]
      );
      return rows;
    }),
});
