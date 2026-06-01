import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { projectApiKeys } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { getProjectRole, getSessionUserId } from "@/lib/project-permissions";

const RevokeSchema = z.object({
  keyId: z.string().min(1),
  projectId: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const input = RevokeSchema.parse(body);
    const userId = await getSessionUserId();
    if (!userId) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    const role = await getProjectRole(input.projectId, userId);
    if (role !== "owner") return NextResponse.json({ message: "Owner only" }, { status: 403 });
    await db
      .delete(projectApiKeys)
      .where(
        and(
          eq(projectApiKeys.id, input.keyId),
          eq(projectApiKeys.projectId, input.projectId)
        )
      );
    return NextResponse.json({ message: "Revoked" });
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json({ message: "Invalid" }, { status: 400 });
    return NextResponse.json({ message: "Internal error" }, { status: 500 });
  }
}
