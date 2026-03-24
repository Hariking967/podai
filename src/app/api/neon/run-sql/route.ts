import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { executionResults, projects, queryHistory } from "@/db/schema";
import { eq } from "drizzle-orm";
import { runSqlOnNeon } from "@/lib/neon-sql";
import { nanoid } from "nanoid";
import {
  getProjectRole,
  getSessionUserId,
  hasWriteAccess,
} from "@/lib/project-permissions";

const RunSqlSchema = z.object({
  projectId: z.string().min(1),
  query: z.string().min(1),
  params: z.array(z.unknown()).optional(),
});

const rowsToCsv = (rows: Record<string, unknown>[], fields: string[]) => {
  if (!rows.length) return "";
  const escapeValue = (value: unknown) => {
    if (value === null || value === undefined) return "";
    const stringValue = String(value);
    if (/[",\n]/.test(stringValue)) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return stringValue;
  };
  const header = fields.map(escapeValue).join(",");
  const lines = rows.map((row) =>
    fields.map((field) => escapeValue(row[field])).join(","),
  );
  return [header, ...lines].join("\n");
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const input = RunSqlSchema.parse(body);

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
      query: input.query,
      type: "sql",
    });

    try {
      const result = await runSqlOnNeon({
        connectionString: project.neonApiKey,
        query: input.query,
        params: input.params ?? [],
      });

      await db.insert(executionResults).values({
        id: nanoid(),
        type: "sql",
        status: "success",
        errorMessage: null,
        executionJson: {
          rows: result.rows,
          fields: result.fields,
          rowCount: result.rowCount,
          csv: rowsToCsv(result.rows, result.fields),
        },
        stdout: null,
      });

      return NextResponse.json(result);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "SQL execution failed";
      await db.insert(executionResults).values({
        id: nanoid(),
        type: "sql",
        status: "error",
        errorMessage: message,
        executionJson: { error: { message } },
        stdout: null,
      });
      return NextResponse.json({ message }, { status: 500 });
    }
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
