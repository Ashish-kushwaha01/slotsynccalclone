import { extractBearerToken, verifyJwtHs256 } from "@/lib/security.server";

export function requireApiUser(request: Request):
  | { ok: true; userId: string }
  | { ok: false; error: string; status: number } {
  const token = extractBearerToken(request);
  if (!token) {
    return { ok: false, error: "missing_token", status: 401 };
  }

  const secret = process.env.API_JWT_SECRET;
  if (!secret) {
    return { ok: false, error: "missing_jwt_secret", status: 500 };
  }

  const verified = verifyJwtHs256({ token, secret });
  if (!verified.ok) {
    return { ok: false, error: verified.error, status: 401 };
  }

  const userIdRaw =
    (typeof verified.payload.sub === "string" && verified.payload.sub) ||
    (typeof verified.payload.user_id === "string" && verified.payload.user_id) ||
    (typeof verified.payload.host_user_id === "string" && verified.payload.host_user_id) ||
    "";

  if (!userIdRaw) {
    return { ok: false, error: "missing_user_id", status: 401 };
  }

  return { ok: true, userId: userIdRaw };
}
