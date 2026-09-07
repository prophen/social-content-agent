export type BrandVoice = {
  name: string;
  audience: string;
  tone: string[];
  goals: string[];
  avoid: string[];
  formatRules: string[];
  accuracyRules: string[];
  callToActionStyle: string;
};

export const brandVoice: BrandVoice = {
  name: "My AI Learning Voice",

  audience:
    "Developers, designers, and creative professionals who are learning practical AI skills.",

  tone: [
    "Curious rather than overconfident",
    "Practical and specific",
    "Honest about being in progress",
    "Clear and conversational",
  ],

  goals: [
    "Share useful lessons from real learning and project work.",
    "Build credibility through specific examples instead of broad claims.",
    "Invite thoughtful conversation with other builders.",
  ],

  avoid: [
    "guru",
    "revolutionary",
    "10x",
    "game-changing",
    "effortless",
    "guaranteed",
    "AI will replace everyone",
  ],

  formatRules: [
    "Start with a concise, specific hook.",
    "Use short paragraphs for LinkedIn readability.",
    "Include no more than three practical takeaways.",
    "Do not use more than five relevant hashtags.",
    "End with one thoughtful, open-ended question.",
    "Don't use em dashes",
  ],

  accuracyRules: [
    "Never invent accomplishments, client work, metrics, quotes, facts, or sources.",
    "If a claim needs evidence but none is provided, write it as a personal observation or omit it.",
    "Do not imply that an unfinished project is fully launched or publicly available.",
  ],

  callToActionStyle:
    "End with one curious, low-pressure question that invites others to share their experience.",
};

export function parseBrandVoice(value: unknown): BrandVoice {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Provide a complete brand voice.");
  }
  const input = value as Record<string, unknown>;
  const result = {} as BrandVoice;
  for (const key of ["name", "audience", "callToActionStyle"] as const) {
    const text = input[key];
    const limit = key === "name" ? 120 : 2000;
    if (typeof text !== "string" || !text.trim() || text.trim().length > limit) {
      throw new Error(`${key} is required and must be ${limit} characters or fewer.`);
    }
    result[key] = text.trim();
  }
  for (const key of ["tone", "goals", "avoid", "formatRules", "accuracyRules"] as const) {
    const list = input[key];
    if (!Array.isArray(list) || list.length > 30 || list.some((item) => typeof item !== "string" || !item.trim() || item.trim().length > 500)) {
      throw new Error(`${key} must contain at most 30 lines, each 1–500 characters.`);
    }
    result[key] = list.map((item: string) => item.trim());
  }
  return result;
}
