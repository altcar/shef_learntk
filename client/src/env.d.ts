/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

declare namespace App {
  interface Locals {
    /** Verified session, or `null` for anonymous visitors. */
    session: import("./lib/session").SessionPayload | null;
    /** Convenience view of the session for authenticated members. */
    user: import("./lib/access").SessionUser | null;
  }
}

interface ImportMetaEnv {
  /** Public Firebase web config, JSON encoded. */
  readonly FIREBASE?: string;
  readonly DISCORD_CLIENT_ID?: string;
  readonly DISCORD_CLIENT_SECRET?: string;
  readonly DISCORD_REDIRECT_URI?: string;
  readonly DISCORD_GUILD_ID?: string;
  readonly DISCORD_MEMBER_ROLE_IDS?: string;
  readonly DISCORD_ADMIN_ROLE_IDS?: string;
  readonly DISCORD_INVITE_URL?: string;
  readonly SESSION_SECRET?: string;
  readonly SITE_URL?: string;
  readonly VITE_BASE_URL?: string;
  readonly VITE_DISCORD_REDIRECT_URI?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module "virtual:learntk-lessons" {
  const lessons: Record<string, string>;
  export default lessons;
}
