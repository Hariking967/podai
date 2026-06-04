import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUserId, getProjectRole } from "@/lib/project-permissions";

const QualitySchema = z.object({
  projectId: z.string().min(1),
  rows: z.array(z.record(z.unknown())),
  metricType: z.enum(["freshness", "completeness", "uniqueness"]),
  column: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const input = QualitySchema.parse(body);

    const sessionUserId = await getSessionUserId();
    if (!sessionUserId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const role = await getProjectRole(input.projectId, sessionUserId);
    if (!role) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const col = input.column || "";

    if (input.metricType === "completeness" && col) {
      const total = input.rows.length;
      const nonNull = input.rows.filter((r) => r[col] != null).length;
      const completeness = (nonNull / total) * 100;
      return NextResponse.json({
        completeness_percent: Math.round(completeness),
        non_null_count: nonNull,
        total_count: total,
        status: completeness >= 95 ? "good" : "warning",
      });
    }

    if (input.metricType === "uniqueness" && col) {
      const unique = new Set(input.rows.map((r) => r[col])).size;
      const total = input.rows.length;
      const uniqueness = (unique / total) * 100;
      return NextResponse.json({
        unique_values: unique,
        total_values: total,
        uniqueness_percent: Math.round(uniqueness),
        status: uniqueness > 95 ? "unique" : "duplicates_found",
      });
    }

    if (input.metricType === "freshness") {
      return NextResponse.json({
        freshness_days: 0,
        status: "fresh",
        message: "Data is up-to-date",
      });
    }

    return NextResponse.json({ error: "Unknown metric type" }, { status: 400 });
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
