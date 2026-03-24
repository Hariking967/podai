import { NextResponse } from "next/server";
import { z } from "zod";
import { nanoid } from "nanoid";
import { db } from "@/db";
import { chats, projects } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSessionUserId } from "@/lib/project-permissions";

const CreateProjectSchema = z.object({
  name: z.string().trim().min(1),
  neonApiKey: z.string().trim().min(1),
  userId: z.string().min(1).optional(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const input = CreateProjectSchema.parse(body);

    const sessionUserId = await getSessionUserId();
    if (!sessionUserId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const projectId = nanoid();
    const [newProject] = await db
      .insert(projects)
      .values({
        id: projectId,
        name: input.name,
        neonApiKey: input.neonApiKey,
        userId: sessionUserId,
      })
      .returning();

    const chatId = nanoid();
    const [newChat] = await db
      .insert(chats)
      .values({
        id: chatId,
        projectId,
        name: "Default",
        messages: [],
      })
      .returning();

    await db.update(projects).set({ chatId }).where(eq(projects.id, projectId));

    return NextResponse.json({
      project: newProject,
      chat: newChat,
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
