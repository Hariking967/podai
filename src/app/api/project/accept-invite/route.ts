import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { projectInvitations, projectCollaborators, notifications } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getSessionUserId } from "@/lib/project-permissions";

export async function POST(req: Request) {
  try {
    const { token } = z.object({ token: z.string().min(1) }).parse(await req.json());
    const userId = await getSessionUserId();
    if (!userId) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

    const invitation = await db.query.projectInvitations.findFirst({
      where: eq(projectInvitations.token, token),
    });

    if (!invitation)
      return NextResponse.json({ message: "Invitation not found" }, { status: 404 });
    if (invitation.status !== "pending")
      return NextResponse.json({ message: "Invitation already used" }, { status: 400 });
    if (new Date() > invitation.expiresAt)
      return NextResponse.json({ message: "Invitation expired" }, { status: 400 });

    await db
      .insert(projectCollaborators)
      .values({ projectId: invitation.projectId, userId, role: invitation.role })
      .onConflictDoUpdate({
        target: [projectCollaborators.projectId, projectCollaborators.userId],
        set: { role: invitation.role },
      });

    await db
      .update(projectInvitations)
      .set({ status: "accepted" })
      .where(eq(projectInvitations.token, token));

    await db
      .update(notifications)
      .set({ read: true })
      .where(and(eq(notifications.userId, userId), eq(notifications.read, false)));

    return NextResponse.json({ message: "Joined project", projectId: invitation.projectId });
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json({ message: "Invalid" }, { status: 400 });
    return NextResponse.json({ message: "Internal error" }, { status: 500 });
  }
}
