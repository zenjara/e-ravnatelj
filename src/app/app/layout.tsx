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
        <form action={logout}>
          <button
            type="submit"
            className="w-full rounded-lg border border-line px-3 py-2 text-sm text-muted transition-colors hover:border-line-strong hover:bg-bg-tint hover:text-ink"
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
