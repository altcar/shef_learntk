# Contributing

Thanks for helping out. This project is a small Astro app with a security model
that is easy to break by accident — please read the notes below before opening a
pull request.

## Getting started

```bash
cd client
npm install
cp .env.example .env.local   # fill in Discord credentials
npm run dev
```

Before pushing:

```bash
npm run build    # astro check + astro build
```

If you touch `/buy` or anything containing an embedded checkout, check the print
layout too — checkout forms are hidden in `@media print`, and a regression there
is easy to miss:

```bash
node scripts/print-audit.mjs https://learntk.vercel.app/buy
```

## Ground rules for auth changes

- **Never trust a cookie value without verifying its signature.** Use
  `readSession()` from `src/lib/session.ts`.
- **Never add a route that reads protected content without passing through
  `src/middleware.ts`.** If a page must be public, it must not import paid
  material.
- **Never put course content in `client/public/`.** Static files are served
  before Astro and its middleware run.
- **Never call `Astro.redirect()` from inside a `try`/`catch` and ignore the
  result.** Return it.
- **Never construct a redirect target from user input** without
  `safeNext()` from `src/lib/access.ts`.
- **Never store OAuth refresh tokens** in a store a browser can read.
- Prefer `output: 'server'` routes for anything behind a role check. If you set
  `prerender = true`, middleware will not run.

## Style

- TypeScript everywhere, no `any` in `src/lib/`.
- Keep `src/lib/` free of Astro component imports so it stays unit-testable.
- Match the existing file layout and naming.
- Plain CSS/Tailwind utility classes; no new UI framework.

## Pull requests

1. Describe the behaviour before and after.
2. Include the commands you ran to verify it (`npm run build`, curl checks).
3. For auth changes, include a short note on the threat you considered.

## Reporting security issues

Please do not open a public issue for a vulnerability. Email
<admin@shalev.eu.org> with the details and a reproduction.
