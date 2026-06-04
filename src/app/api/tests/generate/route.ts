import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { queryTests } from "@/db/schema";
import { nanoid } from "nanoid";
import { getSessionUserId, getProjectRole, hasWriteAccess } from "@/lib/project-permissions";

const TestGenSchema = z.object({
  projectId: z.string().min(1),
  query: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const input = TestGenSchema.parse(body);

    const sessionUserId = await getSessionUserId();
    if (!sessionUserId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const role = await getProjectRole(input.projectId, sessionUserId);
    if (!hasWriteAccess(role)) {
      return NextResponse.json({ message: "Read-only access" }, { status: 403 });
    }

    // Generate basic test cases
    const tests = [
      {
        name: "Result count is valid",
        test_sql: `SELECT COUNT(*) as count FROM (${input.query}) t;`,
        description: "Verify query returns expected number of rows",
      },
      {
        name: "No unexpected NULLs",
        test_sql: `SELECT COUNT(*) as null_count FROM (${input.query}) t WHERE t IS NULL;`,
        description: "Check for unexpected NULL values in results",
      },
      {
        name: "Executes without error",
        test_sql: input.query,
        description: "Basic query execution validation",
      },
    ];

    // Store in DB
    for (const test of tests) {
      await db.insert(queryTests).values({
        id: nanoid(),
        projectId: input.projectId,
        testName: test.name,
        testSql: test.test_sql,
        expectedResult: { description: test.description },
      });
    }

    return NextResponse.json({ tests, count: tests.length });
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
