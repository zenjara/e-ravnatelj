"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Sidebar navigation: "ask" link + the list of laws, with active highlight. */
export function LawNav({
  laws,
  isAdmin,
}: {
  laws: { slug: string; title: string }[];
  isAdmin: boolean;
}) {
  const pathname = usePathname();

  const cls = (active: boolean) =>
    `block truncate rounded-md px-3 py-1.5 text-sm transition-colors ${
      active
        ? "bg-black/10 font-medium dark:bg-white/15"
        : "text-black/80 hover:bg-black/5 dark:text-white/80 dark:hover:bg-white/10"
    }`;

  return (
    <nav className="flex flex-col gap-0.5">
      <Link href="/" className={cls(pathname === "/")}>
        Postavi pitanje
      </Link>

      {isAdmin ? (
        <Link
          href="/admin/promjene"
          className={cls(pathname.startsWith("/admin"))}
        >
          ⚙️ Promjene zakona
        </Link>
      ) : null}

      <p className="mt-4 mb-1 px-3 text-xs font-semibold uppercase tracking-wide text-black/40 dark:text-white/40">
        Propisi
      </p>

      {laws.map((l) => {
        const href = `/zakoni/${l.slug}`;
        return (
          <Link key={l.slug} href={href} title={l.title} className={cls(pathname === href)}>
            {l.title}
          </Link>
        );
      })}
    </nav>
  );
}
