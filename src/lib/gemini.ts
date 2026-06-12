import "server-only";
import { GoogleGenAI } from "@google/genai";
import { requireServerEnv } from "@/lib/env";

/**
 * Server-side Gemini client and the legal-answer streaming call.
 *
 * The model only ever receives: the system prompt + the public law text + the
 * user's question. It must NEVER receive principal PII (name, OIB, school) —
 * none is added here, and the route handler does not pass any.
 */

/** Model on the gemini-flash-lite tier. Override with GEMINI_MODEL if needed. */
export const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-flash-lite-latest";

/**
 * System instruction (Croatian). Answer only from the supplied law text, always
 * cite the article (članak), and do not guess if the answer isn't there.
 */
const SYSTEM_PROMPT_HR = [
  "Ti si asistent ravnateljima osnovnih škola u Hrvatskoj.",
  "Odgovaraj isključivo na temelju priloženog teksta zakona i pravilnika.",
  "Uvijek navedi broj članka na koji se pozivaš.",
  "Ako odgovor ne postoji u priloženom tekstu, jasno reci da informacija nije u",
  "dostupnim propisima i nemoj nagađati.",
  "Odgovaraj na hrvatskom jeziku.",
  "Odgovaraj u običnom tekstu, bez markdown oznaka (bez zvjezdica za podebljavanje).",
].join(" ");

let client: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
  if (!client) {
    client = new GoogleGenAI({ apiKey: requireServerEnv("GEMINI_API_KEY") });
  }
  return client;
}

/**
 * Stream an answer grounded in `lawText`. Returns an async generator of
 * response chunks; read `chunk.text` from each.
 */
export async function streamLegalAnswer(question: string, lawText: string) {
  const systemInstruction = `${SYSTEM_PROMPT_HR}\n\n===== TEKST PROPISA =====\n\n${lawText}`;

  return getClient().models.generateContentStream({
    model: GEMINI_MODEL,
    contents: question,
    config: { systemInstruction },
  });
}
