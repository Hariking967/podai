import { NextResponse } from "next/server";
import { z } from "zod";
import { createSignedDownloadUrl } from "@/lib/supabase-storage";

const GetDownloadUrlSchema = z.object({
  bucket: z.string().min(1),
  path: z.string().min(1),
});

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const input = GetDownloadUrlSchema.parse({
      bucket: url.searchParams.get("bucket"),
      path: url.searchParams.get("path"),
    });

    const signedUrl = await createSignedDownloadUrl({
      bucket: input.bucket,
      path: input.path,
      expiresIn: 120,
    });

    return NextResponse.json({ signedUrl });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { message: "Invalid query params", issues: error.issues },
        { status: 400 },
      );
    }

    const message =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ message }, { status: 500 });
  }
}
