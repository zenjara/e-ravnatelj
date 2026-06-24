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
    <main className="mx-auto w-full max-w-3xl flex-1 p-6">
      <h1 className="text-xl font-semibold tracking-tight">{law.title}</h1>
      <p className="mt-1 mb-6 text-xs text-black/50 dark:text-white/50">
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
            <p className="text-sm font-medium text-black/55 dark:text-white/55">
              {subtitle}
            </p>
          ) : null}
          <h3 className="text-[15px] font-bold tracking-tight">{line}</h3>
        </div>,
      );
      subtitle = null;
      return;
    }

    if (isSectionHeading(line)) {
      out.push(
        <h2
          key={i}
          className="mt-9 mb-1 border-t border-black/10 pt-5 text-xs font-semibold uppercase tracking-widest text-black/45 dark:border-white/10 dark:text-white/45"
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
      <p key={i} className="mt-2 text-black/80 dark:text-white/80">
        {line}
      </p>,
    );
  });

  return <article className="text-sm leading-relaxed">{out}</article>;
}
