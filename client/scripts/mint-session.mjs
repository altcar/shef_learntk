// Test helper: mint a signed session cookie using the same algorithm as
// src/lib/session.ts so the protected routes can be verified locally.
//
// LOCAL DEVELOPMENT ONLY. It signs a session with whatever credentials are in
// .env.local, which means anyone holding a client secret can impersonate any
// Discord id. Never run this against production credentials and never commit
// the resulting cookie.
import fs from "node:fs";
import path from "node:path";

const envPath = path.join(process.cwd(), ".env.local");
const env = {};
for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const match = line.match(/^([A-Z0-9_]+)="?([^"]*)"?$/);
  if (match) env[match[1]] = match[2];
}

const secret = `learntk-session-v1:${env.DISCORD_CLIENT_SECRET}`;
const key = await crypto.subtle.importKey(
  "raw",
  new TextEncoder().encode(secret),
  { name: "HMAC", hash: "SHA-256" },
  false,
  ["sign"],
);

const b64 = (bytes) =>
  Buffer.from(bytes).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const mode = process.argv[2] ?? "member";
const now = Date.now();
const payload = {
  v: 1,
  sub: "905931663937253376",
  username: "testlearner",
  displayName: "Test Learner",
  avatar: null,
  email: "test@example.com",
  guildId: "746789586914933",
  roles: mode === "member" ? ["1059574449025843353"] : [],
  member: mode === "member",
  admin: false,
  certificateName: "Test Learner",
  iat: now,
  exp: mode === "expired" ? now - 1000 : now + 3600_000,
};

const body = b64(new TextEncoder().encode(JSON.stringify(payload)));
const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
const token = `${body}.${b64(new Uint8Array(sig))}`;

if (mode === "tampered") {
  const parts = token.split(".");
  const decoded = JSON.parse(Buffer.from(parts[0], "base64").toString());
  decoded.member = true;
  decoded.certificateName = "Hacker";
  const forced = b64(new TextEncoder().encode(JSON.stringify(decoded)));
  console.log(`${forced}.${parts[1]}`);
} else {
  console.log(token);
}
