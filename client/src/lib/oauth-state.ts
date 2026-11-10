/**
 * OAuth `state` handling.
 *
 * The `state` parameter prevents login CSRF: an attacker cannot force a victim
 * to complete an authorisation flow that belongs to the attacker's account.
 */
import type { AstroCookies } from "astro";
import { safeNext } from "./access";

export const STATE_COOKIE = "learntk_oauth_state";
const STATE_TTL_SECONDS = 10 * 60;

export interface OAuthState {
  nonce: string;
  next: string | null;
}

function randomNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

export function createOAuthState(next?: string | null): OAuthState {
  return { nonce: randomNonce(), next: safeNext(next) };
}

interface CookieOptionsContext {
  url: URL;
}

export function setStateCookie(
  cookies: AstroCookies,
  state: OAuthState,
  context?: CookieOptionsContext,
): void {
  const secure = context
    ? context.url.protocol === "https:"
    : import.meta.env.PROD;
  cookies.set(STATE_COOKIE, JSON.stringify(state), {
    path: "/",
    httpOnly: true,
    secure,
    sameSite: "lax",
    maxAge: STATE_TTL_SECONDS,
  });
}

export function readStateCookie(cookies: AstroCookies): OAuthState | null {
  const raw = cookies.get(STATE_COOKIE)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as OAuthState;
    if (!parsed || typeof parsed.nonce !== "string") return null;
    return { nonce: parsed.nonce, next: safeNext(parsed.next) };
  } catch {
    return null;
  }
}

export function clearStateCookie(
  cookies: AstroCookies,
  context?: CookieOptionsContext,
): void {
  const secure = context
    ? context.url.protocol === "https:"
    : import.meta.env.PROD;
  cookies.delete(STATE_COOKIE, {
    path: "/",
    httpOnly: true,
    secure,
    sameSite: "lax",
  });
}

/** Constant-time-ish comparison of two short nonces. */
export function nonceMatches(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}
