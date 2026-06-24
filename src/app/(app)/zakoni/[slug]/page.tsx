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

/** Render the law text as article sections with bold "Članak N" headers. */
function LawText({ text }: { text: string }) {
  const sections: { id: string | null; lines: string[] }[] = [];
  let cur: { id: string | null; lines: string[] } = { id: null, lines: [] };
  for (const line of text.split("\n")) {
    const m = line.match(/^\s*Članak\s+(\d+[a-z]?)/i);
    if (m) {
      sections.push(cur);
      cur = { id: m[1], lines: [line] };
    } else {
      cur.lines.push(line);
    }
  }
  sections.push(cur);

  return (
    <article className="space-y-4 text-sm leading-relaxed">
      {sections
        .filter((s) => s.lines.join("").trim())
        .map((s, i) => {
          const content = s.lines.join("\n").trim();
          if (s.id == null) {
            return (
              <p
                key={i}
                className="whitespace-pre-wrap text-black/70 dark:text-white/70"
              >
                {content}
              </p>
            );
          }
          const nl = content.indexOf("\n");
          const header = nl === -1 ? content : content.slice(0, nl);
          const body = nl === -1 ? "" : content.slice(nl + 1).trim();
          return (
            <section key={i} id={`clanak-${s.id}`} className="scroll-mt-4">
              <h2 className="font-semibold">{header}</h2>
              {body ? (
                <p className="mt-1 whitespace-pre-wrap">{body}</p>
              ) : null}
            </section>
          );
        })}
    </article>
  );
}
