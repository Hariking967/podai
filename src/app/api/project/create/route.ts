import { NextResponse } from "next/server";
import { z } from "zod";
import { nanoid } from "nanoid";
import { db } from "@/db";
import { chats, projects } from "@/db/schema";
import { eq } from "drizzle-orm";

const CreateProjectSchema = z.object({
  name: z.string().min(1),
  neonApiKey: z.string().optional(),
  userId: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const input = CreateProjectSchema.parse(body);

    const projectId = nanoid();
    const [newProject] = await db
      .insert(projects)
      .values({
        id: projectId,
        name: input.name,
        neonApiKey: input.neonApiKey,
        userId: input.userId,
      })
      .returning();

    const chatId = nanoid();
    const [newChat] = await db
      .insert(chats)
      .values({
        id: chatId,
        projectId,
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
        { status: 400 }
      );
    }
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ message }, { status: 500 });
  }
}
