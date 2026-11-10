/**
 * Access rules for the site.
 *
 * Everything under `PROTECTED_PREFIXES` requires a verified session whose
 * Discord roles include a course member role. Everything else is public, so the
 * sales pages and lesson previews can be indexed by search engines.
 */
import type { SessionPayload } from "./session";

/** The subset of the session exposed to pages and components. */
export interface SessionUser {
  id: string;
  username: string;
  displayName: string;
  avatar: string | null;
  email: string | null;
  roles: string[];
  admin: boolean;
  certificateName: string | null;
}

/**
 * Path prefixes that require an authenticated, role-verified member.
 * Keep this list in sync with the routes that render paid content.
 */
export const PROTECTED_PREFIXES = [
  "/24b", // Starlight beginner course
  "/week1", // legacy Starlight route for the final project submission page
  "/learn", // future curriculum routes
  "/course", // learner dashboard + lesson index
  "/welcome", // onboarding
  "/account", // account settings
  "/certificate", // verifiable certificates
] as const;

/** `/api/*` endpoints validate the session themselves. */
export function isApiPath(pathname: string): boolean {
  return pathname === "/api" || pathname.startsWith("/api/");
}

/** Static files that must stay reachable without a session. */
export function isAssetPath(pathname: string): boolean {
  if (pathname.startsWith("/_astro/")) return true;
  if (pathname.startsWith("/fonts/")) return true;
  if (pathname.startsWith("/img/")) return true;
  return /\.(?:css|js|mjs|map|woff2?|ttf|otf|eot|png|jpe?g|gif|svg|webp|avif|ico)$/i.test(
    pathname,
  );
}

function normalise(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.replace(/\/+$/, "");
  }
  return pathname;
}

export function isProtectedPath(pathname: string): boolean {
  const path = normalise(pathname);
  return PROTECTED_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

/**
 * Only allow same-site relative paths as post-login destinations so the login
 * flow can never be used as an open redirect.
 */
export function safeNext(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  if (value.startsWith("/\\")) return null;
  // Disallow control characters that some browsers strip.
  if (/[\u0000-\u001f\u007f]/.test(value)) return null;
  return value;
}

export function loginUrl(next?: string | null): string {
  const target = safeNext(next);
  return target
    ? `/api/login?next=${encodeURIComponent(target)}`
    : "/api/login";
}

export type DenialReason =
  | "not_signed_in"
  | "not_in_guild"
  | "missing_role"
  | "oauth_denied"
  | "oauth_failed"
  | "state_mismatch"
  | "session_expired";

export function accessDeniedUrl(
  reason: DenialReason,
  next?: string | null,
): string {
  const params = new URLSearchParams({ reason });
  const target = safeNext(next);
  if (target) params.set("next", target);
  return `/access-denied?${params.toString()}`;
}

/** Where a freshly authenticated member should land. */
export function landingPath(session: SessionPayload): string {
  if (!session.certificateName) return "/welcome";
  return "/course";
}

export function defaultNext(session: SessionPayload): string {
  return landingPath(session);
}
