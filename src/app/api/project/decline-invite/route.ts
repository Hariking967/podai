import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { projectInvitations } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSessionUserId } from "@/lib/project-permissions";

export async function POST(req: Request) {
  try {
    const { token } = z.object({ token: z.string().min(1) }).parse(await req.json());
    const userId = await getSessionUserId();
    if (!userId) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    await db
      .update(projectInvitations)
      .set({ status: "declined" })
      .where(eq(projectInvitations.token, token));
    return NextResponse.json({ message: "Declined" });
  } catch {
    return NextResponse.json({ message: "Internal error" }, { status: 500 });
  }
}
