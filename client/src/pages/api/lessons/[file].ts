/**
 * Streams course PDFs to entitled members.
 *
 * The files live in `src/assets/lessons` and are inlined at build time by the
 * `learntk-lesson-assets` Vite plugin. They are deliberately kept out of
 * `public/` so Vercel's static file layer can never serve them unauthenticated.
 */
import type { APIRoute } from "astro";
import { extname, basename } from "node:path";

const CONTENT_TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".pptx":
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

export const GET: APIRoute = async ({ params, locals }) => {
  const session = locals.session;
  if (!session?.member) {
    return new Response("Sign in to download course material.", {
      status: 401,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  const requested = basename(String(params.file ?? ""));
  if (!requested || requested.includes("..")) {
    return new Response("Not found", { status: 404 });
  }

  const { default: lessons } = (await import("virtual:learntk-lessons")) as {
    default: Record<string, string>;
  };

  const encoded = lessons[requested];
  if (!encoded) {
    return new Response("Not found", { status: 404 });
  }

  const bytes = Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0));
  const type = CONTENT_TYPES[extname(requested).toLowerCase()] ?? "application/octet-stream";

  return new Response(bytes, {
    status: 200,
    headers: {
      "Content-Type": type,
      "Content-Length": String(bytes.byteLength),
      "Content-Disposition": `inline; filename="${requested}"`,
      // Private: proxies and the CDN must not cache a member-only document.
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
};
