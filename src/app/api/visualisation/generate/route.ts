import { NextResponse } from "next/server";
import { z } from "zod";
import OpenAI from "openai";
import { db } from "@/db";
import { projects } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getProjectRole, getSessionUserId, hasWriteAccess } from "@/lib/project-permissions";

const GenerateSchema = z.object({
  projectId: z.string().min(1),
  prompt: z.string().min(1),
  tableName: z.string().min(1),
});

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const input = GenerateSchema.parse(body);
    const userId = await getSessionUserId();
    if (!userId) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    const role = await getProjectRole(input.projectId, userId);
    if (!hasWriteAccess(role)) return NextResponse.json({ message: "Read-only" }, { status: 403 });

    const project = await db.query.projects.findFirst({ where: eq(projects.id, input.projectId) });
    if (!project?.neonApiKey) return NextResponse.json({ message: "No DB connection" }, { status: 400 });

    const systemPrompt = `You are a Python data visualization expert. Generate Python code that:
1. Connects to PostgreSQL using psycopg2 with the DATABASE_URL variable (already defined — do NOT redefine it)
2. Queries the specified table
3. Creates a matplotlib chart based on the user's request
4. The LAST statement must be: result = fig_to_base64(fig)
   where fig is the matplotlib figure object.
5. fig_to_base64 is available in scope — do NOT import it.
6. Only return Python code, no markdown fences, no explanation.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Table: ${input.tableName}\nChart request: ${input.prompt}`,
        },
      ],
      temperature: 0.2,
    });

    let code = completion.choices[0]?.message?.content ?? "";
    code = code.replace(/^```python\n?/m, "").replace(/^```\n?/m, "").replace(/\n?```$/m, "").trim();

    const fullCode = `DATABASE_URL = ${JSON.stringify(project.neonApiKey)}\n\n${code}`;

    return NextResponse.json({ code: fullCode });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ message: "Invalid" }, { status: 400 });
    const msg = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json({ message: msg }, { status: 500 });
  }
}
