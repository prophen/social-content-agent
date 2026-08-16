import { NextResponse } from "next/server";
import { createDraft, getDrafts } from "@/lib/drafts";
import { createClient } from "@/lib/supabase/server";

async function requireUser() {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return null;
  }

  return user;
}

export async function GET() {
  try {
    const user = await requireUser();

    if (!user) {
      return NextResponse.json(
        { error: "You must be signed in to view drafts." },
        { status: 401 },
      );
    }

    const drafts = await getDrafts();

    return NextResponse.json({ drafts });
  } catch (error) {
    console.error("Could not load drafts:", error);

    return NextResponse.json(
      { error: "Could not load drafts." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();

    if (!user) {
      return NextResponse.json(
        { error: "You must be signed in to create drafts." },
        { status: 401 },
      );
    }

    const body = await request.json();

    const topic = typeof body.topic === "string" ? body.topic.trim() : "";
    const content = typeof body.content === "string" ? body.content.trim() : "";

    if (!topic || !content) {
      return NextResponse.json(
        { error: "A topic and draft content are required." },
        { status: 400 },
      );
    }

    const draft = await createDraft(topic, content, user.id);

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
