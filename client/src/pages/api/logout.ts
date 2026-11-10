/** Clear the local session. */
import type { APIRoute } from "astro";
import { clearSessionCookie } from "../../lib/session";
import { clearStateCookie } from "../../lib/oauth-state";

const logout: APIRoute = async ({ url, cookies, redirect }) => {
  clearSessionCookie(cookies, { url });
  clearStateCookie(cookies, { url });
  return redirect("/", 302);
};

export const GET = logout;
export const POST = logout;
