# learntk — an open-source course platform

A small, open-source learning platform for cohort-based courses. Learners sign in
with Discord, access is decided by a role in your community server, and lessons
render as a documentation site.

- **Live site:** <https://learntk.vercel.app>
- **Course:** <https://learntk.vercel.app/24b>
- **Stack:** Astro 5 (SSR) · Starlight · Tailwind · Vercel · Discord OAuth2

The goal is Teachable-style functionality without a SaaS dependency: public sales
pages, gated curriculum, learner accounts, progress and certificates — all
driven by a Discord community you already run.

---

## How access control works

This is the part that used to be broken, so it is worth reading first.

```
 ┌──────────────┐   1. /api/login          ┌─────────────────────┐
 │   Browser    │ ───────────────────────► │  OAuth start        │
 │              │                          │  state cookie       │
 │              │ ◄─── 302 discord.com ─── │                     │
 └──────┬───────┘                          └─────────────────────┘
        │ 2. user approves scopes:
        │    identify, email, guilds.members.read
        ▼
 ┌──────────────┐   3. /api?code=…&state=… ┌─────────────────────┐
 │   Discord    │ ───────────────────────► │  Callback           │
 └──────────────┘                          │  · verify state     │
                                           │  · exchange code    │
                                           │  · read guild roles │
                                           │  · mint session     │
                                           └──────────┬──────────┘
                                                      │ 4. signed HttpOnly cookie
                                                      ▼
                                           ┌─────────────────────┐
                                           │  src/middleware.ts  │
                                           │  gate every request │
                                           └─────────────────────┘
```

1. **`/api/login`** creates a random `state` nonce, stores it in a short-lived
   HttpOnly cookie, and redirects to Discord.
2. Discord asks the user to approve `identify email guilds.members.read`.
   `guilds.members.read` lets us read *the current user's* membership — and
   therefore their roles — in one specific server, with no bot token.
3. **`/api`** (the registered redirect URI) verifies `state`, exchanges the code,
   and calls `GET /users/@me/guilds/{guild}/member`.
4. A **signed** session is issued. The cookie is `HttpOnly`, `SameSite=Lax`, and
   HMAC-SHA256 signed, so it cannot be read or edited by JavaScript or by the
   user.

`src/middleware.ts` then runs on every request and gates `/24b`, `/course`,
`/welcome` and friends. Pages do not contain their own auth checks.

### Why the old flow failed

| Symptom | Root cause |
| --- | --- |
| Signing in bounced back to the home page | The callback awaited a Firestore read that returned `403`, the error was swallowed, and `redirect` stayed `""`. |
| Anyone could read the course | `/24b` was a **prerendered** Starlight route. Static HTML never reaches SSR, so middleware could not protect it. |
| Anyone could claim a membership | The session was a plain JSON cookie (`{"subscribed":true}`), and `/api/reverify?code=<any discord id>` minted a session for **any** user id. |
| Lesson PDFs were public | They lived in `public/Lesson/`, so Vercel served them before Astro ran. |
| Members with the role still saw nothing | `login()` was called without `await`, so the profile was read before it was written. |

All five are fixed. The forgeable cookie and the `/api/reverify` IDOR are gone,
not mitigated.

### Security properties

- Sessions are HMAC-SHA256 signed and expiry-checked on every request.
- `state` prevents login CSRF.
- Access is decided per request from the signed session, never from client input.
- Lesson PDFs are inlined into a server-only module and streamed by
  `/api/lessons/:file` after the session check — they are not static files.
- No OAuth refresh tokens are stored anywhere. (The previous build wrote them to
  a client-readable Firestore collection.)
- `next=` redirects are validated to be same-site relative paths, so the login
  endpoint cannot be used as an open redirect.

---

## Local development

```bash
cd client
npm install
cp .env.example .env.local   # then fill in the values
npm run dev                  # http://localhost:4321
```

`npm run build` runs `astro check` followed by `astro build`.

> **Note on installs:** npm may block postinstall scripts. This repo declares the
> ones it needs under `allowScripts` in `client/package.json` (`esbuild`,
> `sharp`, `workerd`).

### Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `DISCORD_CLIENT_ID` | yes | Discord application id |
| `DISCORD_CLIENT_SECRET` | yes | Discord application secret |
| `DISCORD_REDIRECT_URI` | yes | Must match the portal exactly |
| `SESSION_SECRET` | recommended | Cookie signing key |
| `DISCORD_GUILD_ID` | no | Server that owns membership (defaults to `746789586914639933`) |
| `DISCORD_MEMBER_ROLE_IDS` | no | Comma separated role ids that unlock the course |
| `DISCORD_ROLE_24B` | no | Role ids for the beginner course (falls back to `DISCORD_MEMBER_ROLE_IDS`) |
| `DISCORD_ROLE_ADVANCED` | no | Role ids for the advanced course (empty = nobody owns it yet) |
| `DISCORD_ADMIN_ROLE_IDS` | no | Comma separated instructor role ids |
| `DISCORD_INVITE_URL` | no | Where "Join the community server" points |
| `SITE_URL` | no | Canonical origin |
| `FIREBASE` | no | Public Firebase config JSON, for optional progress mirroring |

