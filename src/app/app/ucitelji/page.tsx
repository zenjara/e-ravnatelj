import { requireSession } from "@/lib/session";
import { getCurrentSchool } from "@/lib/school";
import { getTeachers } from "./actions";
import { getLatestGoSnapshots } from "../godisnji-odmori/actions";
import { UciteljiClient } from "./ucitelji-client";

/**
 * "Učitelji" section: the school's staff roster, imported from an e-Matica staff
 * export the principal uploads. Bound to the session's school (server-side).
 * Also loads the latest saved GO snapshot per teacher so the base can preview a
 * generated Rješenje inline.
 */
export default async function UciteljiPage() {
  await requireSession();
  const school = await getCurrentSchool();
  const [teachers, latestGo] = school
    ? await Promise.all([getTeachers(), getLatestGoSnapshots()])
    : [[], {}];
  return (
    <UciteljiClient
      schoolName={school?.naziv ?? null}
      initialTeachers={teachers}
      latestGo={latestGo}
    />
  );
}
