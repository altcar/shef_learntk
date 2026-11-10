/**
 * Global request middleware.
 *
 * This is the single place that decides whether a request may reach protected
 * content. Pages never have to repeat the posture check, which is what went
 * wrong before: `/24b` was a static Starlight route and was therefore readable
 * by anyone, even though `/course` checked a cookie.
 */
import { defineMiddleware } from "astro:middleware";
import { accessDeniedUrl, isApiPath, isAssetPath, isProtectedPath, loginUrl } from "./lib/access";
import { readSession } from "./lib/session";
/**
 * Courses each have their own Discord role, so buying one course must not
 * unlock the other. Anything not listed here only needs *a* course role.
 *
 * The session already carries the authoritative list of owned courses (computed
 * at sign-in from `courseRoleIds`), so we trust that rather than re-deriving it
 * from the role list on every request.
 */
const COURSE_ROUTES: Array<{ prefix: string; slug: string }> = [
  { prefix: "/24b", slug: "24b" },
  { prefix: "/week1", slug: "24b" },
  { prefix: "/advanced", slug: "advanced" },
];

function courseFor(path: string) {
  return COURSE_ROUTES.find(
    (route) => path === route.prefix || path.startsWith(`${route.prefix}/`),
  );
}

export const onRequest = defineMiddleware(async (context, next) => {
  const url = new URL(context.request.url);

  const session = await readSession(context.cookies);
  context.locals.session = session;
  context.locals.user =
    session && session.member
      ? {
          id: session.sub,
          username: session.username,
          displayName: session.displayName,
          avatar: session.avatar,
          email: session.email,
          roles: session.roles,
          admin: session.admin,
          courses: session.courses,
          certificateName: session.certificateName,
        }
      : null;

  const path = url.pathname;
  if (isApiPath(path) || isAssetPath(path) || !isProtectedPath(path)) {
    return next();
  }

  const target = `${path}${url.search}`;

  if (!session) {
    return context.redirect(loginUrl(target), 302);
  }

  // Sessions are signed and expiry-checked when parsed, so reaching this point
  // means the member is authenticated. The role check decides entitlement.
  const course = courseFor(path);
  if (course) {
    const owns = session.courses.includes(course.slug);
    if (!owns) {
      return context.redirect(accessDeniedUrl("missing_role", target), 302);
    }
    return next();
  }

  if (!session.member) {
    return context.redirect(accessDeniedUrl("missing_role", target), 302);
  }

  return next();
});
