"use client";

import { useState } from "react";

// No backend yet: open the visitor's mail client with their address prefilled.
// Swap this for a form service (Tally/Formspree) or a Supabase insert later.
const BETA_EMAIL = "beta@e-ravnatelj.hr";

export function BetaForm() {
  const [done, setDone] = useState(false);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get("email") ?? "").trim();
    if (!email) return;
    setDone(true);
    const subject = encodeURIComponent("Prijava za beta e-Ravnatelj");
    const body = encodeURIComponent(
      `Želim se prijaviti za beta testiranje.\n\nMoj email: ${email}\nŠkola: \n`,
    );
    window.location.href = `mailto:${BETA_EMAIL}?subject=${subject}&body=${body}`;
  }

  return (
    <>
      <form onSubmit={onSubmit} className="mt-7 flex flex-wrap justify-center gap-3">
        <input
          type="email"
          name="email"
          required
          placeholder="vas.email@skola.hr"
          aria-label="Email adresa"
          className="max-w-[22rem] flex-[1_1_18rem] rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-base text-white outline-none transition-colors placeholder:text-white/55 focus:border-gold-bright focus:ring-4 focus:ring-gold-bright/25"
        />
        <button
          type="submit"
          className="rounded-lg bg-gold-bright px-6 py-3 text-base font-bold text-ink transition-[filter] hover:brightness-105"
        >
          Prijavi se
        </button>
      </form>
      {done ? (
        <p className="mt-5 font-semibold text-white">
          Hvala! Otvorili smo email za prijavu — pošaljite ga i javit ćemo se uskoro. ✦
        </p>
      ) : null}
    </>
  );
}
