import OpenAI from "openai";
import { NextResponse } from "next/server";
import { brandVoice } from "@/lib/brandVoice";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const topic = body.topic?.trim();

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
