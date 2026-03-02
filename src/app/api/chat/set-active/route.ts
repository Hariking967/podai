import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { chats, projects } from "@/db/schema";
import { and, eq } from "drizzle-orm";

const SetActiveSchema = z.object({
  projectId: z.string().min(1),
  chatId: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const input = SetActiveSchema.parse(body);

    const project = await db.query.projects.findFirst({
      where: eq(projects.id, input.projectId),
    });

    if (!project) {
      return NextResponse.json(
        { message: "Project not found." },
        { status: 404 },
      );
    }

    const chat = await db.query.chats.findFirst({
      where: and(
        eq(chats.id, input.chatId),
        eq(chats.projectId, input.projectId),
      ),
    });

    if (!chat) {
      return NextResponse.json(
        { message: "Chat not found for this project." },
        { status: 404 },
      );
    }

    await db
      .update(projects)
      .set({ chatId: input.chatId })
      .where(eq(projects.id, input.projectId));

    return NextResponse.json({
      chatId: input.chatId,
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
