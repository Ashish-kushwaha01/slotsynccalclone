import { createHmac, timingSafeEqual } from "node:crypto";

const rateBuckets = new Map<string, { count: number; resetAt: number }>();

export function verifyWebhookSignature(params: {
  request: Request;
  bodyText: string;
  secret: string;
  toleranceMs?: number;
}): { ok: true } | { ok: false; error: string } {
  const timestamp = params.request.headers.get("x-valence-timestamp");
  const signature = params.request.headers.get("x-valence-signature");
  if (!timestamp || !signature) {
    return { ok: false, error: "missing_signature" };
  }

  const ts = Number(timestamp);
  if (!Number.isFinite(ts)) {
    return { ok: false, error: "invalid_timestamp" };
  }

  const toleranceMs = params.toleranceMs ?? 5 * 60 * 1000;
  const delta = Math.abs(Date.now() - ts);
  if (delta > toleranceMs) {
    return { ok: false, error: "timestamp_out_of_range" };
  }

  const base = `${timestamp}.${params.bodyText}`;
  const expected = createHmac("sha256", params.secret).update(base).digest("hex");

  if (expected.length !== signature.length) {
    return { ok: false, error: "signature_mismatch" };
  }

  const expectedBuf = Buffer.from(expected, "utf8");
  const sigBuf = Buffer.from(signature, "utf8");
  if (!timingSafeEqual(expectedBuf, sigBuf)) {
    return { ok: false, error: "signature_mismatch" };
  }

  return { ok: true };
}

export function checkRateLimit(params: {
  key: string;
  limit: number;
  windowMs: number;
}): { ok: true } | { ok: false; error: string; retryAfterMs: number } {
  const now = Date.now();
  const entry = rateBuckets.get(params.key);
  if (!entry || entry.resetAt <= now) {
    rateBuckets.set(params.key, { count: 1, resetAt: now + params.windowMs });
    return { ok: true };
  }

  if (entry.count >= params.limit) {
    return { ok: false, error: "rate_limited", retryAfterMs: entry.resetAt - now };
  }

  entry.count += 1;
  return { ok: true };
}

function base64UrlDecode(input: string): string {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? padded : padded + "=".repeat(4 - (padded.length % 4));
  return Buffer.from(pad, "base64").toString("utf8");
}

function base64UrlEncode(input: Buffer): string {
  return input
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

export function verifyJwtHs256(params: {
  token: string;
  secret: string;
  clockSkewSec?: number;
}): { ok: true; payload: Record<string, unknown> } | { ok: false; error: string } {
  const parts = params.token.split(".");
  if (parts.length !== 3) return { ok: false, error: "invalid_token" };

  const [headerB64, payloadB64, signatureB64] = parts;
  let header: { alg?: string };
  let payload: Record<string, unknown>;

  try {
    header = JSON.parse(base64UrlDecode(headerB64));
    payload = JSON.parse(base64UrlDecode(payloadB64));
  } catch {
    return { ok: false, error: "invalid_token" };
  }

  if (header.alg !== "HS256") {
    return { ok: false, error: "unsupported_alg" };
  }

  const data = `${headerB64}.${payloadB64}`;
  const expected = createHmac("sha256", params.secret).update(data).digest();
  const actual = Buffer.from(signatureB64.replace(/-/g, "+").replace(/_/g, "/"), "base64");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    return { ok: false, error: "signature_mismatch" };
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const skew = params.clockSkewSec ?? 60;
  const exp = typeof payload.exp === "number" ? payload.exp : null;
  const nbf = typeof payload.nbf === "number" ? payload.nbf : null;

  if (exp !== null && nowSec > exp + skew) {
    return { ok: false, error: "token_expired" };
  }
  if (nbf !== null && nowSec + skew < nbf) {
    return { ok: false, error: "token_not_active" };
  }

  return { ok: true, payload };
}

export async function getIdempotencyResponse(params: {
  key: string;
  route: string;
  requestHash: string;
}): Promise<{ found: true; response: unknown } | { found: false }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("request_idempotency")
    .select("response_json, request_hash")
    .eq("key", params.key)
    .eq("route", params.route)
    .maybeSingle();
  if (!data) return { found: false };
  if (data.request_hash !== params.requestHash) {
    return { found: false };
  }
  return { found: true, response: data.response_json };
}

export async function storeIdempotencyResponse(params: {
  key: string;
  route: string;
  requestHash: string;
  response: unknown;
  ttlHours?: number;
}): Promise<void> {
  const expiresAt = params.ttlHours
    ? new Date(Date.now() + params.ttlHours * 60 * 60 * 1000).toISOString()
    : null;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("request_idempotency").insert({
    key: params.key,
    route: params.route,
    request_hash: params.requestHash,
    response_json: params.response as any,
    expires_at: expiresAt,
  });
}

export function hashRequestBody(bodyText: string): string {
  return createHmac("sha256", "valence-body").update(bodyText).digest("hex");
}

export function extractBearerToken(request: Request): string | null {
  const auth = request.headers.get("authorization") ?? "";
  const match = auth.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : null;
}

export function verifyTimezone(tz: string | null | undefined): string | null {
  if (!tz) return null;
  try {
    Intl.DateTimeFormat("en-US", { timeZone: tz }).format(new Date());
    return tz;
  } catch {
    return null;
  }
}

