import { NextResponse } from "next/server";
import { z } from "zod";
import { nanoid } from "nanoid";
import { db } from "@/db";
import { chats, projects } from "@/db/schema";
import { eq } from "drizzle-orm";

const CreateAgentSchema = z.object({
  projectId: z.string().min(1),
  name: z.string().trim().min(1),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const input = CreateAgentSchema.parse(body);

    const project = await db.query.projects.findFirst({
      where: eq(projects.id, input.projectId),
    });

    if (!project) {
      return NextResponse.json(
        { message: "Project not found." },
        { status: 404 },
      );
    }

    const chatId = nanoid();
    const [newChat] = await db
      .insert(chats)
      .values({
        id: chatId,
        projectId: input.projectId,
        name: input.name,
        messages: [],
      })
      .returning();

    await db
      .update(projects)
      .set({ chatId })
      .where(eq(projects.id, input.projectId));

    return NextResponse.json({
      chatId: newChat.id,
      chatName: newChat.name,
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
