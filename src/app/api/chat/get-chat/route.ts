import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { chats, executionResults, messages } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";

const GetChatSchema = z.object({
  projectId: z.string().min(1),
});

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const input = GetChatSchema.parse({
      projectId: url.searchParams.get("projectId"),
    });

    const chat = await db.query.chats.findFirst({
      where: eq(chats.projectId, input.projectId),
    });

    if (!chat) {
      return NextResponse.json({ chatId: null, messages: [] });
    }

    const rows = await db.query.messages.findMany({
      where: eq(messages.chatId, chat.id),
      orderBy: (messages, { asc }) => [asc(messages.createdAt)],
    });

    const messageIds = rows.map((row) => row.id);
    const executionRows = messageIds.length
      ? await db.query.executionResults.findMany({
          where: inArray(executionResults.messageId, messageIds),
        })
      : [];

    const executionMap = new Map(
      executionRows.map((row) => [row.messageId, row.executionJson])
    );

    const formatted = rows.flatMap((row) => [
      {
        role: "user" as const,
        content: row.query,
        createdAt: row.createdAt.toISOString(),
      },
      {
        role: "assistant" as const,
        content: row.reply,
        createdAt: row.createdAt.toISOString(),
        data_location: executionMap.get(row.id) ?? row.dataLocation,
      },
    ]);

    return NextResponse.json({ chatId: chat.id, messages: formatted });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Invalid query params", issues: error.issues },
        { status: 400 }
      );
    }
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ message }, { status: 500 });
  }
}
