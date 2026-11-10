/**
 * Shared server-side validation / normalization for Godišnji odmor (GO) input.
 *
 * These helpers were previously copy-pasted across ucitelji/actions.ts,
 * godisnji-odmori/actions.ts and api/ucitelji/go/route.ts. Centralizing them
 * means the clamp limits and key whitelists can't silently drift apart — which
 * matters because `go_socijalni` holds sensitive personal data, so a single
 * well-reviewed sanitizer is better than three near-copies.
 *
 * Pure module (no "use server", no I/O) so it can be imported from Server
 * Actions, Route Handlers, and — for the types only — client components.
 */
import type { Kategorija, Rezultati, UvjetKey } from "./godisnji-odmor";

export type GoUvjeti = Partial<Record<UvjetKey, boolean>>;

/** Sensitive social criteria — stored server-side only, never sent to the AI. */
export interface GoSocijalni {
  brojDjece?: number;
  djecaSTeskocama?: number;
  invaliditet?: boolean;
  samohrani?: boolean;
  domovinskiRat?: boolean;
}

/** Canonical ordered lists — the single source of truth for what is accepted. */
export const KATEGORIJE: Kategorija[] = ["I", "II", "III", "ostali"];
export const REZULTATI: Exclude<Rezultati, null>[] = [
  "izuzetni",
  "vrlo_uspjesni",
  "uspjesni",
];
export const UVJET_KEYS: UvjetKey[] = [
  "posebni_uvjeti",
  "smjenski",
  "rad_s_teskocama",
  "razrednik",
  "vise_predmeta",
  "dvije_skole",
];

/** A positive integer count, clamped to a sane 0..20 range (0 when invalid). */
export function clampCount(v: unknown): number {
  const n = Math.trunc(Number(v));
  return Number.isFinite(n) && n > 0 ? Math.min(n, 20) : 0;
}

export const asKategorija = (v: unknown): Kategorija | null =>
  KATEGORIJE.includes(v as Kategorija) ? (v as Kategorija) : null;

export const asRezultati = (v: unknown): Rezultati =>
  REZULTATI.includes(v as Exclude<Rezultati, null>) ? (v as Rezultati) : null;

/**
 * Keep only known boolean flags set to true — never trust arbitrary client keys.
 * Accepts `unknown` because it sanitizes raw request bodies as well as typed
 * GoUvjeti objects; everything outside the whitelist is dropped.
 */
export function cleanUvjeti(u: unknown): GoUvjeti {
  const src = (u ?? {}) as Record<string, unknown>;
  const out: GoUvjeti = {};
  for (const k of UVJET_KEYS) if (src[k]) out[k] = true;
  return out;
}

/** Whitelist + clamp the social criteria before they are persisted. */
export function cleanSocijalni(s: GoSocijalni | undefined): GoSocijalni {
  return {
    brojDjece: clampCount(s?.brojDjece),
    djecaSTeskocama: clampCount(s?.djecaSTeskocama),
    invaliditet: !!s?.invaliditet,
    samohrani: !!s?.samohrani,
    domovinskiRat: !!s?.domovinskiRat,
  };
}
