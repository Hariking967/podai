import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { chats, executionResults, messages, projects } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";

const DeleteHistorySchema = z.object({
  projectId: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const input = DeleteHistorySchema.parse(body);

    const project = await db.query.projects.findFirst({
      where: eq(projects.id, input.projectId),
    });

    if (!project) {
      return NextResponse.json(
        { message: "Project not found." },
        { status: 404 },
      );
    }

    const chat = project.chatId
      ? await db.query.chats.findFirst({
          where: eq(chats.id, project.chatId),
        })
      : await db.query.chats.findFirst({
          where: eq(chats.projectId, input.projectId),
        });

    if (!chat) {
      return NextResponse.json(
        { message: "Chat not found for this project." },
        { status: 404 },
      );
    }

    const rows = await db.query.messages.findMany({
      where: eq(messages.chatId, chat.id),
    });

    const messageIds = rows.map((row) => row.id);
    if (messageIds.length) {
      await db
        .delete(executionResults)
        .where(inArray(executionResults.messageId, messageIds));
    }

    await db.delete(messages).where(eq(messages.chatId, chat.id));

    return NextResponse.json({
      chatId: chat.id,
      deletedMessages: messageIds.length,
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
