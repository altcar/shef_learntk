/**
 * Signed, stateless session cookies.
 *
 * The session is a JSON payload plus an HMAC-SHA256 signature. No database read
 * is required to authorise a request, and — unlike the previous implementation —
 * the browser cannot forge or edit the payload.
 */
import type { AstroCookies } from "astro";
import { readEnv, requireEnv } from "./config";

export const SESSION_COOKIE = "learntk_session";
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export interface SessionPayload {
  /** Schema version, lets us invalidate old cookies after a breaking change. */
  v: 1;
  /** Discord user id. */
  sub: string;
  username: string;
  displayName: string;
  avatar: string | null;
  email: string | null;
  guildId: string;
  /** All role ids the user has in the configured guild. */
  roles: string[];
  /** True when the user holds at least one role that unlocks course content. */
  member: boolean;
  /** True when the user holds an instructor/admin role. */
  admin: boolean;
  certificateName: string | null;
  /** Lesson ids the learner has marked complete. */
  progress: Record<string, string>;
  /** Issued at, epoch milliseconds. */
  iat: number;
  /** Expires at, epoch milliseconds. */
  exp: number;
}

/** Fields the caller supplies; timestamps are added by `createSession`. */
export type SessionInput = Omit<SessionPayload, "v" | "iat" | "exp">;

let cachedKey: Promise<CryptoKey> | null = null;

function secret(): string {
  const explicit = readEnv("SESSION_SECRET");
  if (explicit) return explicit;
  // Fall back to a key derived from the Discord client secret so the site keeps
  // working before SESSION_SECRET is configured. Both values are server-only.
  const fallback = readEnv("DISCORD_CLIENT_SECRET");
  if (fallback) return `learntk-session-v1:${fallback}`;
  requireEnv("SESSION_SECRET");
  throw new Error("unreachable");
}

function signingKey(): Promise<CryptoKey> {
  if (!cachedKey) {
    cachedKey = crypto.subtle.importKey(
      "raw",
      encoder.encode(secret()),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign", "verify"],
    );
  }
  return cachedKey;
}

function base64url(bytes: Uint8Array | ArrayBuffer): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  for (const byte of view) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64url(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const withPadding = padded.padEnd(
    padded.length + ((4 - (padded.length % 4)) % 4),
    "=",
  );
  const binary = atob(withPadding);
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function createSession(input: SessionInput): SessionPayload {
  const now = Date.now();
  return {
    ...input,
    v: 1,
    iat: now,
    exp: now + SESSION_TTL_MS,
  };
}

/** Serialise and sign a session payload into a cookie value. */
export async function serializeSession(
  payload: SessionPayload,
): Promise<string> {
  const body = base64url(encoder.encode(JSON.stringify(payload)));
  const signature = await crypto.subtle.sign(
    "HMAC",
    await signingKey(),
    encoder.encode(body),
  );
  return `${body}.${base64url(signature)}`;
}

/**
 * Verify a cookie value and return the payload.
 * Returns `null` for malformed, tampered with, or expired sessions.
 */
export async function deserializeSession(
  token: string | undefined | null,
): Promise<SessionPayload | null> {
  if (!token) return null;
  const separator = token.lastIndexOf(".");
  if (separator <= 0) return null;

  const body = token.slice(0, separator);
  const signature = token.slice(separator + 1);

  let signatureBytes: Uint8Array<ArrayBuffer>;
  try {
    signatureBytes = fromBase64url(signature);
  } catch {
    return null;
  }

  const valid = await crypto.subtle.verify(
    "HMAC",
    await signingKey(),
    signatureBytes,
    encoder.encode(body),
  );
  if (!valid) return null;

  let payload: SessionPayload;
  try {
    payload = JSON.parse(decoder.decode(fromBase64url(body)));
  } catch {
    return null;
  }

  if (!payload || payload.v !== 1 || typeof payload.sub !== "string") {
    return null;
  }
  if (typeof payload.exp !== "number" || payload.exp <= Date.now()) {
    return null;
  }
  return payload;
}

/** Read the verified session from the request cookies. */
export async function readSession(
  cookies: AstroCookies,
): Promise<SessionPayload | null> {
  return deserializeSession(cookies.get(SESSION_COOKIE)?.value);
}

interface CookieOptionsContext {
  url: URL;
}

function baseCookieOptions(context?: CookieOptionsContext) {
  const secure = context
    ? context.url.protocol === "https:"
    : readEnv("NODE_ENV") === "production";
  return {
    path: "/",
    httpOnly: true,
    secure,
    sameSite: "lax" as const,
  };
}

export async function setSessionCookie(
  cookies: AstroCookies,
  payload: SessionPayload,
  context?: CookieOptionsContext,
): Promise<void> {
  cookies.set(SESSION_COOKIE, await serializeSession(payload), {
    ...baseCookieOptions(context),
    maxAge: Math.max(1, Math.floor((payload.exp - Date.now()) / 1000)),
  });
}

export function clearSessionCookie(
  cookies: AstroCookies,
  context?: CookieOptionsContext,
): void {
  cookies.delete(SESSION_COOKIE, baseCookieOptions(context));
}
