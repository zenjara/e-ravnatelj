import Link from "next/link";
import { requireAdmin } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { approveProposal, rejectProposal } from "../actions";
import { ProposalDiff, type ArticleChange } from "../proposal-diff";

/** Parse the stored per-article "PRIJE/POSLIJE" diff text into structured pairs. */
function parseDiff(diff: string | null): ArticleChange[] {
  if (!diff) return [];
  return diff
    .split(/══════ Članak /)
    .slice(1)
    .map((b) => {
      const article = (b.match(/^(\d+[a-z]?)/)?.[1] ?? "").trim();
      const pIdx = b.indexOf("— PRIJE —");
      const aIdx = b.indexOf("— POSLIJE —");
      if (pIdx === -1 || aIdx === -1) return null;
      return {
        article,
        before: b.slice(pIdx + "— PRIJE —".length, aIdx).trim(),
        after: b.slice(aIdx + "— POSLIJE —".length).trim(),
      };
    })
    .filter((x): x is ArticleChange => x !== null);
}

// Re-ingestion (embedding ~hundreds of chunks) can take a while.
export const maxDuration = 60;

interface Proposal {
  id: number;
  law_slug: string;
  nn_number: string;
  amendment_title: string | null;
  summary: string | null;
  diff: string | null;
  status: string;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
}

export default async function PromjenePage() {
  await requireAdmin();

  const { data } = await getSupabaseAdmin()
    .from("law_proposals")
    .select("id, law_slug, nn_number, amendment_title, summary, diff, status, created_at, reviewed_at, reviewed_by")
    .order("created_at", { ascending: false })
    .limit(50);
  const proposals = (data ?? []) as Proposal[];
  const pending = proposals.filter((p) => p.status === "pending");
  const history = proposals.filter((p) => p.status !== "pending");

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 p-5 sm:p-8">
      <p className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-gold">
        Administracija
      </p>
      <h1 className="font-serif text-[1.9rem] font-semibold leading-tight tracking-tight text-ink">
        Promjene zakona
      </h1>
      <p className="mt-1.5 mb-7 text-sm leading-relaxed text-muted">
        Prijedlozi konsolidacije na temelju novih izmjena iz Narodnih novina.
        Pregledaj diff, pa odobri ili odbij.
      </p>

      {pending.length === 0 ? (
        <p className="rounded-xl border border-line bg-bg-tint px-4 py-6 text-sm text-muted">
          Nema novih prijedloga za pregled. ✅
        </p>
      ) : (
        <div className="flex flex-col gap-6">
          {pending.map((p) => (
            <article
              key={p.id}
              className="overflow-hidden rounded-xl border border-line bg-surface shadow-[var(--shadow)]"
            >
              <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
                <div>
                  <Link
                    href={`/app/zakoni/${p.law_slug}`}
                    className="text-sm font-semibold text-accent underline-offset-2 hover:underline"
                  >
                    {p.law_slug}
                  </Link>
                  <span className="ml-2 rounded-full bg-accent-weak px-2 py-0.5 text-xs font-medium text-accent">
                    NN {p.nn_number}
                  </span>
                </div>
                <span className="text-xs text-faint">
                  {new Date(p.created_at).toLocaleDateString("hr")}
                </span>
              </header>

              <div className="px-4 py-3">
                {p.amendment_title ? (
                  <p className="text-sm font-medium text-ink">{p.amendment_title}</p>
                ) : null}

                {p.summary ? (
                  <div className="mt-2 rounded-lg border-l-2 border-gold bg-gold-weak px-3 py-2 text-sm text-ink/80">
                    <span className="mr-1 font-medium">Sažetak:</span>
                    {p.summary}
                  </div>
                ) : null}

                <ProposalDiff changes={parseDiff(p.diff)} />
              </div>

              <footer className="flex items-center gap-2 border-t border-line bg-bg-tint px-4 py-3">
                <form action={approveProposal.bind(null, p.id)}>
                  <button
                    type="submit"
                    className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-ink transition-colors hover:bg-accent-hover"
                  >
                    Odobri i primijeni
                  </button>
                </form>
                <form action={rejectProposal.bind(null, p.id)}>
                  <button
                    type="submit"
                    className="rounded-lg border border-line px-4 py-2 text-sm text-ink transition-colors hover:bg-surface"
                  >
                    Odbij
                  </button>
                </form>
              </footer>
            </article>
          ))}
        </div>
      )}

      {history.length > 0 ? (
        <section className="mt-10">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-gold">
            Povijest
          </h2>
          <ul className="flex flex-col gap-1 text-sm">
            {history.map((p) => (
              <li key={p.id} className="flex items-center justify-between rounded-lg px-2 py-1 text-ink">
                <span>
                  {p.law_slug} — NN {p.nn_number}
                </span>
                <span
                  className={
                    p.status === "approved"
                      ? "text-xs font-medium text-good"
                      : "text-xs font-medium text-faint"
                  }
                >
                  {p.status === "approved" ? "primijenjeno" : "odbijeno"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
