import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { projectCollaborators, user, projectInvitations } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { getProjectRole, getSessionUserId } from "@/lib/project-permissions";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const projectId = z.string().min(1).parse(url.searchParams.get("projectId"));
    const userId = await getSessionUserId();
    if (!userId) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    const role = await getProjectRole(projectId, userId);
    if (!role) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

    const collabs = await db.query.projectCollaborators.findMany({
      where: eq(projectCollaborators.projectId, projectId),
    });

    const userIds = collabs.map((c) => c.userId);
    const users =
      userIds.length > 0
        ? await db.query.user.findMany({
            where: inArray(user.id, userIds),
          })
        : [];
    const userMap = new Map(users.map((u) => [u.id, u]));

    const pendingInvites = await db.query.projectInvitations.findMany({
      where: (inv, { and, eq: eqFn }) =>
        and(eqFn(inv.projectId, projectId), eqFn(inv.status, "pending")),
    });

    return NextResponse.json({
      collaborators: collabs.map((c) => ({
        ...c,
        name: userMap.get(c.userId)?.name ?? "Unknown",
        email: userMap.get(c.userId)?.email ?? "",
      })),
      pendingInvites,
    });
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json({ message: "Invalid" }, { status: 400 });
    return NextResponse.json({ message: "Internal error" }, { status: 500 });
  }
}
