import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { queryOptimizations, projects } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSessionUserId, getProjectRole } from "@/lib/project-permissions";
import { nanoid } from "nanoid";
import { openaiClient } from "@/lib/openai-client";
import { runSqlOnNeon } from "@/lib/neon-sql";

const OptimizeSchema = z.object({
  projectId: z.string().min(1),
  query: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const input = OptimizeSchema.parse(body);

    const sessionUserId = await getSessionUserId();
    if (!sessionUserId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const role = await getProjectRole(input.projectId, sessionUserId);
    if (!role) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const project = await db.query.projects.findFirst({
      where: eq(projects.id, input.projectId),
    });

    if (!project?.neonApiKey) {
      return NextResponse.json(
        { message: "Missing Neon connection" },
        { status: 400 }
      );
    }

    // Run EXPLAIN ANALYZE
    const explainQuery = `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${input.query}`;
    let explainResult;
    try {
      explainResult = await runSqlOnNeon({
        connectionString: project.neonApiKey,
        query: explainQuery,
      });
    } catch (err) {
      return NextResponse.json(
        { message: `EXPLAIN failed: ${err instanceof Error ? err.message : "Unknown error"}` },
        { status: 400 }
      );
    }

    const explainJson = explainResult.rows[0] || null;

    // Ask AI for optimizations
    const optimizationPrompt = `You are a PostgreSQL expert. Analyze this EXPLAIN output and suggest optimizations for performance:

Query: ${input.query}

EXPLAIN output: ${JSON.stringify(explainJson, null, 2)}

Provide:
1. 1-2 specific optimization suggestions (e.g., "Add index on user_id", "Rewrite JOIN")
2. Estimated improvement percentage

Return ONLY valid JSON (no markdown):
{"suggestions": ["suggestion 1", "suggestion 2"], "estimatedImprovement": "20%", "rewrittenQuery": null}`;

    const completion = await openaiClient.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [{ role: "user", content: optimizationPrompt }],
      temperature: 0.7,
      max_tokens: 500,
    });

    const aiResponse = completion.choices[0]?.message?.content || "{}";
    type Suggestions = { suggestions: string[]; estimatedImprovement: string; rewrittenQuery: string | null };
    let suggestions: Suggestions = { suggestions: [], estimatedImprovement: "Unknown", rewrittenQuery: null };
    try {
      const cleanedResponse = aiResponse.replace(/```json\n?|\n?```/g, "").trim();
      suggestions = JSON.parse(cleanedResponse);
    } catch {
      suggestions = {
        suggestions: ["Review query execution plan for sequential scans"],
        estimatedImprovement: "5-10%",
        rewrittenQuery: null
      };
    }

    // Store in DB
    await db.insert(queryOptimizations).values({
      id: nanoid(),
      projectId: input.projectId,
      originalQuery: input.query,
      suggestedQuery: suggestions.rewrittenQuery || input.query,
      explainJson: explainJson ? (explainJson as Record<string, unknown>) : {},
      estimatedImprovement: suggestions.estimatedImprovement,
    });

    return NextResponse.json({
      suggestions: suggestions.suggestions,
      estimatedImprovement: suggestions.estimatedImprovement,
      rewrittenQuery: suggestions.rewrittenQuery,
      explainJson,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Invalid request", issues: error.issues },
        { status: 400 }
      );
    }
    const message = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json({ message }, { status: 500 });
  }
}
