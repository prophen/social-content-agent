import OpenAI from "openai";
import { NextResponse } from "next/server";
import { brandVoice } from "@/lib/brandVoice";
import { createClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const MAX_GENERATIONS_PER_HOUR = 10;
const ONE_HOUR_IN_MS = 60 * 60 * 1000;

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

export async function POST(request: Request) {
  try {
    const user = await requireUser();

    if (!user) {
      return NextResponse.json(
        { error: "You must be signed in to generate a draft." },
        { status: 401 },
      );
    }

    const body = await request.json();
    const topic = typeof body?.topic === "string" ? body.topic.trim() : undefined;

    if (typeof topic !== "string" || topic.length > 300) {
      return NextResponse.json(
        { error: "Topic must be 300 characters or fewer." },
        { status: 400 },
      );
    }

    if (!topic) {
      return NextResponse.json(
        { error: "Please provide a topic." },
        { status: 400 },
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "The server is missing its OpenAI API key." },
        { status: 500 },
      );
    }

    const oneHourAgo = new Date(Date.now() - ONE_HOUR_IN_MS).toISOString();

    const { count, error: countError } = await supabaseAdmin
      .from("generation_requests")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", oneHourAgo);

    if (countError) {
      throw new Error(
        `Could not check the generation limit: ${countError.message}`,
      );
    }

    if ((count ?? 0) >= MAX_GENERATIONS_PER_HOUR) {
      return NextResponse.json(
        {
          error: `You have reached the limit of ${MAX_GENERATIONS_PER_HOUR} AI generations per hour. Please try again later.`,
        },
        { status: 429 },
      );
    }

    const response = await openai.responses.create({
      model: "gpt-5.6",

      instructions: `
      You are a social-media writing assistant.

      Follow this brand voice exactly:

      Brand name:
      ${brandVoice.name}

      Target audience:
      ${brandVoice.audience}

      Tone:
      ${brandVoice.tone.map((item) => `- ${item}`).join("\n")}

      Goals:
      ${brandVoice.goals.map((item) => `- ${item}`).join("\n")}

      Words and claims to avoid:
      ${brandVoice.avoid.map((item) => `- ${item}`).join("\n")}

      Format rules:
      ${brandVoice.formatRules.map((item) => `- ${item}`).join("\n")}

      Accuracy rules:
      ${brandVoice.accuracyRules.map((item) => `- ${item}`).join("\n")}

      Call-to-action guidance:
      ${brandVoice.callToActionStyle}

      Return only the final LinkedIn post text. Do not add a title,
      an explanation, a preface, or a label such as "Draft:".
      `,

      input: `Write one LinkedIn post about this topic: "${topic}"`,
    });

    const { error: insertError } = await supabaseAdmin
      .from("generation_requests")
      .insert({
        user_id: user.id,
      });

    if (insertError) {
      console.error(
        "Draft was generated, but the generation request could not be recorded:",
        insertError,
      );
    }

    return NextResponse.json({
      draft: response.output_text,
    });
  } catch (error) {
    console.error("Draft generation failed:", error);

    return NextResponse.json(
      { error: "Something went wrong while generating the draft." },
      { status: 500 },
    );
  }
}
