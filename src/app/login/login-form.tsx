"use client";

import { useActionState } from "react";
import { login, type LoginState } from "./actions";

const initialState: LoginState = {};

const inputCls =
  "rounded-lg border border-line bg-bg px-3.5 py-2.5 text-sm text-ink outline-none transition-colors placeholder:text-faint focus:border-accent focus:bg-surface focus:ring-4 focus:ring-accent/10";

export function LoginForm() {
  const [state, action, pending] = useActionState(login, initialState);

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="username" className="text-sm font-medium text-ink">
          Korisničko ime
        </label>
        <input
          id="username"
          name="username"
          type="text"
          autoComplete="username"
          autoFocus
          required
          className={inputCls}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-sm font-medium text-ink">
          Lozinka
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={inputCls}
        />
      </div>

      {state.error ? (
        <p
          role="alert"
          className="rounded-lg bg-bad-weak px-3 py-2 text-sm text-bad"
        >
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="mt-1 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-ink shadow-[var(--shadow)] transition-colors hover:bg-accent-hover disabled:opacity-50"
      >
        {pending ? "Prijava…" : "Prijava"}
      </button>
    </form>
  );
}
