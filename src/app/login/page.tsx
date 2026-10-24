import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  // Already signed in → go home. (Proxy also covers this; this is defense-in-depth.)
  if (await getSession()) redirect("/app");

  return (
    <main className="flex min-h-full flex-1 items-center justify-center bg-bg p-6">
      <div className="w-full max-w-[26rem]">
        <div className="mb-8 text-center">
          <p className="font-serif text-[2rem] font-semibold leading-none tracking-tight text-ink">
            e&#8209;ravnatelj
          </p>
          <div className="mx-auto mt-4 h-px w-12 bg-gold" />
          <p className="mt-4 text-sm text-muted">
            Prijava za ravnatelje osnovnih škola
          </p>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-7 shadow-[var(--shadow)]">
          <LoginForm />
        </div>

        <p className="mt-6 text-center text-xs leading-relaxed text-faint">
          Informativno, nije pravni savjet. Provjerite citirani izvor.
        </p>
      </div>
    </main>
  );
}
