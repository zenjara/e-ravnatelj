import { after } from "next/server";
import { getSession } from "@/lib/session";
import { getCurrentSchool } from "@/lib/school";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { retrieveRelevantChunks, buildContext } from "@/lib/retrieval";
import { streamLegalAnswer } from "@/lib/gemini";
import { slugify } from "@/lib/laws";

// Retrieval (Supabase) and node:crypto (session) require the Node.js runtime.
export const runtime = "nodejs";

/** How many article chunks to retrieve and feed to the model. */
const TOP_K = 12;

/** Hard daily cap on AI questions per user — a spend guard, tunable via env. */
const AI_DAILY_LIMIT = (() => {
  const n = Math.trunc(Number(process.env.AI_DAILY_LIMIT));
  return Number.isFinite(n) && n > 0 ? n : 60;
})();

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
  // Cap length before anything reaches the embedder/model. A legal question is
  // short; without this an oversized body is embedded + sent to Gemini verbatim
  // (needless cost, and a trivial way to run up the bill on a paid key).
  const q = question.trim().slice(0, 2000);

  // Daily spend cap: atomically bump this user's counter and stop before any
  // Gemini call once the limit is hit. Fails OPEN — if the counter can't be read
  // (migration not applied, transient DB error) we log and let the question
  // through rather than breaking the feature; retrieval below would fail anyway
  // on a real DB outage.
  try {
    const { data: allowed, error } = await getSupabaseAdmin().rpc("bump_ai_usage", {
      p_user_id: session.uid,
      p_limit: AI_DAILY_LIMIT,
    });
    if (!error && allowed === false) {
      return Response.json(
        {
          error:
            "Dosegnut je dnevni limit pitanja. Pokušajte ponovno sutra ili se javite administratoru.",
        },
        { status: 429 },
      );
    }
    if (error) console.error("ai_usage rpc:", error.message);
  } catch (e) {
    console.error("ai_usage:", e);
  }

  let context: string;
  // Retrieved sources (law + article), deduped, in similarity order — sent to
  // the client so it can turn cited articles into links to the law reader.
  const sources: { slug: string; title: string; article: string }[] = [];
  try {
    const chunks = await retrieveRelevantChunks(q, TOP_K);
    context = buildContext(chunks);
    const seen = new Set<string>();
    for (const c of chunks) {
      if (!c.article || c.article === "(uvod)") continue;
      const key = `${c.source}|${c.article}`;
      if (seen.has(key)) continue;
      seen.add(key);
      sources.push({ slug: slugify(c.source), title: c.source, article: c.article });
    }
  } catch (e) {
    console.error("retrieval error:", e);
    return Response.json({ error: "Greška pri dohvaćanju propisa." }, { status: 502 });
  }

  let stream: Awaited<ReturnType<typeof streamLegalAnswer>>;
  try {
    stream = await streamLegalAnswer(q, context);
  } catch (e) {
    console.error("gemini request error:", e);
    return Response.json({ error: "Greška pri obradi upita." }, { status: 502 });
  }

  // School binding for the Q&A log (server-authoritative; never from input).
  // Resolved here, in request scope, so cookies are available.
  const school = await getCurrentSchool().catch(() => null);

  // Accumulated answer + stream health, captured for the post-response log below.
  let answer = "";
  let streamOk = true;
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          if (chunk.text) {
            answer += chunk.text;
            controller.enqueue(encoder.encode(chunk.text));
          }
        }
        controller.close();
      } catch (e) {
        streamOk = false;
        console.error("gemini stream error:", e);
        controller.error(e);
      }
    },
  });

  // Persist the full Q&A for the admin's insight (curating a Q&A later, or having
  // context when a principal calls). `after` runs once the response is fully sent
  // — on Vercel via waitUntil, so the write isn't dropped when the function
  // returns, and it never blocks or delays the streamed answer. Fails OPEN: a
  // logging error must never affect the answer the principal already received.
  after(async () => {
    if (!streamOk || !answer.trim()) return; // skip aborted/empty streams
    try {
      await getSupabaseAdmin().from("ask_log").insert({
        user_id: session.uid,
        school_id: school?.id ?? null,
        username: session.usr || null,
        school: session.school || null,
        pitanje: q,
        odgovor: answer,
        izvori: sources.length ? sources : null,
      });
    } catch (e) {
      console.error("ask_log insert:", e);
    }
  });

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      // Disable proxy buffering so chunks reach the client as they arrive.
      "X-Accel-Buffering": "no",
      // Retrieved sources (base64 JSON, header-safe for Croatian text).
      "X-Sources": Buffer.from(JSON.stringify(sources)).toString("base64"),
    },
  });
}
