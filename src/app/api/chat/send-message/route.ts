import { NextResponse } from "next/server";
import { z } from "zod";
import { nanoid } from "nanoid";
import { db } from "@/db";
import { chats, executionResults, messages, projects } from "@/db/schema";
import { eq } from "drizzle-orm";
import { runAgent } from "@/lib/ai-agent";

const SendMessageSchema = z.object({
  projectId: z.string().min(1),
  message: z.string().min(1),
});

const toIsoStringSafe = (value: Date | string) => {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const input = SendMessageSchema.parse(body);

    const chat = await db.query.chats.findFirst({
      where: eq(chats.projectId, input.projectId),
    });
    if (!chat) {
      return NextResponse.json({ message: "Chat not found for this project" }, { status: 404 });
    }

    const project = await db.query.projects.findFirst({
      where: eq(projects.id, input.projectId),
    });
    if (!project?.neonApiKey) {
      return NextResponse.json({ message: "Missing Neon API key for this project." }, { status: 400 });
    }

    const historyRows = await db.query.messages.findMany({
      where: eq(messages.chatId, chat.id),
      orderBy: (messages, { asc }) => [asc(messages.createdAt)],
      limit: 8,
    });

    const history = historyRows.flatMap((row) => [
      { role: "user" as const, content: row.query },
      { role: "assistant" as const, content: row.reply },
    ]);

    const agentResult = await runAgent({
      message: input.message,
      neonApiKey: project.neonApiKey,
      history,
    });

    const messageId = nanoid();
    const dataLocation = agentResult.toolOutput
      ? {
          fileName: `${messageId}.json`,
          output: agentResult.toolOutput,
        }
      : null;

    const [newMessage] = await db
      .insert(messages)
      .values({
        id: messageId,
        query: input.message,
        reply: agentResult.reply,
        dataLocation,
        chatId: chat.id,
      })
      .returning();

    if (agentResult.toolOutput) {
      await db.insert(executionResults).values({
        id: nanoid(),
        messageId,
        executionJson: dataLocation,
        stdout: agentResult.toolOutput.prints ?? null,
      });
    }

    return NextResponse.json({
      userMessage: {
        role: "user" as const,
        content: newMessage.query,
        createdAt: toIsoStringSafe(newMessage.createdAt),
      },
      aiMessage: {
        role: "assistant" as const,
        content: newMessage.reply,
        createdAt: toIsoStringSafe(newMessage.createdAt),
        data_location: newMessage.dataLocation,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Invalid request payload", issues: error.issues },
        { status: 400 }
      );
    }
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ message }, { status: 500 });
  }
}
