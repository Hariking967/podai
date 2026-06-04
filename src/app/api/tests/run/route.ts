import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { projects, queryTests } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getSessionUserId, getProjectRole } from "@/lib/project-permissions";
import { runSqlOnNeon } from "@/lib/neon-sql";

const TestRunSchema = z.object({
  projectId: z.string().min(1),
  testIds: z.array(z.string()),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const input = TestRunSchema.parse(body);

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

    // Fetch and run tests
    const tests = await db.query.queryTests.findMany({
      where: eq(queryTests.projectId, input.projectId),
    });

    const results = [];
    for (const test of tests.filter((t) => input.testIds.includes(t.id))) {
      let passed = false;
      let errorMsg: string | null = null;
      try {
        const result = await runSqlOnNeon({
          connectionString: project.neonApiKey,
          query: test.testSql,
        });
        passed = result.rows.length > 0;
      } catch (err) {
        errorMsg = err instanceof Error ? err.message : "Unknown error";
        passed = false;
      }

      // Update test result
      await db.update(queryTests)
        .set({
          lastRunAt: new Date(),
          lastRunStatus: passed ? "pass" : "fail",
          lastRunError: errorMsg,
        })
        .where(eq(queryTests.id, test.id));

      results.push({
        testId: test.id,
        testName: test.testName,
        passed,
        error: errorMsg,
      });
    }

    const passed = results.filter((r) => r.passed).length;
    return NextResponse.json({
      results,
      passed,
      total: results.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json({ message }, { status: 500 });
  }
}
