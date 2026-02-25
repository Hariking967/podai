import { z } from "zod";
import { baseProcedure, createTRPCRouter } from "../init";
import { db } from "@/db";
import { chats, executionResults, messages, projects } from "@/db/schema";
import { eq, inArray } from "drizzle-orm";
import { nanoid } from "nanoid";
import { runAgent } from "@/lib/ai-agent";

export const chatRouter = createTRPCRouter({
  getChat: baseProcedure
    .input(z.object({ projectId: z.string().min(1) }))
    .query(async ({ input }) => {
      const chat = await db.query.chats.findFirst({
        where: eq(chats.projectId, input.projectId),
      });
      if (!chat) {
        return { chatId: null, messages: [] };
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

      return { chatId: chat.id, messages: formatted };
    }),

  sendMessage: baseProcedure
    .input(
      z.object({
        projectId: z.string().min(1),
        message: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      const chat = await db.query.chats.findFirst({
        where: eq(chats.projectId, input.projectId),
      });

      if (!chat) {
        throw new Error("Chat not found for this project");
      }

      const project = await db.query.projects.findFirst({
        where: eq(projects.id, input.projectId),
      });

      if (!project?.neonApiKey) {
        throw new Error("Missing Neon API key for this project.");
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

      return {
        userMessage: {
          role: "user" as const,
          content: newMessage.query,
          createdAt: newMessage.createdAt.toISOString(),
        },
        aiMessage: {
          role: "assistant" as const,
          content: newMessage.reply,
          createdAt: newMessage.createdAt.toISOString(),
          data_location: newMessage.dataLocation,
        },
      };
    }),
});
