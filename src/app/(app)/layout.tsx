import { requireSession } from "@/lib/session";
import { listLaws } from "@/lib/laws";
import { logout } from "../actions";
import { LawNav } from "./law-nav";

/**
 * Shared shell for the authenticated app: left sidebar (ask + law list) and a
 * scrollable content area. `requireSession()` is the auth gate; the proxy also
 * redirects unauthenticated navigations.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();
  const laws = await listLaws();

  return (
    <div className="flex min-h-screen flex-1">
      <aside className="sticky top-0 flex h-screen w-72 shrink-0 flex-col border-r border-black/10 dark:border-white/10">
        <div className="border-b border-black/10 px-4 py-4 dark:border-white/10">
          <p className="text-base font-semibold tracking-tight">e-ravnatelj</p>
          {session.school ? (
            <p className="mt-0.5 truncate text-xs text-black/60 dark:text-white/60">
              {session.school}
            </p>
          ) : null}
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          <LawNav laws={laws.map(({ slug, title }) => ({ slug, title }))} />
        </div>

        <form action={logout} className="border-t border-black/10 p-3 dark:border-white/10">
          <button
            type="submit"
            className="w-full rounded-md border border-black/15 px-3 py-1.5 text-sm transition-colors hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
          >
            Odjava
          </button>
        </form>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
