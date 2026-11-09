"use client";

import { useEffect } from "react";
import type { Kategorija, Rezultati } from "@/lib/ucitelji/godisnji-odmor";
import type { GoUvjeti, GoSocijalni } from "../ucitelji/actions";

/** Body for POST /api/ucitelji/go → a Rješenje o godišnjem odmoru PDF. */
export interface GoPdfInput {
  ime: string;
  prezime: string;
  zvanje: string;
  staz_ukupno?: number | null;
  kategorija: Kategorija;
  uvjeti: GoUvjeti;
  socijalni: GoSocijalni;
  rezultati: Rezultati;
  klasa: string;
  urbroj: string;
  godina: string | number;
}

/** Generate the GO PDF for one employee and return it as a Blob (throws on error). */
export async function fetchGoPdf(input: GoPdfInput): Promise<Blob> {
  const res = await fetch("/api/ucitelji/go", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => null);
    throw new Error(e?.error ?? "Generiranje nije uspjelo.");
  }
  return res.blob();
}

/** Trigger a browser download of a blob under `filename`. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Full-screen inline PDF preview (modal). */
export function PdfPreview({
  url,
  title,
  onDownload,
  onClose,
}: {
  url: string;
  title: string;
  onDownload: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-ink/50 p-3 backdrop-blur-[1px] sm:p-6"
      onClick={onClose}
    >
      <div
        className="mx-auto flex h-full w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-surface shadow-[var(--shadow-lg)]"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
          <span className="truncate text-sm font-medium text-ink">{title}</span>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={onDownload}
              className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink transition-colors hover:bg-accent-hover"
            >
              Preuzmi
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Zatvori pregled"
              className="rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-bg-tint"
            >
              Zatvori ✕
            </button>
          </div>
        </header>
        <iframe src={url} title={title} className="min-h-0 w-full flex-1 bg-bg" />
      </div>
    </div>
  );
}
