"use client";

import { useEffect, useState } from "react";

/**
 * Small "▶ Upute" trigger that opens a short screen-capture tutorial in a modal.
 * Reusable per category — pass the clip `src` (served from /public/upute/*.mp4),
 * a `title`, and optionally a custom `label` / `poster`.
 *
 * The video has no audio (silent walkthrough with on-screen captions), so it is
 * muted + autoplays on open; Esc or a click on the backdrop closes it.
 */
export function VideoHelp({
  src,
  title,
  label = "Upute",
  poster,
}: {
  src: string;
  title: string;
  label?: string;
  poster?: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-accent/30 bg-accent-weak px-2.5 py-1 text-xs font-semibold text-accent transition-colors hover:bg-accent/15"
      >
        <span aria-hidden className="text-[0.7rem]">▶</span>
        {label}
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-ink/50 p-3 backdrop-blur-[1px] sm:p-6"
          onClick={() => setOpen(false)}
        >
          <div
            className="mx-auto flex h-full w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-surface shadow-[var(--shadow-lg)]"
            onClick={(e) => e.stopPropagation()}
          >
            <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
              <span className="truncate text-sm font-medium text-ink">{title}</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Zatvori upute"
                className="shrink-0 rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-bg-tint"
              >
                Zatvori ✕
              </button>
            </header>
            <div className="flex min-h-0 flex-1 items-center justify-center bg-ink/95 p-3">
              {/* eslint-disable-next-line jsx-a11y/media-has-caption -- silent walkthrough, captions are burned into the video */}
              <video
                src={src}
                poster={poster}
                controls
                autoPlay
                muted
                playsInline
                className="max-h-full max-w-full rounded-lg shadow-[var(--shadow)]"
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
