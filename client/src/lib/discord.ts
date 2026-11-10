/**
 * Minimal Discord OAuth2 + guild membership client.
 *
 * Docs:
 *  - https://discord.com/developers/docs/topics/oauth2
 *  - https://discord.com/developers/docs/resources/user#get-current-user-guild-member
 */
import { discordConfig } from "./config";

const API_BASE = "https://discord.com/api/v10";

/**
 * `guilds.members.read` is what lets us read the *current user's* membership —
 * and therefore their roles — in a specific server without a bot token.
 */
export const OAUTH_SCOPES = [
  "identify",
  "email",
  "guilds.members.read",
] as const;

export interface DiscordUser {
  id: string;
  username: string;
  global_name?: string | null;
  discriminator?: string;
  avatar?: string | null;
  email?: string | null;
}

export interface DiscordGuildMember {
  roles: string[];
  nick?: string | null;
  joined_at?: string;
}

export interface DiscordTokens {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
}

export class DiscordError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: string,
  ) {
    super(message);
    this.name = "DiscordError";
  }
}

/** Build the consent screen URL. */
export function buildAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: discordConfig.clientId(),
    response_type: "code",
    redirect_uri: discordConfig.redirectUri(),
    scope: OAUTH_SCOPES.join(" "),
    state,
  });
  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

async function readError(response: Response): Promise<DiscordError> {
  const body = await response.text().catch(() => "");
  return new DiscordError(
    `Discord request failed (${response.status})`,
    response.status,
    body,
  );
}

export async function exchangeCode(code: string): Promise<DiscordTokens> {
  const response = await fetch(`${API_BASE}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: discordConfig.clientId(),
      client_secret: discordConfig.clientSecret(),
      grant_type: "authorization_code",
      code,
      redirect_uri: discordConfig.redirectUri(),
    }).toString(),
  });

  if (!response.ok) throw await readError(response);
  return (await response.json()) as DiscordTokens;
}

export async function fetchUser(accessToken: string): Promise<DiscordUser> {
  const response = await fetch(`${API_BASE}/users/@me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw await readError(response);
  return (await response.json()) as DiscordUser;
}

/**
 * Fetch the current user's membership in a guild.
 * Returns `null` when the user is not a member of that guild (Discord 404).
 */
export async function fetchGuildMember(
  accessToken: string,
  guildId: string = discordConfig.guildId(),
): Promise<DiscordGuildMember | null> {
  const response = await fetch(
    `${API_BASE}/users/@me/guilds/${guildId}/member`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  if (response.status === 404) return null;
  if (response.status === 403) {
    // The user revoked the scope or has not accepted the new authorisation.
    throw new DiscordError(
      "Missing guilds.members.read scope. Sign in again to grant it.",
      403,
    );
  }
  if (!response.ok) throw await readError(response);

  const member = (await response.json()) as DiscordGuildMember;
  return { ...member, roles: Array.isArray(member.roles) ? member.roles : [] };
}

export function hasAnyRole(
  memberRoles: readonly string[],
  requiredRoles: readonly string[],
): boolean {
  if (requiredRoles.length === 0) return false;
  return requiredRoles.some((role) => memberRoles.includes(role));
}

export function avatarUrl(user: DiscordUser): string | null {
  if (!user.avatar) return null;
  const extension = user.avatar.startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${extension}?size=128`;
}

export function displayNameOf(user: DiscordUser): string {
  return user.global_name || user.username;
}
