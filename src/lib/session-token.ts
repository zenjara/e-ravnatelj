import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Stateless session token: a signed (HMAC-SHA256) JSON payload.
 *
 * Format:  base64url(payloadJSON) "." base64url(hmac)
 *
 * This module is dependency-free (only Node's crypto) and does NOT import
 * `next/headers`, so it can be used both in Server Components / Route Handlers
 * (via session.ts) and in proxy.ts, which runs in a different context.
 */

/** Cookie name shared by the session helpers and the proxy. */
export const SESSION_COOKIE_NAME = "eravnatelj_session";

export interface SessionPayload {
  /** user id (uuid) */
  uid: string;
  /** username */
  usr: string;
  /** school name (org, not personal PII) */
  school: string;
  /** role: "principal" | "admin" */
  role: string;
  /** expiry, epoch milliseconds */
  exp: number;
}

function hmac(body: string, secret: string): string {
  return createHmac("sha256", secret).update(body).digest("base64url");
}

export function signSessionToken(
  payload: SessionPayload,
  secret: string,
): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${hmac(body, secret)}`;
}

/**
 * Verify a token's signature and expiry. Returns the payload, or null if the
 * token is missing, tampered with, malformed, or expired.
 */
export function verifySessionToken(
  token: string | undefined,
  secret: string,
): SessionPayload | null {
  if (!token) return null;
  const dot = token.indexOf(".");
  if (dot <= 0) return null;

  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = hmac(body, secret);

  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString(),
    ) as SessionPayload;
    if (typeof payload.exp !== "number" || payload.exp < Date.now()) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}
