/**
 * Step 1 of the Discord login: redirect the browser to Discord's consent screen.
 *
 * Accepts `?next=/24b` so members land back where they started.
 */
import type { APIRoute } from "astro";
import { buildAuthorizeUrl } from "../../lib/discord";
import { createOAuthState, setStateCookie } from "../../lib/oauth-state";
import { safeNext } from "../../lib/access";

export const GET: APIRoute = async ({ url, cookies, redirect }) => {
  const next = safeNext(url.searchParams.get("next"));
  const state = createOAuthState(next);
  setStateCookie(cookies, state, { url });

  try {
    return redirect(buildAuthorizeUrl(state.nonce), 302);
  } catch (error) {
    console.error("[auth] unable to build the Discord authorise URL", error);
    return redirect("/access-denied?reason=oauth_failed", 302);
  }
};
