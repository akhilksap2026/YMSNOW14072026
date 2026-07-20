/**
 * Minimal signed-token helpers.
 * Format: base64url(JSON payload) + "." + base64url(HMAC-SHA256 signature)
 * Not JWT — just enough to be opaque and tamper-evident for the prototype.
 */
import { createHmac, timingSafeEqual } from "crypto";

const SECRET = process.env.SESSION_SECRET ?? "dev-secret-change-me";

export interface SessionPayload {
  userId: string;
  /** null for platform admins who are not bound to any tenant. */
  tenantId: string | null;
  role: string;
  /** Present and true only for KSAP platform administrators. */
  isPlatformAdmin?: boolean;
}

function b64(s: string): string {
  return Buffer.from(s).toString("base64url");
}
function unb64(s: string): string {
  return Buffer.from(s, "base64url").toString("utf8");
}

export function signToken(payload: SessionPayload): string {
  const data = b64(JSON.stringify(payload));
  const sig = createHmac("sha256", SECRET).update(data).digest("base64url");
  return `${data}.${sig}`;
}

export function verifyToken(token: string): SessionPayload | null {
  try {
    const dot = token.lastIndexOf(".");
    if (dot === -1) return null;
    const data = token.slice(0, dot);
    const sig  = token.slice(dot + 1);
    const expected = createHmac("sha256", SECRET).update(data).digest("base64url");
    // Constant-time compare to resist timing attacks (belt-and-suspenders)
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    return JSON.parse(unb64(data)) as SessionPayload;
  } catch {
    return null;
  }
}
