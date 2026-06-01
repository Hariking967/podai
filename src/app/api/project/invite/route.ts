import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { projects, projectInvitations, notifications, user } from "@/db/schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { getProjectRole, getSessionUserId } from "@/lib/project-permissions";

const InviteSchema = z.object({
  projectId: z.string().min(1),
  email: z.string().email(),
  role: z.enum(["editor", "viewer"]),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const input = InviteSchema.parse(body);
    const inviterId = await getSessionUserId();
    if (!inviterId) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    const role = await getProjectRole(input.projectId, inviterId);
    if (role !== "owner") return NextResponse.json({ message: "Owner only" }, { status: 403 });

    const project = await db.query.projects.findFirst({
      where: eq(projects.id, input.projectId),
    });
    const inviter = await db.query.user.findFirst({ where: eq(user.id, inviterId) });
    const invitee = await db.query.user.findFirst({ where: eq(user.email, input.email) });

    const token = nanoid(32);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await db.insert(projectInvitations).values({
      id: nanoid(),
      projectId: input.projectId,
      invitedByUserId: inviterId,
      invitedEmail: input.email,
      role: input.role,
      token,
      status: "pending",
      expiresAt,
    });

    if (invitee) {
      await db.insert(notifications).values({
        id: nanoid(),
        userId: invitee.id,
        type: "invitation",
        title: `Invitation to join ${project?.name ?? "a project"}`,
        body: `${inviter?.name ?? inviter?.email ?? "Someone"} invited you to join "${project?.name}" as ${input.role}`,
        data: {
          token,
          projectId: input.projectId,
          role: input.role,
          projectName: project?.name,
        },
        read: false,
      });
    }

    return NextResponse.json({ message: "Invitation sent", token });
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json({ message: "Invalid" }, { status: 400 });
    const msg = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json({ message: msg }, { status: 500 });
  }
}
