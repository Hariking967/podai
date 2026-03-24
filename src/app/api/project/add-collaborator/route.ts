import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { projectCollaborators, projects, user } from "@/db/schema";
import { eq, or } from "drizzle-orm";
import { getSessionUserId } from "@/lib/project-permissions";

const AddCollaboratorSchema = z.object({
  projectId: z.string().min(1),
  ownerId: z.string().min(1).optional(),
  identifier: z.string().trim().min(1),
  role: z.enum(["owner", "editor", "viewer"]).optional(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const input = AddCollaboratorSchema.parse(body);

    const sessionUserId = await getSessionUserId();
    if (!sessionUserId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const project = await db.query.projects.findFirst({
      where: eq(projects.id, input.projectId),
    });

    if (!project) {
      return NextResponse.json(
        { message: "Project not found." },
        { status: 404 },
      );
    }

    if (project.userId !== sessionUserId) {
      return NextResponse.json(
        { message: "Only the project owner can add collaborators." },
        { status: 403 },
      );
    }

    const identifier = input.identifier.trim();

    const collaborator = await db.query.user.findFirst({
      where: or(eq(user.email, identifier), eq(user.name, identifier)),
    });

    if (!collaborator) {
      return NextResponse.json({ message: "User not found." }, { status: 404 });
    }

    if (collaborator.id === project.userId) {
      return NextResponse.json(
        { message: "Owner already has access." },
        { status: 400 },
      );
    }

    await db
      .insert(projectCollaborators)
      .values({
        projectId: input.projectId,
        userId: collaborator.id,
        role: input.role ?? "viewer",
      })
      .onConflictDoUpdate({
        target: [projectCollaborators.projectId, projectCollaborators.userId],
        set: { role: input.role ?? "viewer" },
      });

    return NextResponse.json({
      message: "Collaborator added.",
      collaborator: {
        id: collaborator.id,
        name: collaborator.name,
        email: collaborator.email,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Invalid request payload", issues: error.issues },
        { status: 400 },
      );
    }
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ message }, { status: 500 });
  }
}
