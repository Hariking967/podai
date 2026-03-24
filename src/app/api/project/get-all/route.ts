import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { projectCollaborators, projects, user } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";

const GetAllProjectsSchema = z.object({
  userId: z.string().min(1),
});

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const input = GetAllProjectsSchema.parse({
      userId: url.searchParams.get("userId"),
    });

    const ownedProjects = await db.query.projects.findMany({
      where: eq(projects.userId, input.userId),
      orderBy: (projects, { desc }) => [desc(projects.createdAt)],
    });

    let collaboratorRows: Array<{ projectId: string }> = [];
    try {
      collaboratorRows = await db.query.projectCollaborators.findMany({
        where: eq(projectCollaborators.userId, input.userId),
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
      isOwner: project.userId === input.userId,
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
