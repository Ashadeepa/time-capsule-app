import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const PROMPTS = [
  "What's happening in your life right now that you want to remember?",
  "What are you hoping is different by the time this arrives?",
  "What's one thing you don't want to forget — or want to tell them?",
] as const;

const SYSTEM_PROMPT = `You draft short, warm, personal letters for a "time capsule" app — a letter
someone writes now and receives again later. Write in first person, as if the sender is writing
directly. Match a reflective, intimate, unpolished-but-sincere tone (think: a letter to a friend,
not a greeting card). Weave the person's answers into flowing prose rather than restating them as
a list. Keep it to 2-4 short paragraphs. Output only the letter body — no greeting like "Dear
future me" unless it fits naturally, no signature, no preamble or explanation.`;

const anthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null;

// The write form checks this on mount to decide whether to show the guided-writing toggle
// at all — ANTHROPIC_API_KEY is server-only, so the client can't check it directly.
export async function GET() {
  return NextResponse.json({ available: anthropic !== null });
}

export async function POST(req: NextRequest) {
  if (!anthropic) {
    return NextResponse.json({ error: "Guided writing isn't available right now." }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { answers, title, deliveryDate } = body;
  if (!Array.isArray(answers) || answers.length !== PROMPTS.length || answers.some((a) => !a || typeof a !== "string")) {
    return NextResponse.json({ error: "All three prompts must be answered." }, { status: 400 });
  }

  const qa = PROMPTS.map((prompt, i) => `Q: ${prompt}\nA: ${answers[i]}`).join("\n\n");
  const context = [
    title && typeof title === "string" ? `Letter title: "${title}"` : null,
    deliveryDate ? `This letter will be delivered on: ${deliveryDate}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const response = await anthropic.messages.create({
    model: "claude-opus-5",
    max_tokens: 2000,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `${context ? context + "\n\n" : ""}Here are my answers to a few reflective prompts. Draft the letter from them:\n\n${qa}`,
      },
    ],
  });

  const draft = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();

  if (!draft) {
    return NextResponse.json({ error: "Couldn't draft a letter — try again." }, { status: 502 });
  }

  return NextResponse.json({ draft });
}
