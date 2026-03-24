import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { projectCollaborators, projects, user } from "@/db/schema";
import { eq, or } from "drizzle-orm";

const AddCollaboratorSchema = z.object({
  projectId: z.string().min(1),
  ownerId: z.string().min(1),
  identifier: z.string().trim().min(1),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const input = AddCollaboratorSchema.parse(body);

    const project = await db.query.projects.findFirst({
      where: eq(projects.id, input.projectId),
    });

    if (!project) {
      return NextResponse.json(
        { message: "Project not found." },
        { status: 404 },
      );
    }

    if (project.userId !== input.ownerId) {
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
      })
      .onConflictDoNothing();

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
