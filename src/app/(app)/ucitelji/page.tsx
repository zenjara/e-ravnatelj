import { requireSession } from "@/lib/session";
import { getCurrentSchool } from "@/lib/school";
import { getTeachers } from "./actions";
import { UciteljiClient } from "./ucitelji-client";

/**
 * "Učitelji" section: the school's staff roster, imported from an e-Matica staff
 * export the principal uploads. Bound to the session's school (server-side).
 */
export default async function UciteljiPage() {
  await requireSession();
  const school = await getCurrentSchool();
  const teachers = school ? await getTeachers() : [];
  return (
    <UciteljiClient
      schoolName={school?.naziv ?? null}
      initialTeachers={teachers}
    />
  );
}
