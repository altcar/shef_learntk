/**
 * Machine readable session state, useful for client-side widgets and tests.
 */
import type { APIRoute } from "astro";

export const GET: APIRoute = async ({ locals }) => {
  const session = locals.session;
  const body = session
    ? {
        authenticated: true,
        authorised: session.member,
        admin: session.admin,
        expiresAt: new Date(session.exp).toISOString(),
        user: {
          id: session.sub,
          username: session.username,
          displayName: session.displayName,
          avatar: session.avatar,
          certificateName: session.certificateName,
        },
      }
    : { authenticated: false, authorised: false, admin: false, user: null };

  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
};
