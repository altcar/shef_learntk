/**
 * Lesson progress.
 *
 * `POST /api/progress` with `{ "lessonId": "24b-w1", "done": true }`.
 *
 * Progress lives in the signed session cookie: it cannot be forged, it needs no
 * database, and it is small enough for the 4 KB cookie budget. A best-effort
 * copy is mirrored to Firestore so progress can follow a learner across devices
 * once the project's security rules allow it.
 */
import type { APIRoute } from "astro";
import { allLessonIds } from "../../data/courses";
import { setSessionCookie } from "../../lib/session";
import { saveProfile } from "../../lib/store";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });

export const GET: APIRoute = async ({ locals }) => {
  const session = locals.session;
  if (!session?.member) return json({ error: "unauthorised" }, 401);
  return json({ progress: session.progress ?? {} });
};

export const POST: APIRoute = async ({ locals, request, cookies, url }) => {
  const session = locals.session;
  if (!session?.member) return json({ error: "unauthorised" }, 401);

  let payload: { lessonId?: unknown; done?: unknown };
  try {
    payload = await request.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const lessonId = typeof payload.lessonId === "string" ? payload.lessonId : "";
  if (!allLessonIds().has(lessonId)) {
    return json({ error: "unknown_lesson" }, 400);
  }

  const progress = { ...(session.progress ?? {}) };
  if (payload.done !== false) progress[lessonId] = "done";
  else delete progress[lessonId];

  await setSessionCookie(cookies, { ...session, progress }, { url });

  // Best effort; never block the response on storage.
  void saveProfile(session.sub, { progress }).catch(() => false);

  return json({ progress });
};
