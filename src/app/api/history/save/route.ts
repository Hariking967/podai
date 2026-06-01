import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { queryHistory } from "@/db/schema";
import { nanoid } from "nanoid";
import { getProjectRole, getSessionUserId, hasWriteAccess } from "@/lib/project-permissions";

const SaveSchema = z.object({
  projectId: z.string().min(1),
  query: z.string().min(1),
  type: z.enum(["sql", "python"]),
  commitMessage: z.string().min(1).max(200),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const input = SaveSchema.parse(body);
    const userId = await getSessionUserId();
    if (!userId) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    const role = await getProjectRole(input.projectId, userId);
    if (!hasWriteAccess(role)) return NextResponse.json({ message: "Read-only access" }, { status: 403 });
    await db.insert(queryHistory).values({
      id: nanoid(),
      projectId: input.projectId,
      userId,
      query: input.query,
      type: input.type,
      commitMessage: input.commitMessage,
    });
    return NextResponse.json({ message: "Saved" });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: "Invalid payload" }, { status: 400 });
    return NextResponse.json({ message: "Internal error" }, { status: 500 });
  }
}
