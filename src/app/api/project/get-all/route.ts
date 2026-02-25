import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { eq } from "drizzle-orm";

const GetAllProjectsSchema = z.object({
  userId: z.string().min(1),
});

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const input = GetAllProjectsSchema.parse({
      userId: url.searchParams.get("userId"),
    });

    const rows = await db.query.projects.findMany({
      where: eq(projects.userId, input.userId),
      orderBy: (projects, { desc }) => [desc(projects.createdAt)],
    });

    return NextResponse.json(rows);
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
