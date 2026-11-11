"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type Law = { slug: string; title: string; kind: string };

/** One collapsible category of laws (Zakoni / Pravilnici) in the sidebar. */
function LawGroup({
  label,
  laws,
  pathname,
  activeSlug,
}: {
  label: string;
  laws: Law[];
  pathname: string;
  activeSlug: string | null;
}) {
  const hasActive = activeSlug != null && laws.some((l) => l.slug === activeSlug);
  // Collapsed by default; opened when one of its laws is the active page.
  const [open, setOpen] = useState(hasActive);

  if (laws.length === 0) return null;

  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation(); // don't close the mobile drawer
          setOpen((v) => !v);
        }}
        className="mt-6 mb-1 flex w-full items-center justify-between gap-2 rounded-lg px-3 py-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-faint transition-colors hover:text-ink"
      >
        <span>{label}</span>
        <span className="flex items-center gap-1.5 tracking-normal normal-case">
          <span>{laws.length}</span>
          <span
            aria-hidden
            className={`inline-block text-[0.7em] transition-transform ${open ? "rotate-90" : ""}`}
          >
            ▶
          </span>
        </span>
      </button>

      {open
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
    </>
  );
}

/** Sidebar navigation: primary links + laws grouped by category, active highlight. */
export function LawNav({
  laws,
  isAdmin,
}: {
  laws: Law[];
  isAdmin: boolean;
}) {
  const pathname = usePathname();

  const cls = (active: boolean) =>
    `flex items-center gap-2.5 truncate rounded-lg px-3 py-2 text-[0.9rem] transition-colors ${
      active
        ? "bg-accent-weak font-medium text-accent"
        : "text-ink/75 hover:bg-bg-tint hover:text-ink"
    }`;

  // Split by category. Anything not explicitly a "pravilnik" (zakoni, protokoli,
  // other propisi) lives under Zakoni.
  const zakoni = laws.filter((l) => l.kind !== "pravilnik");
  const pravilnici = laws.filter((l) => l.kind === "pravilnik");

  // Slug of the law currently being read, so its group auto-expands.
  const prefix = "/app/zakoni/";
  const activeSlug = pathname.startsWith(prefix)
    ? pathname.slice(prefix.length)
    : null;

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

      <Link href="/app/ucitelji" className={cls(pathname.startsWith("/app/ucitelji"))}>
        <span aria-hidden className="text-base leading-none">👥</span>
        Učitelji
      </Link>

      <Link href="/app/godisnji-odmori" className={cls(pathname.startsWith("/app/godisnji-odmori"))}>
        <span aria-hidden className="text-base leading-none">🏖️</span>
        Godišnji odmori
      </Link>

      <Link href="/app/zaduzenja" className={cls(pathname.startsWith("/app/zaduzenja"))}>
        <span aria-hidden className="text-base leading-none">📄</span>
        Odluke o zaduženjima
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

      <LawGroup
        label="Zakoni"
        laws={zakoni}
        pathname={pathname}
        activeSlug={activeSlug}
      />
      <LawGroup
        label="Pravilnici"
        laws={pravilnici}
        pathname={pathname}
        activeSlug={activeSlug}
      />
    </nav>
  );
}
