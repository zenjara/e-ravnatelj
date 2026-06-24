import { getSession } from "@/lib/session";
import { retrieveRelevantChunks, buildContext } from "@/lib/retrieval";
import { streamLegalAnswer } from "@/lib/gemini";

// Retrieval (Supabase) and node:crypto (session) require the Node.js runtime.
export const runtime = "nodejs";

/** How many article chunks to retrieve and feed to the model. */
const TOP_K = 12;

/**
 * POST /api/ask  — body: { question: string }
 *
 * Requires an authenticated session. Retrieves the most relevant law articles
 * (RAG) and streams a Croatian answer grounded only in those. The AI receives
 * ONLY the question + retrieved public law text; no principal PII is included.
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

  let context: string;
  try {
    const chunks = await retrieveRelevantChunks(question.trim(), TOP_K);
    context = buildContext(chunks);
  } catch (e) {
    console.error("retrieval error:", e);
    return Response.json({ error: "Greška pri dohvaćanju propisa." }, { status: 502 });
  }

  let stream: Awaited<ReturnType<typeof streamLegalAnswer>>;
  try {
    stream = await streamLegalAnswer(question.trim(), context);
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
