import { NextResponse } from "next/server";
import { brandVoice } from "@/lib/brandVoice";

export function GET() {
  return NextResponse.json(brandVoice);
}
