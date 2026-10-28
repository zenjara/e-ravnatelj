/**
 * e-Matica "radno iskustvo" (staž) parsing.
 *
 * The export encodes staž oddly in a single cell:
 *   - 1–2 digits  → whole number of YEARS                 (37      → 37 g)
 *   - 3–6 digits  → right-aligned GG MM DD pairs           (140415  → 14 g 4 mj 15 d)
 *                                                          (40906   →  4 g 9 mj  6 d)
 *                                                          (1100    →  0 g 11 mj 0 d)
 *                                                          (128     →  0 g 1 mj 28 d)
 *
 * Column J = ukupni staž (used for godišnji odmor); column K = staž u obrazovanju.
 * Both use the same encoding.
 */

export interface Staz {
  godine: number;
  mjeseci: number;
  dani: number;
}

/** Parse one staž cell. Returns null for empty/blank input (0 stays a valid zero staž). */
export function parseStaz(raw: unknown): Staz | null {
  const clean = String(raw ?? "").trim();
  if (clean === "") return null;

  const digits = clean.replace(/\D/g, "");
  if (digits === "") return null;

  // Drop leading zeros to count the "real" digits the way e-Matica stores them.
  const trimmed = digits.replace(/^0+/, "");
  if (trimmed === "") return { godine: 0, mjeseci: 0, dani: 0 }; // all-zero cell

  // 1–2 digits → years only.
  if (trimmed.length <= 2) {
    return { godine: Number(trimmed), mjeseci: 0, dani: 0 };
  }

  // 3–6 digits → GGMMDD, read in pairs from the right.
  const p = trimmed.slice(-6).padStart(6, "0");
  return {
    godine: Number(p.slice(0, 2)),
    mjeseci: Number(p.slice(2, 4)),
    dani: Number(p.slice(4, 6)),
  };
}

/** Human-readable Croatian: "14 g 4 mj 15 d", "37 g", "11 mj". "—" when unknown. */
export function formatStaz(s: Staz | null): string {
  if (!s) return "—";
  const parts: string[] = [];
  if (s.godine) parts.push(`${s.godine} g`);
  if (s.mjeseci) parts.push(`${s.mjeseci} mj`);
  if (s.dani) parts.push(`${s.dani} d`);
  return parts.length ? parts.join(" ") : "0 g";
}

/** Approximate total in years — for sorting and godišnji-odmor thresholds. */
export function stazToYears(s: Staz | null): number {
  if (!s) return 0;
  return s.godine + s.mjeseci / 12 + s.dani / 365;
}
