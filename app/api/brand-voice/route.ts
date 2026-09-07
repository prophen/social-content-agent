import { NextResponse } from "next/server";
import { parseBrandVoice } from "@/lib/brandVoice";
import { getBrandVoice, saveBrandVoice } from "@/lib/brandVoiceStore";
import { createClient } from "@/lib/supabase/server";

async function currentUser() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  return error ? null : user;
}

export async function GET() {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "Sign in to view your brand voice." }, { status: 401 });
    return NextResponse.json(await getBrandVoice(user.id), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Could not load brand voice. Please try again." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const user = await currentUser();
    if (!user) return NextResponse.json({ error: "Sign in to save your brand voice." }, { status: 401 });
    let voice;
    try {
      voice = parseBrandVoice(await request.json());
    } catch (error) {
      return NextResponse.json({ error: error instanceof SyntaxError ? "Invalid JSON." : (error as Error).message }, { status: 400 });
    }
    await saveBrandVoice(user.id, voice);
    return NextResponse.json(voice);
  } catch {
    return NextResponse.json({ error: "Could not save brand voice. Please try again." }, { status: 500 });
  }
}
