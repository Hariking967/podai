import { NextResponse } from "next/server";
import { z } from "zod";
import { nanoid } from "nanoid";
import { db } from "@/db";
import { chats, executionResults, messages, projects } from "@/db/schema";
import { eq } from "drizzle-orm";
import { runAgent } from "@/lib/ai-agent";
import { openaiClient } from "@/lib/openai-client";
import {
  uploadExecutionImage,
  uploadExecutionJson,
} from "@/lib/supabase-storage";
import {
  getProjectRole,
  getSessionUserId,
  hasWriteAccess,
} from "@/lib/project-permissions";

const LOG_PREFIX = "[SendMessageStream]";

const SendMessageSchema = z.object({
  projectId: z.string().min(1),
  message: z.string().min(1),
});

type AgentOutput = {
  reply: string;
  toolOutput: {
    prints: string;
    result: unknown;
    error: { message: string; traceback: string } | null;
  } | null;
};

const toIsoStringSafe = (value: Date | string) => {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime())
    ? new Date().toISOString()
    : date.toISOString();
};

const isConversationalIntent = (message: string) => {
  const text = message.trim().toLowerCase();
  const dataKeywords =
    /\b(select|insert|update|delete|join|table|schema|sql|database|query|plot|chart|graph|python|matplotlib|seaborn|histogram|bar|line|scatter|pie|visualize|correlation|regression|cte|window|group by|having)\b/i;
  const conversationalKeywords =
    /\b(hi|hello|hey|thanks|thank you|explain|summarize|rewrite|improve|idea|plan|strategy|brainstorm|help me understand|what is|how does)\b/i;

  if (dataKeywords.test(text)) return false;
  return conversationalKeywords.test(text) || text.length < 80;
};

