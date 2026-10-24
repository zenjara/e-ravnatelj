"use client";

import { useState } from "react";
import { LawNav } from "./law-nav";

/**
 * App chrome with a responsive sidebar: static on md+, an off-canvas drawer on
 * small screens (toggled by the mobile top-bar button). `logout` is passed in
 * as a server-rendered node (the logout <form>), `children` is the page.
 */
export function AppShell({
  school,
  isAdmin,
  laws,
  logout,
  children,
}: {
  school: string | null;
  isAdmin: boolean;
  laws: { slug: string; title: string }[];
  logout: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-1 bg-bg">
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-line bg-surface transition-transform md:sticky md:top-0 md:h-screen md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="px-5 pt-6 pb-4">
          <p className="font-serif text-[1.35rem] font-semibold leading-none tracking-tight text-ink">
            e&#8209;ravnatelj
          </p>
          <div className="mt-3 h-px w-10 bg-gold" />
          {school ? (
            <p className="mt-3 line-clamp-2 text-xs leading-snug text-muted">
              {school}
            </p>
          ) : null}
        </div>

        <div
          className="flex-1 overflow-y-auto px-3 pb-3"
          onClick={() => setOpen(false)}
        >
          <LawNav laws={laws} isAdmin={isAdmin} />
        </div>

        <div className="border-t border-line p-3">{logout}</div>
      </aside>

      {open ? (
        <div
          className="fixed inset-0 z-30 bg-ink/25 backdrop-blur-[1px] md:hidden"
          aria-hidden
          onClick={() => setOpen(false)}
        />
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-3 border-b border-line bg-surface/80 p-3 backdrop-blur md:hidden">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Otvori izbornik"
            className="rounded-lg border border-line px-2.5 py-1 text-ink transition-colors hover:bg-bg-tint"
          >
            ☰
          </button>
          <span className="font-serif text-lg font-semibold tracking-tight text-ink">
            e&#8209;ravnatelj
          </span>
        </div>

        {children}
      </div>
    </div>
  );
}
