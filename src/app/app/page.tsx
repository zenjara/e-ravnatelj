import { requireSession } from "@/lib/session";
import { todayZagreb } from "@/lib/school-calendar";
import { getSchoolDates } from "./calendar-actions";
import { Calendar } from "./calendar";

/**
 * Principal's landing screen: the school-year calendar. The fixed framework
 * (nastavni dani, odmori, blagdani) is in code; the school's own dates come from
 * the DB. `today` is computed server-side in Europe/Zagreb so it matches on the
 * client (no hydration drift) and is TZ-correct on Vercel's UTC runtime.
 */
export default async function Home() {
  await requireSession();
  const schoolDates = await getSchoolDates();
  return <Calendar schoolDates={schoolDates} today={todayZagreb()} />;
}
