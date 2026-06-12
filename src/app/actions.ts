"use server";

import { redirect } from "next/navigation";
import { deleteSession } from "@/lib/session";

/** Server Action: clear the session and return to the login page. */
export async function logout(): Promise<void> {
  await deleteSession();
  redirect("/login");
}
