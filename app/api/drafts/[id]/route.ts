import { NextResponse } from "next/server";
import { getDraftById, updateDraft } from "@/lib/drafts";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    const draft = await getDraftById(id);

    if (!draft) {
      return NextResponse.json({ error: "Draft not found." }, { status: 404 });
    }

    return NextResponse.json({ draft });
  } catch (error) {
    console.error("Could not load draft:", error);

    return NextResponse.json(
      {
        error: "Could not load the draft.",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const { id } = await params;
    const body = await request.json();

    const content =
      typeof body.content === "string" ? body.content.trim() : undefined;

    const allowedStatuses = ["approved", "scheduled", "published"] as const;

    const status = allowedStatuses.includes(body.status)
      ? body.status
      : undefined;

    const scheduledFor =
      typeof body.scheduledFor === "string" ? body.scheduledFor : undefined;

    if (!content && !status) {
      return NextResponse.json(
        { error: "Provide draft content or a valid status update." },
        { status: 400 },
      );
    }

    const draft = await updateDraft(id, {
      content,
      status,
      scheduledFor,
    });

    if (!draft) {
      return NextResponse.json({ error: "Draft not found." }, { status: 404 });
    }

    return NextResponse.json({ draft });
  } catch (error) {
    console.error("Could not update draft:", error);

    return NextResponse.json(
      {
        error: "Could not update the draft.",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
