import { requireSession } from "@/lib/session";
import { todayZagreb } from "@/lib/school-calendar";
import { upcomingRokovi } from "@/lib/rokovnik";
import { getRokovi } from "@/lib/rokovi-data";
import { getSchoolDates } from "./calendar-actions";
import { Calendar } from "./calendar";

/**
 * Principal's landing screen: the school-year calendar + a "rokovnik" panel of
 * upcoming legal deadlines (global, same for every school). The fixed framework
 * (nastavni dani, odmori, blagdani) is in code; the school's own dates come from
 * the DB. `today` is computed server-side in Europe/Zagreb so it matches on the
 * client (no hydration drift) and is TZ-correct on Vercel's UTC runtime.
 */
export default async function Home() {
  await requireSession();
  const today = todayZagreb();
  const [schoolDates, rokovi] = await Promise.all([getSchoolDates(), getRokovi()]);
  const rokovnik = upcomingRokovi(rokovi, today, 4);
  return <Calendar schoolDates={schoolDates} today={today} rokovnik={rokovnik} />;
}
