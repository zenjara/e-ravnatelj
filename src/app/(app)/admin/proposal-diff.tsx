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
    "max-h-[60vh] overflow-auto whitespace-pre-wrap rounded-md border p-3 text-xs leading-relaxed";

  return (
    <div className="mt-4">
      <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-black/45 dark:text-white/45">
        Članak {change.article}
      </h4>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div>
          <p className="mb-1 text-[11px] font-medium text-black/40 dark:text-white/40">
            Trenutno
          </p>
          <div
            ref={leftRef}
            onScroll={() => sync(leftRef.current, rightRef.current)}
            className={`${pane} border-black/10 bg-black/[0.015] dark:border-white/10 dark:bg-white/[0.02]`}
          >
            {parts
              .filter((p) => !p.added)
              .map((p, i) =>
                p.removed ? (
                  <span
                    key={i}
                    className="rounded bg-red-200/60 text-red-900 line-through decoration-red-400/60 dark:bg-red-900/40 dark:text-red-200"
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
          <p className="mb-1 text-[11px] font-medium text-black/40 dark:text-white/40">
            Predloženo
          </p>
          <div
            ref={rightRef}
            onScroll={() => sync(rightRef.current, leftRef.current)}
            className={`${pane} border-black/10 bg-black/[0.015] dark:border-white/10 dark:bg-white/[0.02]`}
          >
            {parts
              .filter((p) => !p.removed)
              .map((p, i) =>
                p.added ? (
                  <span
                    key={i}
                    className="rounded bg-green-200/60 text-green-900 dark:bg-green-900/40 dark:text-green-200"
                  >
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
