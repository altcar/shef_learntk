/**
 * Central runtime configuration.
 *
 * Values are read from the real process environment first (this is what Vercel
 * injects at runtime) and fall back to Vite's `import.meta.env` (what `.env`
 * files provide during `astro dev` / `astro build`).
 */

const runtimeEnv =
  (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process?.env ?? {};

function fromImportMeta(name: string): string | undefined {
  const env = import.meta.env as unknown as Record<string, unknown>;
  const value = env?.[name];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/** Read an optional environment variable. */
export function readEnv(name: string): string | undefined {
  const fromProcess = runtimeEnv[name];
  if (typeof fromProcess === "string" && fromProcess.length > 0) {
    return fromProcess;
  }
  return fromImportMeta(name);
}

/** Read a required environment variable, failing loudly when it is missing. */
export function requireEnv(name: string): string {
  const value = readEnv(name);
  if (!value) {
    throw new Error(
      `Missing required environment variable "${name}". See .env.example.`,
    );
  }
  return value;
}

function listEnv(name: string, fallback: string[]): string[] {
  const raw = readEnv(name);
  if (!raw) return fallback;
  const parsed = raw
    .split(/[\s,]+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
  return parsed.length > 0 ? parsed : fallback;
}

/**
 * Discord guild that owns course membership.
 * Override with DISCORD_GUILD_ID.
 */
const DEFAULT_GUILD_ID = "746789586914639933";

/**
 * Roles that grant access to the paid course content.
 * Override with DISCORD_MEMBER_ROLE_IDS (comma separated).
 */
const DEFAULT_MEMBER_ROLE_IDS = ["1059574449025843353"];

/** Roles that grant instructor/admin access. */
const DEFAULT_ADMIN_ROLE_IDS: string[] = [];

export const discordConfig = {
  clientId: () => requireEnv("DISCORD_CLIENT_ID"),
  clientSecret: () => requireEnv("DISCORD_CLIENT_SECRET"),
  /**
   * Must match the redirect URI registered in the Discord developer portal
   * character for character.
   */
  redirectUri: () =>
    readEnv("DISCORD_REDIRECT_URI") ??
    readEnv("VITE_DISCORD_REDIRECT_URI") ??
    `${siteUrl()}/api`,
  guildId: () => readEnv("DISCORD_GUILD_ID") ?? DEFAULT_GUILD_ID,
  memberRoleIds: () =>
    listEnv("DISCORD_MEMBER_ROLE_IDS", DEFAULT_MEMBER_ROLE_IDS),
  adminRoleIds: () => listEnv("DISCORD_ADMIN_ROLE_IDS", DEFAULT_ADMIN_ROLE_IDS),
};

/** Absolute origin of the site, used for redirects and Open Graph tags. */
export function siteUrl(): string {
  const explicit = readEnv("SITE_URL") ?? readEnv("VITE_BASE_URL");
  if (explicit) return explicit.replace(/\/+$/, "");
  const vercel = readEnv("VERCEL_PROJECT_PRODUCTION_URL");
  if (vercel) return `https://${vercel.replace(/\/+$/, "")}`;
  return "https://learntk.vercel.app";
}

/** Public Firestore configuration, used for optional progress persistence. */
export function firestoreConfig(): {
  projectId: string;
  apiKey: string;
} | null {
  const raw = readEnv("FIREBASE");
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { projectId?: string; apiKey?: string };
    if (!parsed.projectId || !parsed.apiKey) return null;
    return { projectId: parsed.projectId, apiKey: parsed.apiKey };
  } catch {
    return null;
  }
}

/** Where unauthenticated members should be sent to join the Discord server. */
export function discordInviteUrl(): string {
  return readEnv("DISCORD_INVITE_URL") ?? "https://discord.gg/";
}