### Discord application setup

1. <https://discord.com/developers/applications> → **New Application**.
2. **OAuth2 → Redirects** → add `https://your-domain/api` (and
   `http://localhost:4321/api` for local work).
3. Copy the client id and secret into your environment.
4. Make sure the roles listed in `DISCORD_MEMBER_ROLE_IDS` exist in your server
   and that paying members actually receive them.

### One role per course

Entitlement is per course, so buying one course does not unlock the other. Each
course reads its own role list:

| Course | Environment variable | Default |
| --- | --- | --- |
| Python Foundations (`/24b`) | `DISCORD_ROLE_24B` | `DISCORD_MEMBER_ROLE_IDS` |
| Python in Practice (`/advanced`) | `DISCORD_ROLE_ADVANCED` | none — nobody owns it |

Create a Discord role per course, put its id in the matching variable, and
assign members that role after their purchase. The owned courses are baked into
the signed session at sign-in, which is what `/buy` uses to show "already owned"
instead of a checkout button.

### Testing auth without a Discord account

`client/scripts/mint-session.mjs` signs a session with the same code the app
uses, which is handy for local checks:

```bash
cd client
COOKIE=$(node scripts/mint-session.mjs member)   # or: noRole | expired | tampered
curl -i -H "Cookie: learntk_session=$COOKIE" http://localhost:4321/24b
```

It reads `DISCORD_CLIENT_SECRET` from `.env.local`. **Never run it against
production credentials.**

---

## Authoring content

Course pages are Markdown in `client/src/content/docs/<course>/`:

```
client/src/content/docs/
├── 24b/            # Python Foundations  -> /24b
│   ├── index.mdx
│   ├── Week1.md
│   └── Week7.md
└── advanced/       # Python in Practice  -> /advanced
    ├── index.md
    ├── oop.md
    ├── excel.md
    ├── matplotlib.md
    ├── apps.md
    └── ai.md
```

The Starlight sidebar groups these automatically (see `sidebar` in
`astro.config.mjs`); each advanced page sets `sidebar: { order: N }` so the
modules stay in teaching order.

To add a week:

1. Add `Week8.md` to the folder.
2. Add one entry to the matching course in `client/src/data/courses.ts`.

The dashboard, progress bar, purchase page and "Continue" button all derive from
`src/data/courses.ts`, so nothing else needs touching. A new course also needs
its URL prefix added to `COURSE_ROUTES` in `src/middleware.ts` and to
`PROTECTED_PREFIXES` in `src/lib/access.ts`.

Put downloadable material in `client/src/assets/lessons/` and link it as
`/api/lessons/<file>`. Anything in `client/public/` is served to the public
without an auth check — do not put paid content there.

---

## Deployment

The site is deployed on Vercel.

```bash
cd client
vercel link
vercel env pull .env.local        # optional: copy production config locally
vercel deploy                     # preview
vercel deploy --prod              # production
```

If you change the callback path, update **both** `DISCORD_REDIRECT_URI` and the
Discord developer portal, or the token exchange will fail with
`invalid_grant`.

### Behind a proxy: `security.allowedDomains`

`astro.config.mjs` sets `security.allowedDomains` to the site hostname, the
`**.vercel.app` wildcard (preview deployments) and `localhost`.

This is not optional. Astro only trusts the `Host` / `X-Forwarded-*` headers for
domains listed there; with the default empty list the request URL becomes
`https://localhost`, so `Astro.url.origin` is wrong and Astro's built-in CSRF
check rejects every same-origin form POST with:

```
Cross-site POST form submissions are forbidden
```

If you deploy on a different domain, either set `SITE_URL` (the list is derived
from it) or add your hostname to `allowedDomains()` in `astro.config.mjs`.


---

## Teachable parity

| Capability | Status |
| --- | --- |
| Public course landing pages | ✅ `/` and `/buy` |
| Discord SSO with role-based entitlement | ✅ per course |
| Gated curriculum | ✅ `/24b` and `/advanced` |
| Beginner course (7 weeks) | ✅ |
| Advanced course (5 modules: OOP, Excel, matplotlib, apps, AI) | ✅ |
| Learner dashboard | ✅ `/course` |
| "Already owned" state on the purchase page | ✅ |
| Lesson progress | ✅ signed session + optional Firestore mirror |
| Certificate name / profile | ✅ `/welcome` |
| Certificate issuing | 🚧 scaffolded in `src/data/courses.ts` |
| Per-lesson comments / Q&A | 🚧 next up |
| Coupons, bundles, upsells | 🚧 PayPal links exist on `/buy` |
| Instructor analytics | 🚧 |
| Webhooks for purchases | 🚧 |

Progress currently lives in the session cookie. That means it is tamper-proof
and needs no database, but it only survives as long as the session (7 days) and
does not follow the learner between browsers. The Firestore mirror in
`src/lib/store.ts` upgrades this transparently once the project's security rules
are configured; a Cloudflare D1 adapter is the other obvious target.

---

## Contributing

Issues and pull requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)
