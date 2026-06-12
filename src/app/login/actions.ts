"use server";

import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { createSession } from "@/lib/session";

export interface LoginState {
  error?: string;
}

/**
 * Server Action: validate credentials against the `users` table and, on
 * success, create a session cookie and redirect home.
 *
 * Security notes:
 * - Runs server-side only; the password never reaches the client after submit.
 * - bcrypt.compare against the stored hash; plaintext is never stored/logged.
 * - A single generic message for both "unknown user" and "wrong password" so
 *   we don't reveal which usernames exist.
 */
export async function login(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!username || !password) {
    return { error: "Unesite korisničko ime i lozinku." };
  }

  const invalid: LoginState = {
    error: "Pogrešno korisničko ime ili lozinka.",
  };

  try {
    const supabase = getSupabaseAdmin();
    const { data: user, error } = await supabase
      .from("users")
      .select("id, username, password_hash, school_name")
      .eq("username", username)
      .maybeSingle();

    if (error || !user) return invalid;

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return invalid;

    await createSession({
      uid: user.id,
      usr: user.username,
      school: user.school_name ?? "",
    });
  } catch (e) {
    console.error("login error:", e);
    return { error: "Došlo je do greške. Pokušajte ponovno." };
  }

  // Must be outside the try/catch: redirect() works by throwing internally.
  redirect("/");
}
