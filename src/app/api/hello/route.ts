import { NextResponse } from "next/server";
import { z } from "zod";

const HelloSchema = z.object({
  text: z.string(),
});

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const input = HelloSchema.parse({
      text: url.searchParams.get("text"),
    });

    return NextResponse.json({
      greeting: `hello ${input.text}`,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Invalid query params", issues: error.issues },
        { status: 400 }
      );
    }
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
