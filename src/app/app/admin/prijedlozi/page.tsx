import { requireAdmin } from "@/lib/session";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { setFeedbackStatus } from "../actions";

interface Feedback {
  id: string;
  kategorija: string;
  poruka: string;
  stranica: string | null;
  username: string | null;
  school: string | null;
  status: string;
  created_at: string;
}

const KAT_LABEL: Record<string, string> = {
  prijedlog: "Prijedlog",
  greška: "Greška",
  pitanje: "Pitanje",
  ostalo: "Ostalo",
};

/** Badge classes per feedback category. */
function katBadge(k: string): string {
  switch (k) {
    case "greška":
      return "bg-bad-weak text-bad";
    case "pitanje":
      return "bg-gold-weak text-[color:var(--gold)]";
    case "prijedlog":
      return "bg-accent-weak text-accent";
    default:
      return "bg-bg-tint text-muted";
  }
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

function Meta({ f }: { f: Feedback }) {
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-faint">
      {f.school ? <span>{f.school}</span> : null}
      {f.username ? <span>· {f.username}</span> : null}
      {f.stranica ? (
        <span className="rounded bg-bg-tint px-1.5 py-0.5 font-mono text-[0.68rem] text-muted">
          {f.stranica}
        </span>
      ) : null}
      <span className="ml-auto tabular-nums">{fmtDateTime(f.created_at)}</span>
    </div>
  );
}

export default async function PrijedloziPage() {
  await requireAdmin();

  const { data } = await getSupabaseAdmin()
    .from("feedback")
    .select("id, kategorija, poruka, stranica, username, school, status, created_at")
    .order("created_at", { ascending: false })
    .limit(300);
  const rows = (data ?? []) as Feedback[];
  const nova = rows.filter((r) => r.status !== "riješeno");
  const rijeseno = rows.filter((r) => r.status === "riješeno");

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 p-5 sm:p-8">
      <p className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-gold">
        Administracija
      </p>
      <h1 className="font-serif text-[1.9rem] font-semibold leading-tight tracking-tight text-ink">
        Prijedlozi i opaske
      </h1>
      <p className="mt-1.5 mb-7 text-sm leading-relaxed text-muted">
        Povratne informacije ravnatelja iz beta-widgeta. {nova.length} novih,{" "}
        {rijeseno.length} riješenih.
      </p>

      {nova.length === 0 ? (
        <p className="rounded-xl border border-line bg-bg-tint px-4 py-6 text-sm text-muted">
          Nema novih prijedloga. ✅
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {nova.map((f) => (
            <article
              key={f.id}
              className="rounded-xl border border-line bg-surface p-4 shadow-[var(--shadow)]"
            >
              <div className="flex items-start justify-between gap-3">
                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${katBadge(f.kategorija)}`}
                >
                  {KAT_LABEL[f.kategorija] ?? f.kategorija}
                </span>
                <form action={setFeedbackStatus.bind(null, f.id, "riješeno")}>
                  <button
                    type="submit"
                    className="rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-good-weak hover:text-good"
                  >
                    Označi riješenim
                  </button>
                </form>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-ink">
                {f.poruka}
              </p>
              <Meta f={f} />
            </article>
          ))}
        </div>
      )}

      {rijeseno.length > 0 ? (
        <section className="mt-10">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-gold">
            Riješeno
          </h2>
          <div className="flex flex-col gap-3">
            {rijeseno.map((f) => (
              <article
                key={f.id}
                className="rounded-xl border border-line bg-bg-tint/40 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold opacity-70 ${katBadge(f.kategorija)}`}
                  >
                    {KAT_LABEL[f.kategorija] ?? f.kategorija}
                  </span>
                  <form action={setFeedbackStatus.bind(null, f.id, "novo")}>
                    <button
                      type="submit"
                      className="text-xs text-faint underline-offset-2 transition-colors hover:text-ink hover:underline"
                    >
                      Vrati u novo
                    </button>
                  </form>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted">
                  {f.poruka}
                </p>
                <Meta f={f} />
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </main>
  );
}
