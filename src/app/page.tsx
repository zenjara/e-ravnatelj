import { requireSession } from "@/lib/session";
import { logout } from "./actions";
import { AskForm } from "./ask-form";

export default async function Home() {
  // Real auth boundary: redirects to /login if there's no valid session.
  const session = await requireSession();

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-black/10 px-6 py-4 dark:border-white/10">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">e-ravnatelj</h1>
          {session.school ? (
            <p className="text-xs text-black/60 dark:text-white/60">
              {session.school}
            </p>
          ) : null}
        </div>
        <form action={logout}>
          <button
            type="submit"
            className="rounded-md border border-black/15 px-3 py-1.5 text-sm transition-colors hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
          >
            Odjava
          </button>
        </form>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-6">
        <p className="text-sm text-black/70 dark:text-white/70">
          Postavite pitanje o propisima; odgovor se temelji na dostupnom tekstu
          zakona i navodi članak na koji se poziva.
        </p>

        <AskForm />

        <p className="mt-auto pt-2 text-xs text-black/50 dark:text-white/50">
          Informativno, nije pravni savjet. Provjeri citirani izvor.
        </p>
      </main>
    </div>
  );
}
