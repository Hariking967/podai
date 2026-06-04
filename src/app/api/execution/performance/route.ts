import { NextResponse } from "next/server";
import { z } from "zod";
import { parseExplain, findBottleneck } from "@/lib/explain-parser";

const PerformanceSchema = z.object({
  explainJson: z.record(z.unknown()),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const input = PerformanceSchema.parse(body);

    const timeline = parseExplain(input.explainJson);
    const bottleneck = timeline ? findBottleneck(timeline) : null;

    return NextResponse.json({
      timeline,
      bottleneck: bottleneck
        ? {
            node: bottleneck.nodeType,
            relation: bottleneck.relationName,
            duration: bottleneck.duration,
            percentage: bottleneck.percentage,
          }
        : null,
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
