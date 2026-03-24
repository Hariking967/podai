import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { projectApiKeys } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { getProjectRole, getSessionUserId } from "@/lib/project-permissions";

const ApiKeysSchema = z.object({
  projectId: z.string().min(1),
});

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const input = ApiKeysSchema.parse({
      projectId: url.searchParams.get("projectId"),
    });

    const sessionUserId = await getSessionUserId();
    if (!sessionUserId) {
      return NextResponse.json(
        { success: false, data: null, error: "Unauthorized" },
        { status: 401 },
      );
    }

    const role = await getProjectRole(input.projectId, sessionUserId);
    if (role !== "owner") {
      return NextResponse.json(
        { success: false, data: null, error: "Owner only" },
        { status: 403 },
      );
    }

    const keys = await db.query.projectApiKeys.findMany({
      where: eq(projectApiKeys.projectId, input.projectId),
      orderBy: (keys) => [desc(keys.createdAt)],
    });

    return NextResponse.json({ success: true, data: keys, error: null });
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
