import { requireSession } from "@/lib/session";
import { ZaduzenjaWizard } from "./wizard";

/** Current school year as "YYYY./YYYY+1." (Sept rolls it over). */
function currentSchoolYear(d = new Date()): string {
  const y = d.getFullYear();
  return d.getMonth() >= 8 ? `${y}./${y + 1}.` : `${y - 1}./${y}.`;
}

/**
 * "Odluke o zaduženjima" section: upload the filled ministry table → generate a
 * ready-to-print Odluka per teacher. A simple 3-step wizard for the principal.
 */
export default async function ZaduzenjaPage() {
  await requireSession();
  return <ZaduzenjaWizard defaultGodina={currentSchoolYear()} />;
}
