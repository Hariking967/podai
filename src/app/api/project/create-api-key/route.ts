import { NextResponse } from "next/server";
import { z } from "zod";
import { nanoid } from "nanoid";
import { db } from "@/db";
import { projectApiKeys } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getProjectRole, getSessionUserId } from "@/lib/project-permissions";

const CreateKeySchema = z.object({
  projectId: z.string().min(1),
});

const buildApiKey = () => `xbase_${nanoid(48)}`;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const input = CreateKeySchema.parse(body);

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

    const apiKey = buildApiKey();
    const [record] = await db
      .insert(projectApiKeys)
      .values({
        id: nanoid(),
        projectId: input.projectId,
        apiKey,
        createdBy: sessionUserId,
      })
      .returning();

    return NextResponse.json({ success: true, data: record, error: null });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, data: null, error: "Invalid request payload" },
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
