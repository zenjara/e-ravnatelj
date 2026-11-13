import Link from "next/link";
import { requireAdmin } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { slugify } from "@/lib/laws";
import { setAskStatus, saveAskNote } from "../actions";

interface Source {
  slug: string;
  title: string;
  article: string;
}

interface AskRow {
  id: string;
  username: string | null;
  school: string | null;
  pitanje: string;
  odgovor: string | null;
  izvori: Source[] | null;
  napomena: string | null;
  status: string;
  created_at: string;
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("hr", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Dedupe cited sources by article, keeping the first title/slug seen. */
function dedupeSources(izvori: Source[] | null): Source[] {
  if (!Array.isArray(izvori) || izvori.length === 0) return [];
  const seen = new Set<string>();
  const out: Source[] = [];
  for (const s of izvori) {
    if (!s?.article || seen.has(s.article)) continue;
    seen.add(s.article);
    out.push(s);
  }
  return out.sort((a, b) => parseInt(a.article, 10) - parseInt(b.article, 10));
}

function Meta({ r }: { r: AskRow }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-faint">
      {r.school ? <span>{r.school}</span> : null}
      {r.username ? <span>· {r.username}</span> : null}
      <span className="ml-auto tabular-nums">{fmtDateTime(r.created_at)}</span>
    </div>
  );
}

function AskCard({ r }: { r: AskRow }) {
  const sources = dedupeSources(r.izvori);
  const pregledano = r.status === "pregledano";
  return (
    <article
      className={`rounded-xl border p-4 shadow-[var(--shadow)] ${
        pregledano ? "border-line bg-bg-tint/40" : "border-line bg-surface"
      }`}
    >
      <Meta r={r} />

      <p className="mt-2.5 whitespace-pre-wrap text-[0.95rem] font-medium leading-relaxed text-ink">
        {r.pitanje}
      </p>

      {r.odgovor ? (
        <details className="mt-2.5 group">
          <summary className="cursor-pointer select-none text-xs font-semibold text-accent underline-offset-2 hover:underline">
            Prikaži odgovor asistenta
          </summary>
          <div className="mt-2 rounded-lg border border-line bg-bg-tint/50 p-3">
            <p className="whitespace-pre-wrap text-[0.85rem] leading-relaxed text-muted">
              {r.odgovor}
            </p>
            {sources.length ? (
              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-2.5">
                <span className="text-[0.68rem] text-faint">Citirano:</span>
                {sources.map((s) => {
                  const slug = s.slug || (s.title ? slugify(s.title) : "");
                  const chip =
                    "rounded-full bg-accent-weak px-2.5 py-0.5 text-[0.7rem] font-medium text-accent";
                  return slug ? (
                    <Link
                      key={s.article}
                      href={`/app/zakoni/${slug}#clanak-${s.article}`}
                      title={s.title ? `Otvori: ${s.title}` : undefined}
                      className={`${chip} underline-offset-2 hover:underline`}
                    >
                      Članak {s.article}.
                    </Link>
                  ) : (
                    <span key={s.article} className={chip}>
                      Članak {s.article}.
                    </span>
                  );
                })}
              </div>
            ) : null}
          </div>
        </details>
      ) : (
        <p className="mt-2 text-xs italic text-faint">Odgovor nije zabilježen.</p>
      )}

      {/* Admin's own note + status toggle — SEPARATE forms so toggling status
          never submits or clears an unsaved note (they had shared one form). */}
      <form action={saveAskNote.bind(null, r.id)} className="mt-3.5">
        <label
          htmlFor={`napomena-${r.id}`}
          className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-gold"
        >
          Bilješka
        </label>
        <textarea
          id={`napomena-${r.id}`}
          name="napomena"
          defaultValue={r.napomena ?? ""}
          rows={2}
          placeholder="Interna bilješka (nije vidljiva ravnatelju)…"
          className="mt-1 w-full resize-y rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-faint focus:border-accent focus:ring-4 focus:ring-accent/10"
        />
        <button
          type="submit"
          className="mt-2 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-accent-weak hover:text-accent"
        >
          Spremi bilješku
        </button>
      </form>
      <form
        action={setAskStatus.bind(null, r.id, pregledano ? "novo" : "pregledano")}
        className="mt-2 flex justify-end"
      >
        <button
          type="submit"
          className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-muted transition-colors hover:bg-good-weak hover:text-good"
        >
          {pregledano ? "Vrati u novo" : "Označi pregledanim"}
        </button>
      </form>
    </article>
  );
}

export default async function AdminPitanjaPage() {
  await requireAdmin();

  const { data, error } = await getSupabaseAdmin()
    .from("ask_log")
    .select("id, username, school, pitanje, odgovor, izvori, napomena, status, created_at")
    .order("created_at", { ascending: false })
    .limit(300);
  const rows = (data ?? []) as AskRow[];
  const nova = rows.filter((r) => r.status !== "pregledano");
  const pregledano = rows.filter((r) => r.status === "pregledano");

  // A query error (e.g. table not created yet) must not look like "no questions".
  // Detect the missing-table case by code (42P01 = Postgres undefined_table,
  // PGRST205 = PostgREST "table not in schema cache") AND by message wording,
  // since the exact text varies across versions.
  const missingTable =
    !!error &&
    (error.code === "42P01" ||
      error.code === "PGRST205" ||
      /relation .*ask_log.* does not exist|schema cache/i.test(error.message));
  const dbError = error
    ? missingTable
      ? "Tablica ask_log još ne postoji — primijenite migraciju 0013 i NOTIFY pgrst, 'reload schema'."
      : `Greška pri dohvaćanju: ${error.message}`
    : null;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 p-5 sm:p-8">
      <p className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-gold">
        Administracija
      </p>
      <h1 className="font-serif text-[1.9rem] font-semibold leading-tight tracking-tight text-ink">
        Pitanja ravnatelja
      </h1>
      <p className="mt-1.5 mb-7 text-sm leading-relaxed text-muted">
        Što su ravnatelji pitali pravnog asistenta i koji su odgovor dobili —
        uvid za slaganje Q&A i kontekst kod poziva. {nova.length} novih,{" "}
        {pregledano.length} pregledanih.
      </p>

      {dbError ? (
        <p className="rounded-xl border border-bad/40 bg-bad-weak px-4 py-4 text-sm text-bad">
          {dbError}
        </p>
      ) : rows.length === 0 ? (
        <p className="rounded-xl border border-line bg-bg-tint px-4 py-6 text-sm text-muted">
          Još nema zabilježenih pitanja.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {nova.map((r) => (
            <AskCard key={r.id} r={r} />
          ))}
        </div>
      )}

      {pregledano.length > 0 ? (
        <section className="mt-10">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-gold">
            Pregledano
          </h2>
          <div className="flex flex-col gap-4">
            {pregledano.map((r) => (
              <AskCard key={r.id} r={r} />
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
