"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

/** Sidebar navigation: primary links + the list of laws, with active highlight. */
export function LawNav({
  laws,
  isAdmin,
}: {
  laws: { slug: string; title: string }[];
  isAdmin: boolean;
}) {
  const pathname = usePathname();
  const onLaw = pathname.startsWith("/app/zakoni");
  // Collapsed by default to keep the sidebar tidy; opened when a law is active.
  const [lawsOpen, setLawsOpen] = useState(onLaw);

  const cls = (active: boolean) =>
    `flex items-center gap-2.5 truncate rounded-lg px-3 py-2 text-[0.9rem] transition-colors ${
      active
        ? "bg-accent-weak font-medium text-accent"
        : "text-ink/75 hover:bg-bg-tint hover:text-ink"
    }`;

  return (
    <nav className="flex flex-col gap-0.5">
      <Link href="/app" className={cls(pathname === "/app")}>
        <span aria-hidden className="text-base leading-none">📅</span>
        Kalendar
      </Link>

      <Link href="/app/pitanja" className={cls(pathname === "/app/pitanja")}>
        <span aria-hidden className="text-base leading-none">💬</span>
        Postavi pitanje
      </Link>

      <Link href="/app/zaduzenja" className={cls(pathname.startsWith("/app/zaduzenja"))}>
        <span aria-hidden className="text-base leading-none">📄</span>
        Odluke o zaduženjima
      </Link>

      <Link href="/app/ucitelji" className={cls(pathname.startsWith("/app/ucitelji"))}>
        <span aria-hidden className="text-base leading-none">👥</span>
        Učitelji
      </Link>

      {isAdmin ? (
        <>
          <Link
            href="/app/admin/promjene"
            className={cls(pathname.startsWith("/app/admin/promjene"))}
          >
            <span aria-hidden className="text-base leading-none">⚙️</span>
            Promjene zakona
          </Link>
          <Link
            href="/app/admin/prijedlozi"
            className={cls(pathname.startsWith("/app/admin/prijedlozi"))}
          >
            <span aria-hidden className="text-base leading-none">📨</span>
            Prijedlozi (beta)
          </Link>
        </>
      ) : null}

      <button
        type="button"
        aria-expanded={lawsOpen}
        onClick={(e) => {
          e.stopPropagation(); // don't close the mobile drawer
          setLawsOpen((v) => !v);
        }}
        className="mt-6 mb-1 flex w-full items-center justify-between gap-2 rounded-lg px-3 py-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-faint transition-colors hover:text-ink"
      >
        <span>Propisi</span>
        <span className="flex items-center gap-1.5 tracking-normal normal-case">
          <span>{laws.length}</span>
          <span
            aria-hidden
            className={`inline-block text-[0.7em] transition-transform ${lawsOpen ? "rotate-90" : ""}`}
          >
            ▶
          </span>
        </span>
      </button>

      {lawsOpen
        ? laws.map((l) => {
            const href = `/app/zakoni/${l.slug}`;
            return (
              <Link
                key={l.slug}
                href={href}
                title={l.title}
                className={`block truncate rounded-lg px-3 py-1.5 text-[0.82rem] transition-colors ${
                  pathname === href
                    ? "bg-accent-weak font-medium text-accent"
                    : "text-muted hover:bg-bg-tint hover:text-ink"
                }`}
              >
                {l.title}
              </Link>
            );
          })
        : null}
    </nav>
  );
}
