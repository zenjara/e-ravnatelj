"use client";

import { useRef, useState } from "react";

/** Find "Članak N" references in the answer so the user can verify the source. */
function findArticles(text: string): string[] {
  const matches = text.matchAll(/Članak\s+\d+[a-z]?\.?/gi);
  const seen = new Set<string>();
  for (const m of matches) {
    // Normalize: "Članak 12." → "Članak 12."
    seen.add(m[0].replace(/\s+/g, " ").trim().replace(/\.?$/, "."));
  }
  return [...seen];
}

export function AskForm() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (!q || loading) return;

    setLoading(true);
    setError(null);
    setAnswer("");
    abortRef.current = new AbortController();

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
        signal: abortRef.current.signal,
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Došlo je do greške. Pokušajte ponovno.");
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setAnswer(acc);
      }
    } catch (err) {
      if ((err as Error)?.name !== "AbortError") {
        setError("Došlo je do greške. Pokušajte ponovno.");
      }
    } finally {
      setLoading(false);
    }
  }

  const articles = answer ? findArticles(answer) : [];

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label htmlFor="question" className="text-sm font-medium">
          Vaše pitanje
        </label>
        <textarea
          id="question"
          name="question"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSubmit(e);
          }}
          rows={3}
          placeholder="npr. Koliko dana godišnjeg odmora pripada učitelju?"
          className="resize-y rounded-md border border-black/15 bg-white px-3 py-2 text-sm outline-none focus:border-black/40 dark:border-white/20 dark:bg-white/5 dark:focus:border-white/50"
        />
        <button
          type="submit"
          disabled={loading || !question.trim()}
          className="self-start rounded-md bg-black px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50 dark:bg-white dark:text-black"
        >
          {loading ? "Tražim odgovor…" : "Pitaj"}
        </button>
      </form>

      {error ? (
        <p
          role="alert"
          className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300"
        >
          {error}
        </p>
      ) : null}

      {answer ? (
        <div className="flex flex-col gap-3 rounded-xl border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-white/5">
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{answer}</p>

          {articles.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2 border-t border-black/10 pt-3 dark:border-white/10">
              <span className="text-xs text-black/50 dark:text-white/50">
                Citirano:
              </span>
              {articles.map((a) => (
                <span
                  key={a}
                  className="rounded-full bg-black/5 px-2.5 py-0.5 text-xs font-medium dark:bg-white/10"
                >
                  {a}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
