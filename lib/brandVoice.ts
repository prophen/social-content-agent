export const brandVoice = {
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
} as const;
