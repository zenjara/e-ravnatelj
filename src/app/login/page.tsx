import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  // Already signed in → go home. (Proxy also covers this; this is defense-in-depth.)
  if (await getSession()) redirect("/");

  return (
    <main className="flex min-h-full flex-1 items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">e-ravnatelj</h1>
          <p className="mt-1 text-sm text-black/60 dark:text-white/60">
            Prijava za ravnatelje osnovnih škola
          </p>
        </div>

        <div className="rounded-xl border border-black/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/5">
          <LoginForm />
        </div>

        <p className="mt-6 text-center text-xs text-black/50 dark:text-white/50">
          Informativno, nije pravni savjet. Provjeri citirani izvor.
        </p>
      </div>
    </main>
  );
}
