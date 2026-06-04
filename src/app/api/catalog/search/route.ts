import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { dataCatalog } from "@/db/schema";
import { eq, and, ilike, isNull } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { getSessionUserId, getProjectRole } from "@/lib/project-permissions";

const CatalogSearchSchema = z.object({
  projectId: z.string().min(1),
  query: z.string().min(1),
  type: z.enum(["table", "column", "all"]).default("all"),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const input = CatalogSearchSchema.parse(body);

    const sessionUserId = await getSessionUserId();
    if (!sessionUserId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const role = await getProjectRole(input.projectId, sessionUserId);
    if (!role) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const pattern = `%${input.query}%`;

    // Build query conditions
    const baseConditions = [
      eq(dataCatalog.projectId, input.projectId),
      sql`(${dataCatalog.tableName} ILIKE ${pattern} OR ${dataCatalog.columnName} ILIKE ${pattern} OR ${dataCatalog.description} ILIKE ${pattern})`
    ];

    if (input.type === "table") {
      baseConditions.push(isNull(dataCatalog.columnName));
    } else if (input.type === "column") {
      baseConditions.push(sql`${dataCatalog.columnName} IS NOT NULL`);
    }

    const results = await db.select().from(dataCatalog)
      .where(and(...baseConditions))
      .limit(100);

    // Group by table
    const grouped: Record<string, typeof results> = {};
    for (const row of results) {
      const table = row.tableName || "unknown";
      if (!grouped[table]) grouped[table] = [];
      grouped[table].push(row);
    }

    return NextResponse.json({
      totalResults: results.length,
      grouped,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Invalid request", issues: error.issues },
        { status: 400 }
      );
    }
    const message = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json({ message }, { status: 500 });
  }
}
