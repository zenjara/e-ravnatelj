import { notFound } from "next/navigation";
import { getLaw } from "@/lib/laws";

export default async function LawPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const law = await getLaw(slug);
  if (!law) notFound();

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 p-5 sm:p-8">
      <p className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-gold">
        Propis
      </p>
      <h1 className="font-serif text-[1.6rem] font-semibold leading-tight tracking-tight text-ink">
        {law.title}
      </h1>
      <p className="mt-1.5 mb-7 text-xs text-faint">
        Informativno, nije pravni savjet. Provjeri službeni izvor.
      </p>
      <LawText text={law.text} />
    </main>
  );
}

const ARTICLE_RE = /^Članak\s+(\d+[a-z]?)\.?/i;

/** An ALL-CAPS standalone line is a section heading (e.g. "XVIII. NADZOR"). */
function isSectionHeading(line: string): boolean {
  return (
    /\p{L}/u.test(line) &&
    line.length <= 90 &&
    line === line.toLocaleUpperCase("hr") &&
    !line.startsWith("(")
  );
}

/**
 * Render the law with a visible hierarchy:
 *   SECTION (caps, divider)  >  Članak N (bold, + optional subtitle)  >  body.
 * Each article gets an id="clanak-N" anchor for deep-linking from answers.
 */
function LawText({ text }: { text: string }) {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const out: React.ReactNode[] = [];
  let subtitle: string | null = null;

  lines.forEach((line, i) => {
    const art = line.match(ARTICLE_RE);
    if (art) {
      out.push(
        <div key={i} id={`clanak-${art[1]}`} className="mt-7 scroll-mt-20">
          {subtitle ? (
            <p className="text-sm font-medium text-muted">{subtitle}</p>
          ) : null}
          <h3 className="font-serif text-[1.05rem] font-semibold tracking-tight text-ink">
            {line}
          </h3>
        </div>,
      );
      subtitle = null;
      return;
    }

    if (isSectionHeading(line)) {
      out.push(
        <h2
          key={i}
          className="mt-9 mb-1 border-t border-line pt-5 text-xs font-semibold uppercase tracking-[0.14em] text-gold"
        >
          {line}
        </h2>,
      );
      subtitle = null;
      return;
    }

    // Short line right before an article = that article's subtitle (naziv članka).
    const next = lines[i + 1];
    if (next && ARTICLE_RE.test(next) && line.length <= 80 && !line.startsWith("(")) {
      subtitle = line;
      return;
    }

    out.push(
      <p key={i} className="mt-2 text-ink/85">
        {line}
      </p>,
    );
  });

  return <article className="text-[0.92rem] leading-relaxed text-ink">{out}</article>;
}
