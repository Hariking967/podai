import { NextResponse } from "next/server";
import { z } from "zod";
import { getProjectRole, getSessionUserId } from "@/lib/project-permissions";

const AprioriSchema = z.object({
  projectId: z.string().min(1),
  rows: z.array(z.record(z.unknown())),
  columns: z.array(z.string()).min(2),
  minSupport: z.number().min(0.01).max(1).default(0.1),
  minConfidence: z.number().min(0.01).max(1).default(0.5),
  minLift: z.number().min(0).default(1.0),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const input = AprioriSchema.parse(body);

    const sessionUserId = await getSessionUserId();
    if (!sessionUserId) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    const role = await getProjectRole(input.projectId, sessionUserId);
    if (!role) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;
    if (!backendUrl) {
      return NextResponse.json({ message: "Backend URL not configured" }, { status: 500 });
    }

    const res = await fetch(`${backendUrl}/apriori`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rows: input.rows,
        columns: input.columns,
        min_support: input.minSupport,
        min_confidence: input.minConfidence,
        min_lift: input.minLift,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Backend error" }));
      return NextResponse.json({ message: err.detail || "Apriori failed" }, { status: res.status });
    }

    const result = await res.json();
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ message: "Invalid request", issues: error.issues }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ message }, { status: 500 });
  }
}
