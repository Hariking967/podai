import { z } from "zod";
import { baseProcedure, createTRPCRouter } from "../init";
import { db } from "@/db";
import { projects, chats } from "@/db/schema";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";

export const projectRouter = createTRPCRouter({
  create: baseProcedure
    .input(
      z.object({
        name: z.string().min(1),
        neonApiKey: z.string().optional(),
        userId: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      // 1. Create Project
      const projectId = nanoid();
      const [newProject] = await db.insert(projects).values({
        id: projectId,
        name: input.name,
        neonApiKey: input.neonApiKey,
        userId: input.userId,
      }).returning();

      // 2. Create Chat linked to Project
      const chatId = nanoid();
      const [newChat] = await db.insert(chats).values({
        id: chatId,
        projectId: projectId,
        messages: [],
      }).returning();

      // 3. Update Project with Chat ID (optional but good for bi-directional link if needed)
      await db.update(projects)
        .set({ chatId: chatId })
        .where(eq(projects.id, projectId));

      return {
        project: newProject,
        chat: newChat,
      };
    }),

  getAll: baseProcedure
    .input(z.object({ userId: z.string().min(1) }))
    .query(async ({ input }) => {
      return await db.query.projects.findMany({
        where: eq(projects.userId, input.userId),
        orderBy: (projects, { desc }) => [desc(projects.createdAt)],
      });
    }),
});
