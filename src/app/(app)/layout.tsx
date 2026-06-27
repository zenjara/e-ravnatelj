import { requireSession } from "@/lib/session";
import { listLaws } from "@/lib/laws";
import { logout } from "../actions";
import { AppShell } from "./app-shell";

/**
 * Auth gate + app chrome. `requireSession()` redirects unauthenticated users
 * (the proxy also covers navigations). The responsive sidebar lives in AppShell.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();
  const laws = await listLaws();

  return (
    <AppShell
      school={session.school || null}
      isAdmin={session.role === "admin"}
      laws={laws.map(({ slug, title }) => ({ slug, title }))}
      logout={
        <form
          action={logout}
          className="border-t border-black/10 p-3 dark:border-white/10"
        >
          <button
            type="submit"
            className="w-full rounded-md border border-black/15 px-3 py-1.5 text-sm transition-colors hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
          >
            Odjava
          </button>
        </form>
      }
    >
      {children}
    </AppShell>
  );
}
