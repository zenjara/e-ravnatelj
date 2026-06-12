import { getSession } from "@/lib/session";
import { loadLawCorpus } from "@/content/laws";
import { streamLegalAnswer } from "@/lib/gemini";

// fs (law loader) and node:crypto (session) require the Node.js runtime.
export const runtime = "nodejs";

/**
 * POST /api/ask  — body: { question: string }
 *
 * Requires an authenticated session. Streams a Croatian answer grounded only in
 * the law text. The AI receives ONLY the question + public law text; no
 * principal PII is ever included.
 */
export async function POST(req: Request): Promise<Response> {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Niste prijavljeni." }, { status: 401 });
  }

  let question: unknown;
  try {
    question = (await req.json())?.question;
  } catch {
    return Response.json({ error: "Neispravan zahtjev." }, { status: 400 });
  }

  if (typeof question !== "string" || !question.trim()) {
    return Response.json({ error: "Pitanje je obavezno." }, { status: 400 });
  }

  const { text: lawText } = await loadLawCorpus();
  if (!lawText) {
    return Response.json(
      { error: "Tekst propisa trenutno nije dostupan." },
      { status: 503 },
    );
  }

  let stream: Awaited<ReturnType<typeof streamLegalAnswer>>;
  try {
    stream = await streamLegalAnswer(question.trim(), lawText);
  } catch (e) {
    console.error("gemini request error:", e);
    return Response.json({ error: "Greška pri obradi upita." }, { status: 502 });
  }

  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          if (chunk.text) controller.enqueue(encoder.encode(chunk.text));
        }
        controller.close();
      } catch (e) {
        console.error("gemini stream error:", e);
        controller.error(e);
      }
    },
  });

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      // Disable proxy buffering so chunks reach the client as they arrive.
      "X-Accel-Buffering": "no",
    },
  });
}
