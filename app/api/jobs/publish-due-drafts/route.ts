import { NextResponse } from "next/server";
import { publishDueDrafts } from "@/lib/drafts";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const expectedSecret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");

  if (!expectedSecret) {
    console.error("CRON_SECRET is not configured.");

    return NextResponse.json(
      { error: "Publisher job is not configured." },
      { status: 500 },
    );
  }

  if (authorization !== `Bearer ${expectedSecret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const publishedDrafts = await publishDueDrafts();

    return NextResponse.json({
      message: "Publisher job completed.",
      publishedCount: publishedDrafts.length,
      publishedDraftIds: publishedDrafts.map((draft) => draft.id),
      ranAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Publisher job failed:", error);

    return NextResponse.json(
      {
        error: "Publisher job failed.",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
