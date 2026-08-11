import { z } from "zod";
import { verifyTimezone } from "@/lib/security.server";

const decisionSchema = z.object({
  intent: z.enum(["BOOK_MEETING", "RESCHEDULE", "CANCEL", "NEEDS_INFORMATION", "NOT_READY", "QUESTION", "UNCLEAR"]),
  confidence: z.number().min(0).max(1),
  meeting_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  meeting_time: z.string().regex(/^\d{2}:\d{2}$/).nullable(),
  timezone: z.string().nullable(),
  booking: z.boolean(),
  reschedule: z.boolean(),
  cancellation: z.boolean(),
  asking_for_information: z.boolean(),
  uncertain: z.boolean(),
});

export type GeminiDecision = z.infer<typeof decisionSchema>;

const PROMPT_VERSION = "v1";

function buildPrompt(params: {
  emailText: string;
  senderTimezone?: string | null;
  subject?: string | null;
}): string {
  return [
    "You are an AI scheduling classifier for SlotSync.",
    "Return ONLY valid JSON with these keys:",
    "intent, confidence, meeting_date, meeting_time, timezone, booking, reschedule, cancellation, asking_for_information, uncertain.",
    "- intent must be one of: BOOK_MEETING, RESCHEDULE, CANCEL, NEEDS_INFORMATION, NOT_READY, QUESTION, UNCLEAR.",
    "- confidence is a float 0 to 1.",
    "- meeting_date must be YYYY-MM-DD or null.",
    "- meeting_time must be HH:MM 24h or null.",
    "- timezone must be IANA string or null.",
    "- booking/reschedule/cancellation/asking_for_information/uncertain are booleans.",
    "Rules:",
    "- If the reply asks to move an existing meeting, intent=RESCHEDULE.",
    "- If the reply cancels, intent=CANCEL.",
    "- If they want more info or are unsure, intent=NEEDS_INFORMATION or NOT_READY.",
    "- If you cannot infer intent confidently, intent=UNCLEAR and uncertain=true.",
    "Use the sender timezone hint if supplied, but only if it is a valid IANA timezone.",
    `Sender timezone hint: ${params.senderTimezone ?? ""}`,
    `Subject: ${params.subject ?? ""}`,
    "Email:",
    params.emailText,
  ].join("\n");
}

function parseGeminiJson(text: string): unknown {
  const trimmed = text.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return JSON.parse(trimmed);
  }
  const match = trimmed.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Gemini response is not JSON");
  return JSON.parse(match[0]);
}

export async function extractGeminiDecision(params: {
  emailText: string;
  senderTimezone?: string | null;
  subject?: string | null;
}): Promise<{ decision: GeminiDecision; promptVersion: string; raw: unknown }> {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY");
  }

  const prompt = buildPrompt(params);
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          responseMimeType: "application/json",
        },
      }),
    },
  );

  if (!response.ok) {
    const err = await response.text().catch(() => "");
    throw new Error(`Gemini error ${response.status}: ${err}`);
  }

  const payload = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };

  const text = payload.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error("Gemini response missing content");
  }

  const raw = parseGeminiJson(text);
  const decision = decisionSchema.parse(raw);
  const tz = verifyTimezone(decision.timezone);

  return {
    decision: {
      ...decision,
      timezone: tz,
    },
    promptVersion: PROMPT_VERSION,
    raw,
  };
}
