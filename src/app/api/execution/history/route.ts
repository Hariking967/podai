import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { queryHistory } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { getProjectRole, getSessionUserId } from "@/lib/project-permissions";

const HistorySchema = z.object({
  projectId: z.string().min(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const input = HistorySchema.parse({
      projectId: url.searchParams.get("projectId"),
      limit: url.searchParams.get("limit") ?? 50,
    });

    const sessionUserId = await getSessionUserId();
    if (!sessionUserId) {
      return NextResponse.json(
        { success: false, data: null, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const role = await getProjectRole(input.projectId, sessionUserId);
    if (!role) {
      return NextResponse.json(
        { success: false, data: null, error: "Forbidden" },
        { status: 403 },
      );
    }

    const rows = await db.query.queryHistory.findMany({
      where: eq(queryHistory.projectId, input.projectId),
      orderBy: (history) => [desc(history.createdAt)],
      limit: input.limit,
    });

    return NextResponse.json({ success: true, data: rows, error: null });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, data: null, error: "Invalid query params" },
        { status: 400 },
      );
    }
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { success: false, data: null, error: message },
      { status: 500 },
    );
  }
}
