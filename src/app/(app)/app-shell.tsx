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
  laws,
  logout,
  children,
}: {
  school: string | null;
  laws: { slug: string; title: string }[];
  logout: React.ReactNode;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-1">
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-black/10 bg-white transition-transform dark:border-white/10 dark:bg-black md:sticky md:top-0 md:h-screen md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="border-b border-black/10 px-4 py-4 dark:border-white/10">
          <p className="text-base font-semibold tracking-tight">e-ravnatelj</p>
          {school ? (
            <p className="mt-0.5 truncate text-xs text-black/60 dark:text-white/60">
              {school}
            </p>
          ) : null}
        </div>

        <div
          className="flex-1 overflow-y-auto p-3"
          onClick={() => setOpen(false)}
        >
          <LawNav laws={laws} />
        </div>

        {logout}
      </aside>

      {open ? (
        <div
          className="fixed inset-0 z-30 bg-black/30 md:hidden"
          aria-hidden
          onClick={() => setOpen(false)}
        />
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-3 border-b border-black/10 p-3 md:hidden dark:border-white/10">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Otvori izbornik"
            className="rounded-md border border-black/15 px-2.5 py-1 text-sm dark:border-white/20"
          >
            ☰
          </button>
          <span className="font-semibold tracking-tight">e-ravnatelj</span>
        </div>

        {children}
      </div>
    </div>
  );
}
