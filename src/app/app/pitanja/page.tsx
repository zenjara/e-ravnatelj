import { AskForm } from "../ask-form";

export default function PitanjaPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-5 sm:p-8">
      <div>
        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-gold">
          Pravni asistent
        </p>
        <h1 className="font-serif text-[1.9rem] font-semibold leading-tight tracking-tight text-ink">
          Postavi pitanje
        </h1>
        <p className="mt-1.5 text-sm leading-relaxed text-muted">
          Odgovor se temelji na dostupnom tekstu zakona i navodi članak na koji
          se poziva. Cijele tekstove možete pročitati i sami — odaberite propis u
          izborniku lijevo.
        </p>
      </div>

      <AskForm />

      <p className="mt-auto pt-2 text-xs text-faint">
        Informativno, nije pravni savjet. Provjeri citirani izvor.
      </p>
    </main>
  );
}
