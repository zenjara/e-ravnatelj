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
        className="mt-1 mb-0.5 flex w-full items-center justify-between gap-2 rounded-lg px-3 py-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-faint transition-colors hover:text-ink"
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

/**
 * Umbrella "Dokumenti" section: a collapsible top-level header holding the
 * category subgroups (Zakoni / Pravilnici / Kolektivni ugovori / Državni
 * pedagoški standardi). Open by default so the categories are discoverable;
 * each subgroup collapses on its own.
 */
function DocumentsSection({
  groups,
  pathname,
  activeSlug,
}: {
  groups: { label: string; laws: Law[] }[];
  pathname: string;
  activeSlug: string | null;
}) {
  const [open, setOpen] = useState(true);
  const total = groups.reduce((n, g) => n + g.laws.length, 0);

  if (total === 0) return null;

  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation(); // don't close the mobile drawer
          setOpen((v) => !v);
        }}
        className="mt-6 mb-1 flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-[0.9rem] text-ink/75 transition-colors hover:bg-bg-tint hover:text-ink"
      >
        <span className="flex items-center gap-2.5">
          <span aria-hidden className="text-base leading-none">📚</span>
          Dokumenti
        </span>
        <span className="flex items-center gap-1.5 text-xs text-faint">
          <span>{total}</span>
          <span
            aria-hidden
            className={`inline-block text-[0.7em] transition-transform ${open ? "rotate-90" : ""}`}
          >
            ▶
          </span>
        </span>
      </button>

      {open ? (
        <div className="ml-3 border-l border-line pl-1.5">
          {groups.map((g) => (
            <LawGroup
              key={g.label}
              label={g.label}
              laws={g.laws}
              pathname={pathname}
              activeSlug={activeSlug}
            />
          ))}
        </div>
      ) : null}
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

  // Split by category. The four known kinds each get their own group; anything
  // with an unexpected kind falls back into Zakoni so nothing ever disappears.
  const pravilnici = laws.filter((l) => l.kind === "pravilnik");
  const kolektivni = laws.filter((l) => l.kind === "kolektivni-ugovor");
  const standardi = laws.filter((l) => l.kind === "pedagoski-standard");
  const zakoni = laws.filter(
    (l) => !["pravilnik", "kolektivni-ugovor", "pedagoski-standard"].includes(l.kind),
  );

  // Ordered subgroups shown under the "Dokumenti" umbrella (empty ones hide).
  const documentGroups: { label: string; laws: Law[] }[] = [
    { label: "Zakoni", laws: zakoni },
    { label: "Pravilnici", laws: pravilnici },
    { label: "Kolektivni ugovori", laws: kolektivni },
    { label: "Državni pedagoški standardi", laws: standardi },
  ];

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

      {/* Alati za ravnatelje — skriveni u admin sučelju (otac ih ne koristi). */}
      {!isAdmin ? (
        <>
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
        </>
      ) : null}

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
            href="/app/admin/pitanja"
            className={cls(pathname.startsWith("/app/admin/pitanja"))}
          >
            <span aria-hidden className="text-base leading-none">❓</span>
            Pitanja ravnatelja
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

      <DocumentsSection
        groups={documentGroups}
        pathname={pathname}
        activeSlug={activeSlug}
      />
    </nav>
  );
}
