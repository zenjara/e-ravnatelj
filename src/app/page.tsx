import Link from "next/link";
import type { Metadata } from "next";
import { BetaForm } from "./beta-form";

export const metadata: Metadata = {
  title: "e-Ravnatelj — digitalni asistent ravnateljima osnovnih škola",
  description:
    "Pravni asistent nad propisima, generiranje Odluka o zaduženjima, školski kalendar, pročišćeni zakoni i profil škole. Prijavite se za beta testiranje.",
};

const FEATURES = [
  {
    icon: "⚖️",
    title: "Pravni asistent",
    desc: "Postavite pitanje o propisima i dobijete odgovor utemeljen na aktualnim zakonima, uz navođenje članka na koji se poziva.",
  },
  {
    icon: "📄",
    title: "Odluke o zaduženjima",
    desc: "Učitate ispunjenu tablicu, a aplikacija izradi gotovu Odluku za svakog učitelja — spremnu za ispis i potpis, u jednom PDF-u ili zasebno.",
  },
  {
    icon: "📅",
    title: "Školski kalendar",
    desc: "Pregledan kalendar školske godine s blagdanima i odmorima, a vlastite dane (Dan škole, Dan grada) škola upisuje sama.",
  },
  {
    icon: "👥",
    title: "Profil škole i učitelji",
    desc: "Podaci škole su već popunjeni iz javnog registra, a popis učitelja uvezete iz e-Matice u nekoliko klikova.",
  },
];

export default function LandingPage() {
  return (
    <div className="bg-bg text-ink">
      {/* Top bar */}
      <div className="mx-auto max-w-5xl px-6">
        <div className="flex items-center justify-between py-6">
          <span className="font-serif text-xl font-semibold">e&#8209;Ravnatelj</span>
          <Link
            href="/login"
            className="text-sm font-medium text-accent underline-offset-4 hover:underline"
          >
            Prijava →
          </Link>
        </div>
      </div>

      {/* Hero */}
      <header className="mx-auto max-w-5xl px-6 pt-10 pb-12 text-center">
        <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-[#e9dcb4] bg-gold-weak px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-gold">
          <span className="h-1.5 w-1.5 rounded-full bg-gold-bright" />
          Beta · u izradi
        </span>
        <h1 className="font-serif text-[clamp(3rem,11vw,6.5rem)] font-semibold leading-[0.98] tracking-[-0.03em]">
          e&#8209;Ravnatelj
        </h1>
        <div className="mx-auto mt-6 h-0.5 w-16 bg-gold" />
        <p className="mx-auto mt-6 max-w-[34rem] text-lg text-muted">
          Digitalni asistent ravnateljima osnovnih škola. Manje papirologije i
          traženja po propisima — više vremena za školu.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <a
            href="#beta"
            className="rounded-lg bg-accent px-6 py-3 text-[0.95rem] font-semibold text-accent-ink shadow-[var(--shadow)] transition-colors hover:bg-accent-hover"
          >
            Prijavi se za beta testiranje
          </a>
          <a
            href="#sto"
            className="rounded-lg border border-line-strong px-6 py-3 text-[0.95rem] font-semibold text-accent transition-colors hover:border-accent hover:bg-accent-weak"
          >
            Pogledaj mogućnosti
          </a>
        </div>
      </header>

      {/* Features */}
      <section id="sto" className="mx-auto max-w-5xl px-6 py-14">
        <p className="text-center text-xs font-semibold uppercase tracking-[0.16em] text-gold">
          Što već možete
        </p>
        <h2 className="mt-1.5 text-center font-serif text-[clamp(1.7rem,4vw,2.3rem)] font-semibold">
          Mogućnosti u ovoj verziji
        </h2>
        <p className="mx-auto mt-3 max-w-[34rem] text-center text-muted">
          Sve je osmišljeno uz prave ravnatelje — jednostavno i pregledno, bez
          suvišnih koraka.
        </p>

        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-line bg-surface p-6 shadow-[var(--shadow)]"
            >
              <span className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-accent-weak text-2xl">
                {f.icon}
              </span>
              <h3 className="mb-1.5 font-serif text-xl font-semibold">{f.title}</h3>
              <p className="text-[0.96rem] text-muted">{f.desc}</p>
            </div>
          ))}

          {/* Full-width highlight: consolidated laws & rulebooks */}
          <div className="rounded-2xl border border-line bg-surface p-6 shadow-[var(--shadow)] sm:col-span-2">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent-weak text-2xl">
                📚
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-serif text-xl font-semibold">
                    Pročišćeni zakoni i pravilnici
                  </h3>
                  <span className="rounded-full bg-gold-weak px-2.5 py-0.5 text-xs font-semibold text-gold">
                    30+ propisa
                  </span>
                </div>
                <p className="mt-1.5 text-[0.96rem] text-muted">
                  Svi ključni propisi za osnovnu školu na jednom mjestu, uredno
                  posloženi po člancima — bez traženja po Narodnim novinama. Uvijek
                  aktualni, uz jasno naznačen izvor.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Beta signup */}
      <section id="beta" className="mx-auto max-w-5xl px-6 py-14">
        <div className="rounded-3xl bg-accent px-6 py-12 text-center shadow-[var(--shadow-lg)] sm:px-8">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold-bright">
            Beta testiranje
          </p>
          <h2 className="mt-1.5 font-serif text-[clamp(1.8rem,4vw,2.4rem)] font-semibold text-white">
            Pridružite se ranoj beti
          </h2>
          <p className="mx-auto mt-4 max-w-[34rem] text-white/80">
            Tražimo nekoliko ravnatelja osnovnih škola za ranu betu. Besplatno, uz
            vašu povratnu informaciju. Ostavite email i javimo se s pristupom.
          </p>
          <BetaForm />
          <p className="mt-4 text-sm text-white/60">
            Koristimo email isključivo za kontakt oko bete. Bez obveza.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="mx-auto max-w-5xl px-6 pb-12 pt-6 text-center text-sm text-faint">
        <span className="font-serif font-semibold text-muted">e&#8209;Ravnatelj</span>
        <span className="mx-2 text-line-strong">·</span>
        Informativno, nije pravni savjet
        <span className="mx-2 text-line-strong">·</span>
        Bez OIB-a i podataka o učenicima
        <span className="mx-2 text-line-strong">·</span>© 2026
      </footer>
    </div>
  );
}
