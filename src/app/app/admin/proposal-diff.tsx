"use client";

import { useRef } from "react";
import { diffWordsWithSpace } from "diff";

export interface ArticleChange {
  article: string;
  before: string;
  after: string;
}

/** Word-level side-by-side diff for one article, with synchronized scrolling. */
function DiffPair({ change }: { change: ArticleChange }) {
  const parts = diffWordsWithSpace(change.before, change.after);
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const syncing = useRef(false);

  const sync = (from: HTMLDivElement | null, to: HTMLDivElement | null) => {
    if (!from || !to || syncing.current) return;
    syncing.current = true;
    to.scrollTop = from.scrollTop;
    to.scrollLeft = from.scrollLeft;
    requestAnimationFrame(() => (syncing.current = false));
  };

  const pane =
    "max-h-[60vh] overflow-auto whitespace-pre-wrap rounded-lg border border-line bg-bg-tint p-3 text-xs leading-relaxed text-ink";

  return (
    <div className="mt-4">
      <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-gold">
        Članak {change.article}
      </h4>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <p className="mb-1 text-[0.6875rem] font-medium text-faint">Trenutno</p>
          <div
            ref={leftRef}
            onScroll={() => sync(leftRef.current, rightRef.current)}
            className={pane}
          >
            {parts
              .filter((p) => !p.added)
              .map((p, i) =>
                p.removed ? (
                  <span
                    key={i}
                    className="rounded bg-bad-weak text-bad line-through decoration-bad/50"
                  >
                    {p.value}
                  </span>
                ) : (
                  <span key={i}>{p.value}</span>
                ),
              )}
          </div>
        </div>

        <div>
          <p className="mb-1 text-[0.6875rem] font-medium text-faint">Predloženo</p>
          <div
            ref={rightRef}
            onScroll={() => sync(rightRef.current, leftRef.current)}
            className={pane}
          >
            {parts
              .filter((p) => !p.removed)
              .map((p, i) =>
                p.added ? (
                  <span key={i} className="rounded bg-good-weak text-good">
                    {p.value}
                  </span>
                ) : (
                  <span key={i}>{p.value}</span>
                ),
              )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function ProposalDiff({ changes }: { changes: ArticleChange[] }) {
  return (
    <div>
      {changes.map((c) => (
        <DiffPair key={c.article} change={c} />
      ))}
    </div>
  );
}
