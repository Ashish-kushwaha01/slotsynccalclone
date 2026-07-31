import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const GOOGLE_AUTH_BASE = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";
const GOOGLE_FREEBUSY_URL = "https://www.googleapis.com/calendar/v3/freeBusy";

const CALENDAR_SCOPES = [
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/userinfo.email",
];

export function buildGoogleAuthUrl(params: {
  clientId: string;
  redirectUri: string;
  state: string;
}): string {
  const search = new URLSearchParams({
    client_id: params.clientId,
    redirect_uri: params.redirectUri,
    response_type: "code",
    scope: CALENDAR_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state: params.state,
  });

  return `${GOOGLE_AUTH_BASE}?${search.toString()}`;
}

export async function exchangeGoogleCode(params: {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  code: string;
}) {
  const body = new URLSearchParams({
    client_id: params.clientId,
    client_secret: params.clientSecret,
    redirect_uri: params.redirectUri,
    grant_type: "authorization_code",
    code: params.code,
  });

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google token exchange failed: ${errorText}`);
  }

  return response.json() as Promise<{
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope: string;
    token_type: string;
    id_token?: string;
  }>;
}

export async function fetchGoogleEmail(accessToken: string): Promise<string | null> {
  const response = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google userinfo failed: ${errorText}`);
  }

  const payload = (await response.json()) as { email?: string | null };
  return payload.email ?? null;
}

export function encryptRefreshToken(refreshToken: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(refreshToken, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    "v1",
    iv.toString("base64"),
    tag.toString("base64"),
    ciphertext.toString("base64"),
  ].join(":");
}

export function decryptRefreshToken(payload: string): string {
  const [version, ivB64, tagB64, cipherB64] = payload.split(":");
  if (version !== "v1" || !ivB64 || !tagB64 || !cipherB64) {
    throw new Error("Unsupported token payload format.");
  }

  const key = getEncryptionKey();
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const ciphertext = Buffer.from(cipherB64, "base64");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plain.toString("utf8");
}

export async function getAccessTokenFromRefresh(params: {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}): Promise<string> {
  const body = new URLSearchParams({
    client_id: params.clientId,
    client_secret: params.clientSecret,
    refresh_token: params.refreshToken,
    grant_type: "refresh_token",
  });

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google refresh token exchange failed: ${errorText}`);
  }

  const payload = (await response.json()) as { access_token?: string };
  if (!payload.access_token) {
    throw new Error("Missing access token from Google refresh token exchange.");
  }
  return payload.access_token;
}

export async function fetchGoogleBusyIntervals(params: {
  accessToken: string;
  timeMinIso: string;
  timeMaxIso: string;
  calendarId?: string;
}): Promise<Array<{ start: string; end: string }>> {
  const body = {
    timeMin: params.timeMinIso,
    timeMax: params.timeMaxIso,
    items: [{ id: params.calendarId ?? "primary" }],
  };

  const response = await fetch(GOOGLE_FREEBUSY_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google freebusy failed: ${errorText}`);
  }

  const payload = (await response.json()) as {
    calendars?: Record<string, { busy?: Array<{ start: string; end: string }> }>;
  };

  const calendar = payload.calendars?.[params.calendarId ?? "primary"];
  return calendar?.busy ?? [];
}

export async function createGoogleCalendarEvent(params: {
  accessToken: string;
  calendarId?: string;
  summary: string;
  description?: string;
  startIso: string;
  endIso: string;
  timeZone: string;
  createMeet?: boolean;
}): Promise<{ meetingUrl?: string }> {
  const calendarId = encodeURIComponent(params.calendarId ?? "primary");
  const urlBase = `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`;
  const url = params.createMeet ? `${urlBase}?conferenceDataVersion=1` : urlBase;
  const body: Record<string, unknown> = {
    summary: params.summary,
    description: params.description,
    start: { dateTime: params.startIso, timeZone: params.timeZone },
    end: { dateTime: params.endIso, timeZone: params.timeZone },
  };
  if (params.createMeet) {
    body.conferenceData = {
      createRequest: {
        requestId: `meet-${Date.now()}`,
        conferenceSolutionKey: { type: "hangoutsMeet" },
      },
    };
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Google calendar event create failed: ${errorText}`);
  }
  const payload = (await response.json()) as {
    hangoutLink?: string;
    conferenceData?: { entryPoints?: Array<{ entryPointType?: string; uri?: string }> };
  };
  const entryUrl = payload.conferenceData?.entryPoints?.find(
    (entry) => entry.entryPointType === "video",
  )?.uri;
  return { meetingUrl: payload.hangoutLink ?? entryUrl };
}

function getEncryptionKey(): Buffer {
  const raw = process.env.GOOGLE_CALENDAR_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error("Missing env GOOGLE_CALENDAR_ENCRYPTION_KEY for token encryption.");
  }

  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, "hex");
  }

  const base64Decoded = Buffer.from(raw, "base64");
  if (base64Decoded.length === 32) {
    return base64Decoded;
  }

  const utf8 = Buffer.from(raw, "utf8");
  if (utf8.length === 32) {
    return utf8;
  }

  throw new Error(
    "GOOGLE_CALENDAR_ENCRYPTION_KEY must be 32 bytes (raw), 64 hex chars, or base64-encoded 32 bytes.",
  );
}
