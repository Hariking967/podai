import { NextResponse } from "next/server";
import { z } from "zod";
import { nanoid } from "nanoid";
import { db } from "@/db";
import { chats, executionResults, messages, projects } from "@/db/schema";
import { eq } from "drizzle-orm";
import { runAgent } from "@/lib/ai-agent";
import {
  uploadExecutionImage,
  uploadExecutionJson,
} from "@/lib/supabase-storage";
import {
  getProjectRole,
  getSessionUserId,
  hasWriteAccess,
} from "@/lib/project-permissions";

const LOG_PREFIX = "[SendMessage]";

const SendMessageSchema = z.object({
  projectId: z.string().min(1),
  message: z.string().min(1),
});

const toIsoStringSafe = (value: Date | string) => {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime())
    ? new Date().toISOString()
    : date.toISOString();
};

export async function POST(req: Request) {
  console.log(`${LOG_PREFIX} ========== NEW REQUEST ==========`);

  try {
    const body = await req.json();
    console.log(`${LOG_PREFIX} Request body received`);

    const input = SendMessageSchema.parse(body);
    console.log(`${LOG_PREFIX} Project ID: ${input.projectId}`);
    console.log(`${LOG_PREFIX} Message: ${input.message.substring(0, 100)}...`);

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

    // Step 1: Get project and Neon connection string
    console.log(`${LOG_PREFIX} Step 1: Fetching project details...`);
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, input.projectId),
    });
    if (!project) {
      console.error(
        `${LOG_PREFIX} ERROR: Project not found: ${input.projectId}`,
      );
      return NextResponse.json(
        { message: "Project not found." },
        { status: 404 },
      );
    }
    console.log(`${LOG_PREFIX} Project found: ${project.name}`);
    console.log(
      `${LOG_PREFIX} Neon API Key present: ${project.neonApiKey ? "YES" : "NO"}`,
    );

    if (!project.neonApiKey) {
      console.error(
        `${LOG_PREFIX} ERROR: Missing Neon API key for project ${project.id}`,
      );
      return NextResponse.json(
        { message: "Missing Neon API key for this project." },
        { status: 400 },
      );
    }
    console.log(
      `${LOG_PREFIX} Neon connection string (first 50 chars): ${project.neonApiKey.substring(0, 50)}...`,
    );

    // Step 2: Find active chat for project
    console.log(`${LOG_PREFIX} Step 2: Finding active chat for project...`);
    const chat = project.chatId
      ? await db.query.chats.findFirst({
          where: eq(chats.id, project.chatId),
        })
      : await db.query.chats.findFirst({
          where: eq(chats.projectId, input.projectId),
        });
    if (!chat) {
      console.error(
        `${LOG_PREFIX} ERROR: Chat not found for project ${input.projectId}`,
      );
      return NextResponse.json(
        { message: "Chat not found for this project" },
        { status: 404 },
      );
    }
    console.log(`${LOG_PREFIX} Chat found: ${chat.id}`);

    // Step 3: Fetch chat history
    console.log(`${LOG_PREFIX} Step 3: Fetching chat history...`);
    const historyRows = await db.query.messages.findMany({
      where: eq(messages.chatId, chat.id),
      orderBy: (messages, { asc }) => [asc(messages.createdAt)],
      limit: 4,
    });
    console.log(`${LOG_PREFIX} History rows fetched: ${historyRows.length}`);

    const history = historyRows.flatMap((row) => [
      { role: "user" as const, content: row.query },
      { role: "assistant" as const, content: row.reply },
    ]);

    // Step 4: Run AI agent
    console.log(`${LOG_PREFIX} Step 4: Running AI agent...`);
    console.log(
      `${LOG_PREFIX} Passing neonApiKey to agent (length: ${project.neonApiKey.length})`,
    );

    const agentResult = await runAgent({
      message: input.message,
      neonApiKey: project.neonApiKey,
      history,
    });
    console.log(`${LOG_PREFIX} Agent completed`);
    console.log(`${LOG_PREFIX} Reply length: ${agentResult.reply.length}`);
    console.log(
      `${LOG_PREFIX} Tool output present: ${agentResult.toolOutput ? "YES" : "NO"}`,
    );

    // Step 5: Prepare message data
    console.log(`${LOG_PREFIX} Step 5: Preparing message data...`);
    const messageId = nanoid();
    console.log(`${LOG_PREFIX} Generated message ID: ${messageId}`);

    let dataLocation: {
      fileName: string;
      bucket?: string;
      path?: string;
      imageFileName?: string;
      imageBucket?: string;
      imagePath?: string;
      output?: unknown;
    } | null = null;

    // Step 6: Upload to Supabase if there's tool output
    if (agentResult.toolOutput) {
      console.log(
        `${LOG_PREFIX} Step 6: Uploading execution result to Supabase...`,
      );
      const fileName = `${messageId}.json`;

      try {
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
              projectId: input.projectId,
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
            projectId: input.projectId,
            fileName,
            payload: storagePayload,
          });
          console.log(`${LOG_PREFIX} Supabase upload successful`);
          console.log(`${LOG_PREFIX} Bucket: ${uploadResult.bucket}`);
          console.log(`${LOG_PREFIX} Path: ${uploadResult.path}`);
        } catch (jsonError) {
          console.error(
            `${LOG_PREFIX} Supabase JSON upload failed:`,
            jsonError,
          );
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
      } catch (uploadError) {
        console.error(`${LOG_PREFIX} Supabase upload failed:`, uploadError);
        dataLocation = {
          fileName,
          output: agentResult.toolOutput?.result ?? agentResult.toolOutput,
        };
      }
    } else {
      console.log(`${LOG_PREFIX} Step 6: Skipped (no tool output)`);
    }

    // Step 7: Insert message into database
    console.log(`${LOG_PREFIX} Step 7: Inserting message into database...`);
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
    console.log(`${LOG_PREFIX} Message inserted: ${newMessage.id}`);

    // Step 8: Insert execution result if present
    if (agentResult.toolOutput) {
      console.log(`${LOG_PREFIX} Step 8: Inserting execution result...`);
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
        console.log(`${LOG_PREFIX} Execution result inserted successfully`);
      } catch (execError) {
        console.error(
          `${LOG_PREFIX} Failed to insert execution result:`,
          execError,
        );
        // Non-fatal error - message was already saved
      }
    } else {
      console.log(`${LOG_PREFIX} Step 8: Skipped (no tool output)`);
    }

    // Step 9: Return response
    console.log(`${LOG_PREFIX} Step 9: Returning success response`);
    console.log(`${LOG_PREFIX} ========== REQUEST COMPLETE ==========`);

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
    console.error(`${LOG_PREFIX} ========== ERROR ==========`);
    console.error(`${LOG_PREFIX} Error type: ${error?.constructor?.name}`);
    console.error(
      `${LOG_PREFIX} Error message: ${error instanceof Error ? error.message : String(error)}`,
    );
    console.error(
      `${LOG_PREFIX} Stack trace:`,
      error instanceof Error ? error.stack : "N/A",
    );

    if (error instanceof z.ZodError) {
      console.error(
        `${LOG_PREFIX} Zod validation errors:`,
        JSON.stringify(error.issues, null, 2),
      );
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
