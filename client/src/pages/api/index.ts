/**
 * Step 2 of the Discord login: the OAuth callback.
 *
 * This route is registered in the Discord developer portal as the redirect URI
 * (`.../api`), so keep the path stable or update both places together.
 *
 * Responsibilities:
 *  1. Validate `state` (login CSRF protection).
 *  2. Exchange the authorisation code for an access token.
 *  3. Read the user's roles in the configured guild.
 *  4. Mint a signed, HttpOnly session cookie.
 *  5. Send entitled members to their destination, everyone else to a page that
 *     explains exactly why access was denied.
 */
import type { APIRoute } from "astro";
import {
  avatarUrl,
  displayNameOf,
  exchangeCode,
  fetchGuildMember,
  fetchUser,
  hasAnyRole,
} from "../../lib/discord";
import { discordConfig, courseRoleIds } from "../../lib/config";
import { accessDeniedUrl, landingPath } from "../../lib/access";
import { courses } from "../../data/courses";
import {
  clearStateCookie,
  nonceMatches,
  readStateCookie,
} from "../../lib/oauth-state";
import { createSession, setSessionCookie } from "../../lib/session";
import { getProfile } from "../../lib/store";

export const GET: APIRoute = async ({ url, cookies, redirect }) => {
  const code = url.searchParams.get("code");
  const stateParam = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");
  const stored = readStateCookie(cookies);
  clearStateCookie(cookies, { url });

  if (oauthError) {
    return redirect(accessDeniedUrl("oauth_denied", stored?.next), 302);
  }

  if (
    !code ||
    !stateParam ||
    !stored ||
    !nonceMatches(stateParam, stored.nonce)
  ) {
    console.warn("[auth] rejected callback: state missing or mismatched");
    return redirect(accessDeniedUrl("state_mismatch", stored?.next), 302);
  }

  try {
    const tokens = await exchangeCode(code);

    const [user, member] = await Promise.all([
      fetchUser(tokens.access_token),
      fetchGuildMember(tokens.access_token),
    ]);

    const roles = member?.roles ?? [];
    const admin = hasAnyRole(roles, discordConfig.adminRoleIds());

    // Each course has its own Discord role, so entitlement is per course.
    const ownedCourses = courses
      .filter((course) => {
        const required = courseRoleIds(course.slug);
        return (
          admin ||
          (required.length > 0 && required.some((role) => roles.includes(role)))
        );
      })
      .map((course) => course.slug);

    const isMember = ownedCourses.length > 0;

    const profile = await getProfile(user.id);

    const session = createSession({
      sub: user.id,
      username: user.username,
      displayName: displayNameOf(user),
      avatar: avatarUrl(user),
      email: user.email ?? null,
      guildId: discordConfig.guildId(),
      roles,
      member: isMember,
      admin,
      courses: ownedCourses,
      certificateName: profile?.certificateName ?? null,
      progress: profile?.progress ?? {},
    });

    await setSessionCookie(cookies, session, { url });

    if (!isMember) {
      const reason = member === null ? "not_in_guild" : "missing_role";
      return redirect(accessDeniedUrl(reason, stored.next), 302);
    }

    return redirect(stored.next ?? landingPath(session), 302);
  } catch (error) {
    console.error("[auth] Discord callback failed", error);
    return redirect(accessDeniedUrl("oauth_failed", stored.next), 302);
  }
};
