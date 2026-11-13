"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

interface Source {
  slug: string;
  title: string;
  article: string;
}

/**
 * Find cited article numbers in the answer. Matches Croatian declensions
 * (članak/članka/članku/člankom/članci/…) followed by a number.
 * (Avoids \b — JS word boundaries don't play well with "č".)
 */
function findArticleNumbers(text: string): string[] {
  const re = /član(?:ak|ka|ku|kom|cima|aka|ci)\.?\s+(\d+[a-z]?)/gi;
  const nums = new Set<string>();
  for (const m of text.matchAll(re)) nums.add(m[1].toLowerCase());
  return [...nums].sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
}

/** Decode the base64-JSON X-Sources header (UTF-8 safe). */
function decodeSources(b64: string | null): Source[] {
  if (!b64) return [];
  try {
    const json = new TextDecoder().decode(
      Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)),
    );
    return JSON.parse(json) as Source[];
  } catch {
    return [];
  }
}

export interface SupportContact {
  name?: string;
  email?: string;
  phone?: string;
}

export function AskForm({ support }: { support?: SupportContact }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState<Source[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  // Compose-email modal: lets the principal tailor the message (subject + body),
  // keep or drop the AI answer, then send or copy it. More reliable than a bare
  // mailto: link (which silently does nothing when no mail client is set up).
  const [modalOpen, setModalOpen] = useState(false);
  const [mailSubject, setMailSubject] = useState("");
  const [mailBody, setMailBody] = useState("");
  const [includeAnswer, setIncludeAnswer] = useState(true);
  const [msgCopied, setMsgCopied] = useState(false);
  const [emailCopied, setEmailCopied] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (!q || loading) return;

    setLoading(true);
    setError(null);
    setAnswer("");
    setSources([]);
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

      setSources(decodeSources(res.headers.get("X-Sources")));

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

  const articleNumbers = answer ? findArticleNumbers(answer) : [];

  const email = support?.email?.trim();
  const phone = support?.phone?.trim();
  const hasContact = Boolean(email || phone);
  const SUBJECT_DEFAULT = "Pitanje preko aplikacije e-Ravnatelj";

  /** Build the message body from the current Q&A. `withAnswer` controls whether
   *  the AI answer (and cited articles) is appended. */
  function composeBody(withAnswer: boolean): string {
    const lines: string[] = ["Poštovani,", ""];
    if (question.trim()) lines.push("Moje pitanje:", question.trim(), "");
    if (withAnswer && answer) {
      lines.push("Odgovor asistenta (informativno):", answer, "");
      if (articleNumbers.length) {
        lines.push(`Citirani članci: ${articleNumbers.map((n) => `čl. ${n}.`).join(", ")}`, "");
      }
    }
    lines.push("Molim dodatno pojašnjenje.", "", "Hvala i lijep pozdrav.");
    return lines.join("\n");
  }

  /** Open the compose modal, prefilled from the current question + answer. */
  function openMailModal() {
    const withAnswer = Boolean(answer);
    setIncludeAnswer(withAnswer);
    setMailSubject(SUBJECT_DEFAULT);
    setMailBody(composeBody(withAnswer));
    setMsgCopied(false);
    setEmailCopied(false);
    setModalOpen(true);
  }

  /** Toggle the AI answer in/out — rebuilds the body (replaces manual edits). */
  function toggleAnswer(next: boolean) {
    setIncludeAnswer(next);
    setMailBody(composeBody(next));
  }

  const modalMailto = email
    ? `mailto:${email}?subject=${encodeURIComponent(mailSubject)}&body=${encodeURIComponent(mailBody)}`
    : undefined;

  async function copyText(text: string, which: "msg" | "email" | "phone") {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      return; // clipboard blocked — values are shown as selectable text
    }
    const set =
      which === "msg" ? setMsgCopied : which === "email" ? setEmailCopied : setCopied;
    set(true);
    setTimeout(() => set(false), 1800);
  }

  // Close the modal on Escape.
  useEffect(() => {
    if (!modalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setModalOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [modalOpen]);

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label htmlFor="question" className="text-sm font-medium text-ink">
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
          className="resize-y rounded-lg border border-line bg-surface px-3.5 py-2.5 text-sm text-ink outline-none transition-colors placeholder:text-faint focus:border-accent focus:ring-4 focus:ring-accent/10"
        />
        <button
          type="submit"
          disabled={loading || !question.trim()}
          className="self-start rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink transition-colors hover:bg-accent-hover disabled:opacity-50"
        >
          {loading ? "Tražim odgovor…" : "Pitaj"}
        </button>
      </form>

      {error ? (
        <p
          role="alert"
          className="rounded-lg bg-bad-weak px-3 py-2 text-sm text-bad"
        >
          {error}
        </p>
      ) : null}

      {answer ? (
        <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-5 shadow-[var(--shadow)]">
          <p className="whitespace-pre-wrap text-[0.95rem] leading-relaxed text-ink">{answer}</p>

          {articleNumbers.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
              <span className="text-xs text-faint">Citirano:</span>
              {articleNumbers.map((n) => {
                const src = sources.find((s) => s.article === n);
                const label = `Članak ${n}.`;
                const chip =
                  "rounded-full bg-accent-weak px-2.5 py-0.5 text-xs font-medium text-accent";
                return src ? (
                  <Link
                    key={n}
                    href={`/app/zakoni/${src.slug}#clanak-${n}`}
                    title={`Otvori: ${src.title}`}
                    className={`${chip} underline-offset-2 hover:underline`}
                  >
                    {label}
                  </Link>
                ) : (
                  <span key={n} className={chip}>
                    {label}
                  </span>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}

      {hasContact ? (
        <div className="rounded-xl border border-gold/35 bg-gold-weak/40 p-5">
          <div className="flex items-start gap-3">
            <span className="text-xl leading-none" aria-hidden>
              💬
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="font-serif text-base font-semibold text-ink">
                Trebate dublji odgovor?
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-muted">
                Odgovor asistenta je informativan. Za tumačenje ili složeniju
                situaciju javite se izravno
                {support?.name ? ` — ${support.name}` : ""}.
              </p>
              <div className="mt-3.5 flex flex-wrap items-center gap-2.5">
                {email ? (
                  <button
                    type="button"
                    onClick={openMailModal}
                    className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-ink transition-colors hover:bg-accent-hover"
                  >
                    ✉️ Sastavi e-mail
                  </button>
                ) : null}
                {phone ? (
                  <div className="inline-flex items-center gap-1 rounded-lg border border-line bg-surface px-3 py-1.5 text-sm">
                    <a
                      href={`tel:${phone.replace(/\s+/g, "")}`}
                      className="inline-flex items-center gap-2 font-medium text-ink"
                    >
                      <span aria-hidden>📞</span>
                      <span className="tabular-nums">{phone}</span>
                    </a>
                    <button
                      type="button"
                      onClick={() => copyText(phone, "phone")}
                      className="ml-1.5 rounded-md px-1.5 py-0.5 text-xs text-faint transition-colors hover:text-ink"
                      title="Kopiraj broj"
                    >
                      {copied ? "✓ kopirano" : "kopiraj"}
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {modalOpen && email ? (
        <div
          className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-ink/40 p-4 backdrop-blur-[2px] sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="mail-modal-title"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setModalOpen(false);
          }}
        >
          <div className="my-auto w-full max-w-lg rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-lg)] sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2
                  id="mail-modal-title"
                  className="font-serif text-lg font-semibold text-ink"
                >
                  Sastavi e-mail
                </h2>
                <p className="mt-0.5 text-sm text-muted">
                  Uredite poruku po želji, zatim pošaljite ili kopirajte.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                aria-label="Zatvori"
                className="-mr-1 -mt-1 rounded-lg px-2 py-1 text-xl leading-none text-faint transition-colors hover:bg-bg-tint hover:text-ink"
              >
                ×
              </button>
            </div>

            {/* Recipient */}
            <div className="mt-4 flex flex-wrap items-center gap-2 rounded-lg bg-bg-tint px-3 py-2 text-sm">
              <span className="text-faint">Prima:</span>
              <span className="font-medium text-ink">
                {support?.name ? `${support.name} · ` : ""}
                {email}
              </span>
              <button
                type="button"
                onClick={() => copyText(email, "email")}
                className="ml-auto rounded-md px-1.5 py-0.5 text-xs text-faint transition-colors hover:text-ink"
                title="Kopiraj e-mail adresu"
              >
                {emailCopied ? "✓ kopirano" : "kopiraj"}
              </button>
            </div>

            {/* Subject */}
            <label className="mt-3 block text-xs font-medium text-muted">
              Predmet
              <input
                type="text"
                value={mailSubject}
                onChange={(e) => setMailSubject(e.target.value)}
                className="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none transition-colors focus:border-accent focus:ring-4 focus:ring-accent/10"
              />
            </label>

            {/* Toggle: include the AI answer */}
            {answer ? (
              <label className="mt-3 flex items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={includeAnswer}
                  onChange={(e) => toggleAnswer(e.target.checked)}
                  className="h-4 w-4 rounded border-line text-accent focus:ring-accent/30"
                />
                Priloži odgovor asistenta
                <span className="text-xs text-faint">(mijenjanjem se tekst ispod ponovno sastavlja)</span>
              </label>
            ) : null}

            {/* Body */}
            <label className="mt-3 block text-xs font-medium text-muted">
              Poruka
              <textarea
                value={mailBody}
                onChange={(e) => setMailBody(e.target.value)}
                rows={10}
                className="mt-1 w-full resize-y rounded-lg border border-line bg-surface px-3 py-2 text-sm leading-relaxed text-ink outline-none transition-colors focus:border-accent focus:ring-4 focus:ring-accent/10"
              />
            </label>

            {/* Actions */}
            <div className="mt-4 flex flex-wrap items-center gap-2.5">
              <a
                href={modalMailto}
                onClick={() => setModalOpen(false)}
                className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-ink transition-colors hover:bg-accent-hover"
              >
                ✉️ Otvori u mailu
              </a>
              <button
                type="button"
                onClick={() => copyText(`${mailSubject}\n\n${mailBody}`, "msg")}
                className="inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-4 py-2 text-sm font-semibold text-ink transition-colors hover:bg-bg-tint"
              >
                {msgCopied ? "✓ Kopirano" : "Kopiraj poruku"}
              </button>
              <span className="basis-full text-xs text-faint">
                Ako se „Otvori u mailu” ne otvori, kopirajte poruku i e-mail adresu pa
                zalijepite u svoj mail (Gmail, Outlook…).
              </span>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
