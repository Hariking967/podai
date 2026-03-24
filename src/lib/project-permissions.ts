import "server-only";

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { projectCollaborators, projects } from "@/db/schema";
import { and, eq } from "drizzle-orm";

export type ProjectRole = "owner" | "editor" | "viewer";

export const getSessionUserId = async () => {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  return session?.user?.id ?? null;
};

export const getProjectRole = async (
  projectId: string,
  userId: string,
): Promise<ProjectRole | null> => {
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
  });

  if (!project) return null;
  if (project.userId === userId) return "owner";

  const collaborator = await db.query.projectCollaborators.findFirst({
    where: and(
      eq(projectCollaborators.projectId, projectId),
      eq(projectCollaborators.userId, userId),
    ),
  });

  return (collaborator?.role as ProjectRole | undefined) ?? null;
};

export const hasWriteAccess = (role: ProjectRole | null) =>
  role === "owner" || role === "editor";