const sseEvent = (event: string, payload: unknown) =>
  `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;

const persistMessageAndExecution = async ({
  projectId,
  chatId,
  query,
  agentResult,
}: {
  projectId: string;
  chatId: string;
  query: string;
  agentResult: AgentOutput;
}) => {
  const messageId = nanoid();
  let dataLocation: {
    fileName: string;
    bucket?: string;
    path?: string;
    imageFileName?: string;
    imageBucket?: string;
    imagePath?: string;
    output?: unknown;
  } | null = null;

  if (agentResult.toolOutput) {
    const fileName = `${messageId}.json`;

    const rawResult = agentResult.toolOutput?.result;
    const outputPayload =
      rawResult ??
      (agentResult.toolOutput?.error
        ? { error: agentResult.toolOutput.error }
        : { error: { message: "No result", traceback: "" } });

    const storagePayload =
      outputPayload && typeof outputPayload === "object"
        ? structuredClone(outputPayload)
        : outputPayload;

    let imageUpload: {
      bucket: string;
      path: string;
      fileName: string;
    } | null = null;

    if (outputPayload && typeof outputPayload === "object") {
      const resultObj = outputPayload as Record<string, unknown>;
      const imageBase64 =
        (resultObj.image_base64 as string | undefined) ??
        (resultObj.imageBase64 as string | undefined) ??
        (typeof resultObj.image === "string"
          ? (resultObj.image as string)
          : resultObj.image &&
              typeof resultObj.image === "object" &&
              "base64" in resultObj.image
            ? (resultObj.image as { base64?: string }).base64
            : undefined);
      const imageMime =
        (resultObj.image_mime as string | undefined) ??
        (resultObj.imageMime as string | undefined) ??
        (resultObj.image &&
        typeof resultObj.image === "object" &&
        "mime" in resultObj.image
          ? (resultObj.image as { mime?: string }).mime
          : "image/png");

      if (imageBase64) {
        const imageFileName = `${messageId}.png`;
        const imageResult = await uploadExecutionImage({
          projectId,
          fileName: imageFileName,
          base64: imageBase64,
          contentType: imageMime || "image/png",
        });
        imageUpload = {
          bucket: imageResult.bucket,
          path: imageResult.path,
          fileName: imageFileName,
        };
      }
    }

    if (storagePayload && typeof storagePayload === "object") {
      const resultObj = storagePayload as Record<string, unknown>;
      delete resultObj.image_base64;
      delete resultObj.imageBase64;
      delete resultObj.image_mime;
      delete resultObj.imageMime;
      delete resultObj.image;
    }

    let uploadResult: { bucket: string; path: string } | null = null;
    try {
      uploadResult = await uploadExecutionJson({
        projectId,
        fileName,
        payload: storagePayload,
      });
    } catch (error) {
      console.warn(`${LOG_PREFIX} JSON upload failed`, error);
    }

    dataLocation = {
      fileName,
      bucket: uploadResult?.bucket,
      path: uploadResult?.path,
      imageFileName: imageUpload?.fileName,
      imageBucket: imageUpload?.bucket,
      imagePath: imageUpload?.path,
      output: outputPayload,
    };
  }

  const [newMessage] = await db
    .insert(messages)
    .values({
      id: messageId,
      query,
      reply: agentResult.reply,
      dataLocation,
      chatId,
    })
    .returning();

  if (agentResult.toolOutput) {
    try {
      const outputResult = agentResult.toolOutput.result as
        | Record<string, unknown>
        | null
        | undefined;
      const hasImage =
        !!outputResult &&
        ("image_base64" in outputResult || "imageBase64" in outputResult);
      const hasRows =
        !!outputResult &&
        Array.isArray((outputResult as { rows?: unknown }).rows) &&
        Array.isArray((outputResult as { fields?: unknown }).fields);
      const executionType = hasRows && !hasImage ? "sql" : "python";
      const executionStatus = agentResult.toolOutput.error
        ? "error"
        : "success";

      await db.insert(executionResults).values({
        id: nanoid(),
        messageId,
        type: executionType,
        status: executionStatus,
        errorMessage: agentResult.toolOutput.error?.message ?? null,
        executionJson: dataLocation ?? outputResult ?? { output: null },
        stdout: agentResult.toolOutput.prints ?? null,
      });
    } catch (error) {
      console.warn(`${LOG_PREFIX} Failed to insert execution result`, error);
    }
  }

  return {
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
  };
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const input = SendMessageSchema.parse(body);

    const sessionUserId = await getSessionUserId();
    if (!sessionUserId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const role = await getProjectRole(input.projectId, sessionUserId);
    if (!role) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }
    if (!hasWriteAccess(role)) {
      return NextResponse.json(
        { message: "Read-only access for this project." },
        { status: 403 },
      );
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
    if (!project.neonApiKey) {
      return NextResponse.json(
        { message: "Missing Neon API key for this project." },
        { status: 400 },
      );
    }
    const neonApiKey = project.neonApiKey;

    const chat = project.chatId
      ? await db.query.chats.findFirst({ where: eq(chats.id, project.chatId) })
      : await db.query.chats.findFirst({
          where: eq(chats.projectId, input.projectId),
        });
    if (!chat) {
      return NextResponse.json(
        { message: "Chat not found for this project" },
        { status: 404 },
      );
    }

    const historyRows = await db.query.messages.findMany({
      where: eq(messages.chatId, chat.id),
      orderBy: (messageTable, { asc }) => [asc(messageTable.createdAt)],
      limit: 4,
    });

    const history = historyRows.flatMap((row) => [
      { role: "user" as const, content: row.query },
      { role: "assistant" as const, content: row.reply },
    ]);

    const conversational = isConversationalIntent(input.message);

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start: async (controller) => {
        let agentResult: AgentOutput = {
          reply: "",
          toolOutput: null,
        };

        const enqueue = (event: string, payload: unknown) => {
          controller.enqueue(encoder.encode(sseEvent(event, payload)));
        };

        try {
          enqueue("meta", {
            conversational,
            mode: conversational ? "chat" : "tool",
          });

          if (conversational) {
            const completion = await openaiClient.chat.completions.create({
              model: process.env.OPENAI_FAST_MODEL ?? "gpt-4.1-nano",
              stream: true,
              temperature: 0.3,
              max_tokens: 450,
              messages: [
                {
                  role: "system",
                  content:
                    "You are XBase AI. Be concise, clear, and helpful. Keep responses practical.",
                },
                ...history.map((entry) => ({
                  role: entry.role,
                  content: entry.content,
                })),
                { role: "user", content: input.message },
              ],
            });

            let assembled = "";
            for await (const chunk of completion) {
              const delta = chunk.choices[0]?.delta?.content ?? "";
              if (!delta) continue;
              assembled += delta;
              enqueue("delta", { text: delta });
            }

            agentResult = {
              reply: assembled.trim(),
              toolOutput: null,
            };
          } else {
            enqueue("status", {
              message: "Running tools for your request...",
            });

            agentResult = await runAgent({
              message: input.message,
              neonApiKey,
              history,
            });

            if (agentResult.reply) {
              enqueue("delta", { text: agentResult.reply });
            }
          }

          const payload = await persistMessageAndExecution({
            projectId: input.projectId,
            chatId: chat.id,
            query: input.message,
            agentResult,
          });

          enqueue("complete", payload);
          controller.close();
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : "Failed to process request";
          enqueue("error", { message });
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ message }, { status: 500 });
  }
}
