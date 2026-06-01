import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { notifications } from "@/db/schema";
import { desc, eq, and } from "drizzle-orm";
import { getSessionUserId } from "@/lib/project-permissions";

export async function GET() {
  const userId = await getSessionUserId();
  if (!userId) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

  const rows = await db.query.notifications.findMany({
    where: eq(notifications.userId, userId),
    orderBy: [desc(notifications.createdAt)],
    limit: 30,
  });

  return NextResponse.json({ data: rows });
}

export async function PATCH(req: Request) {
  try {
    const userId = await getSessionUserId();
    if (!userId) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    const body = await req.json();
    const { id } = z.object({ id: z.string().optional() }).parse(body);

    if (id) {
      await db
        .update(notifications)
        .set({ read: true })
        .where(and(eq(notifications.id, id), eq(notifications.userId, userId)));
    } else {
      await db
        .update(notifications)
        .set({ read: true })
        .where(eq(notifications.userId, userId));
    }

    return NextResponse.json({ message: "Marked read" });
  } catch {
    return NextResponse.json({ message: "Internal error" }, { status: 500 });
  }
}
