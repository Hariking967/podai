import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { projectCollaborators, projects, user } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { getSessionUserId } from "@/lib/project-permissions";

const GetAllProjectsSchema = z.object({
  userId: z.string().min(1),
});

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const input = GetAllProjectsSchema.parse({
      userId: url.searchParams.get("userId"),
    });

    const sessionUserId = await getSessionUserId();
    if (!sessionUserId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    if (input.userId && input.userId !== sessionUserId) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const ownedProjects = await db.query.projects.findMany({
      where: eq(projects.userId, sessionUserId),
      orderBy: (projects, { desc }) => [desc(projects.createdAt)],
    });

    let collaboratorRows: Array<{ projectId: string }> = [];
    try {
      collaboratorRows = await db.query.projectCollaborators.findMany({
        where: eq(projectCollaborators.userId, sessionUserId),
      });
    } catch (collabError) {
      console.warn(
        "[GetAllProjects] collaborator lookup failed, returning owned projects only",
        collabError,
      );
    }

    const collaboratorProjectIds = collaboratorRows
      .map((row) => row.projectId)
      .filter(
        (projectId) =>
          !ownedProjects.some((project) => project.id === projectId),
      );

    const collaboratorRoleMap = new Map(
      collaboratorRows.map((row) => [row.projectId, row.role ?? "viewer"]),
    );

    const sharedProjects = collaboratorProjectIds.length
      ? await db.query.projects.findMany({
          where: inArray(projects.id, collaboratorProjectIds),
          orderBy: (projects, { desc }) => [desc(projects.createdAt)],
        })
      : [];

    const combinedProjects = [...ownedProjects, ...sharedProjects].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    const ownerIds = Array.from(
      new Set(combinedProjects.map((project) => project.userId)),
    );
    const owners = ownerIds.length
      ? await db.query.user.findMany({
          where: inArray(user.id, ownerIds),
        })
      : [];
    const ownerMap = new Map(
      owners.map((owner) => [owner.id, owner.name || owner.email || "Host"]),
    );

    const response = combinedProjects.map((project) => ({
      ...project,
      hostName: ownerMap.get(project.userId) ?? "Host",
      isOwner: project.userId === sessionUserId,
      role:
        project.userId === sessionUserId
          ? "owner"
          : (collaboratorRoleMap.get(project.id) ?? "viewer"),
    }));

    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Invalid query params", issues: error.issues },
        { status: 400 },
      );
    }
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ message }, { status: 500 });
  }
}
