import { createHmac, timingSafeEqual } from "node:crypto";

type OAuthStatePayload = {
  userId: string;
  redirectTo: string;
};

function base64UrlEncode(value: string | Buffer): string {
  const buffer = typeof value === "string" ? Buffer.from(value, "utf8") : value;
  return buffer
    .toString("base64")
    .replace(/=+$/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64UrlDecode(value: string): string {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const padLength = padded.length % 4 === 0 ? 0 : 4 - (padded.length % 4);
  const normalized = padded + "=".repeat(padLength);
  return Buffer.from(normalized, "base64").toString("utf8");
}

function getStateSecret(): string {
  const secret = process.env.OAUTH_STATE_SECRET;
  if (!secret) {
    throw new Error("Missing env OAUTH_STATE_SECRET for OAuth state signing.");
  }
  return secret;
}

export function signOAuthState(payload: OAuthStatePayload): string {
  const secret = getStateSecret();
  const json = JSON.stringify(payload);
  const encoded = base64UrlEncode(json);
  const signature = base64UrlEncode(createHmac("sha256", secret).update(encoded).digest());
  return `${encoded}.${signature}`;
}

export function verifyOAuthState(state: string): OAuthStatePayload | null {
  const secret = getStateSecret();
  const [encoded, signature] = state.split(".");
  if (!encoded || !signature) return null;

  const expected = base64UrlEncode(createHmac("sha256", secret).update(encoded).digest());
  const expectedBuf = Buffer.from(expected);
  const signatureBuf = Buffer.from(signature);
  if (expectedBuf.length !== signatureBuf.length || !timingSafeEqual(expectedBuf, signatureBuf)) {
    return null;
  }

  try {
    const decoded = base64UrlDecode(encoded);
    const payload = JSON.parse(decoded) as Partial<OAuthStatePayload>;
    if (!payload.userId || !payload.redirectTo) return null;
    return { userId: payload.userId, redirectTo: payload.redirectTo };
  } catch {
    return null;
  }
}
