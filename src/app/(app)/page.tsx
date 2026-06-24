import { AskForm } from "./ask-form";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-6">
      <p className="text-sm text-black/70 dark:text-white/70">
        Postavite pitanje o propisima; odgovor se temelji na dostupnom tekstu
        zakona i navodi članak na koji se poziva. Cijele tekstove možete pročitati
        i sami — odaberite propis u izborniku lijevo.
      </p>

      <AskForm />

      <p className="mt-auto pt-2 text-xs text-black/50 dark:text-white/50">
        Informativno, nije pravni savjet. Provjeri citirani izvor.
      </p>
    </main>
  );
}
