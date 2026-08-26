import { NextResponse } from "next/server";
import { getDraftEvents } from "@/lib/draftEvents";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json(
        { error: "You must be signed in to view draft activity." },
        { status: 401 },
      );
    }

    const { id } = await params;
    const events = await getDraftEvents(id);

    return NextResponse.json({ events });
  } catch (error) {
    console.error("Could not load draft events:", error);

    return NextResponse.json(
      { error: "Could not load draft activity." },
      { status: 500 },
    );
  }
}
