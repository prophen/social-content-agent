import { NextResponse } from "next/server";
import { createDraft, getDrafts } from "@/lib/drafts";

export async function GET() {
  try {
    const drafts = await getDrafts();

    return NextResponse.json({ drafts });
  } catch (error) {
    console.error("Could not load drafts:", error);

    return NextResponse.json(
      {
        error: "Could not load drafts.",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const topic = typeof body.topic === "string" ? body.topic.trim() : "";
    const content = typeof body.content === "string" ? body.content.trim() : "";

    if (!topic || !content) {
      return NextResponse.json(
        { error: "A topic and draft content are required." },
        { status: 400 },
      );
    }

    const draft = await createDraft(topic, content);

    return NextResponse.json({ draft }, { status: 201 });
  } catch (error) {
    console.error("Could not create draft:", error);

    return NextResponse.json(
      {
        error: "Could not create the draft.",
        detail: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
