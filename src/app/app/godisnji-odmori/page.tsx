import { requireSession } from "@/lib/session";
import { getCurrentSchool } from "@/lib/school";
import { getTeachers } from "../ucitelji/actions";
import { GodisnjiOdmoriClient } from "./godisnji-odmori-client";

/**
 * "Godišnji odmori" section: generate a Rješenje o godišnjem odmoru per
 * employee, based on the roster imported in "Učitelji". Reads the same saved
 * teachers (bound to the session's school), but focuses the UI on annual-leave
 * criteria + PDF generation, separate from the roster/base view.
 */
export default async function GodisnjiOdmoriPage() {
  await requireSession();
  const school = await getCurrentSchool();
  const teachers = school ? await getTeachers() : [];
  return (
    <GodisnjiOdmoriClient
      schoolName={school?.naziv ?? null}
      initialTeachers={teachers}
    />
  );
}
