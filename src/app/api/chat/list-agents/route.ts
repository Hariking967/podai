import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { chats, projects } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getProjectRole, getSessionUserId } from "@/lib/project-permissions";

const ListAgentsSchema = z.object({
  projectId: z.string().min(1),
});

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const input = ListAgentsSchema.parse({
      projectId: url.searchParams.get("projectId"),
    });

    const sessionUserId = await getSessionUserId();
    if (!sessionUserId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    const role = await getProjectRole(input.projectId, sessionUserId);
    if (!role) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
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

    const rows = await db.query.chats.findMany({
      where: eq(chats.projectId, input.projectId),
      orderBy: (chats, { asc }) => [asc(chats.createdAt)],
    });

    return NextResponse.json({
      activeChatId: project.chatId ?? null,
      agents: rows.map((row) => ({ id: row.id, name: row.name })),
    });
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
