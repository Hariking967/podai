import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { chats, executionResults, messages } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";

const GetChatSchema = z.object({
  projectId: z.string().min(1),
});

const toIsoStringSafe = (value: Date | string) => {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
};

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
    let executionRows: Array<{ messageId: string; executionJson: unknown }> = [];
    if (messageIds.length) {
      try {
        if (db.query.executionResults?.findMany) {
          const rowsFromDb = await db.query.executionResults.findMany({
            where: inArray(executionResults.messageId, messageIds),
          });
          executionRows = rowsFromDb.map((row) => ({
            messageId: row.messageId,
            executionJson: row.executionJson,
          }));
        }
      } catch {
        executionRows = [];
      }
    }

    const executionMap = new Map(
      executionRows.map((row) => [row.messageId, row.executionJson])
    );

    const formatted = rows.flatMap((row) => [
      {
        role: "user" as const,
        content: row.query,
        createdAt: toIsoStringSafe(row.createdAt),
      },
      {
        role: "assistant" as const,
        content: row.reply,
        createdAt: toIsoStringSafe(row.createdAt),
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
