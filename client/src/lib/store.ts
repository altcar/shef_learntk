/**
 * Optional learner profile persistence.
 *
 * Uses the Firestore REST API with the project's public web config. Only
 * non-sensitive, per-user documents are touched (display name, certificate
 * name, lesson progress). OAuth refresh tokens are deliberately *never* stored
 * here — that was the previous implementation's biggest security problem.
 *
 * Every call degrades gracefully: if Firestore is unreachable or the security
 * rules reject the request, the site keeps working and only the signed session
 * cookie is used.
 */
import { firestoreConfig } from "./config";

const TIMEOUT_MS = 4000;

export interface LearnerProfile {
  certificateName?: string | null;
  progress?: Record<string, string>;
}

function endpoint(userId: string): string | null {
  const config = firestoreConfig();
  if (!config) return null;
  return `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/(default)/documents/user/${encodeURIComponent(userId)}?key=${config.apiKey}`;
}

interface FirestoreValue {
  stringValue?: string;
  booleanValue?: boolean;
  integerValue?: string;
  timestampValue?: string;
}

interface FirestoreDocument {
  fields?: Record<string, FirestoreValue>;
}

function decodeString(
  fields: Record<string, FirestoreValue> | undefined,
  key: string,
): string | undefined {
  return fields?.[key]?.stringValue;
}

function parseProgress(raw: string | undefined): Record<string, string> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, string>;
    }
  } catch {
    /* ignore malformed progress */
  }
  return {};
}

/** Read a learner profile. Returns `null` when persistence is unavailable. */
export async function getProfile(
  userId: string,
): Promise<LearnerProfile | null> {
  const url = endpoint(userId);
  if (!url) return null;

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (response.status === 404) return { progress: {} };
    if (!response.ok) return null;

    const document = (await response.json()) as FirestoreDocument;
    return {
      certificateName: decodeString(document.fields, "certificate_name") ?? null,
      progress: parseProgress(decodeString(document.fields, "progress")),
    };
  } catch {
    return null;
  }
}

/** Merge a partial profile into the learner document. */
export async function saveProfile(
  userId: string,
  patch: { certificateName?: string; progress?: Record<string, string> },
): Promise<boolean> {
  const base = endpoint(userId);
  if (!base) return false;

  const fields: Record<string, FirestoreValue> = {};
  const masks: string[] = [];

  if (patch.certificateName !== undefined) {
    fields.certificate_name = { stringValue: patch.certificateName };
    masks.push("certificate_name");
  }
  if (patch.progress !== undefined) {
    fields.progress = { stringValue: JSON.stringify(patch.progress) };
    masks.push("progress");
  }
  if (masks.length === 0) return true;

  const params = masks.map((mask) => `updateMask.fieldPaths=${mask}`).join("&");
  const url = `${base}&${params}`;

  try {
    const response = await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fields }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return response.ok;
  } catch {
    return false;
  }
}
