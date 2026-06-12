import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireServerEnv } from "@/lib/env";
import {
  SESSION_COOKIE_NAME,
  signSessionToken,
  verifySessionToken,
  type SessionPayload,
} from "@/lib/session-token";

/**
 * Server-side session helpers. Reads/writes the signed session cookie.
 * Import only from Server Components, Server Actions, or Route Handlers.
 */

/** Session lifetime: 8 hours (a working day). */
const MAX_AGE_SECONDS = 60 * 60 * 8;

/** Create + set the session cookie after a successful login. */
export async function createSession(
  data: Omit<SessionPayload, "exp">,
): Promise<void> {
  const secret = requireServerEnv("SESSION_SECRET");
  const exp = Date.now() + MAX_AGE_SECONDS * 1000;
  const token = signSessionToken({ ...data, exp }, secret);

  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

/**
 * Read and verify the current session. Returns the payload or null.
 * Memoized per-request with React `cache` to avoid re-verifying repeatedly.
 */
export const getSession = cache(async (): Promise<SessionPayload | null> => {
  const secret = process.env.SESSION_SECRET;
  if (!secret) return null;
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  return verifySessionToken(token, secret);
});

/**
 * Require a valid session; redirect to /login if there is none.
 * Use this as the real auth boundary in protected pages / route handlers.
 */
export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

/** Clear the session cookie (logout). */
export async function deleteSession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE_NAME);
}
