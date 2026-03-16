import crypto from "crypto";

const JWT_SECRET = process.env.JWT_SECRET || "riskmind-dev-secret-change-in-production";
const ACCESS_TOKEN_EXPIRY = 60 * 60;
const REFRESH_TOKEN_EXPIRY = 7 * 24 * 60 * 60;

interface JwtPayload {
  sub: string;
  tenantId: string;
  email: string;
  role: string;
  type: "access" | "refresh";
  iat: number;
  exp: number;
}

function base64UrlEncode(data: string): string {
  return Buffer.from(data).toString("base64url");
}

function base64UrlDecode(data: string): string {
  return Buffer.from(data, "base64url").toString("utf-8");
}

function sign(payload: object): string {
  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = base64UrlEncode(JSON.stringify(payload));
  const signature = crypto
    .createHmac("sha256", JWT_SECRET)
    .update(`${header}.${body}`)
    .digest("base64url");
  return `${header}.${body}.${signature}`;
}

function verify(token: string): JwtPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;

    const [header, body, signature] = parts;
    const expectedSig = crypto
      .createHmac("sha256", JWT_SECRET)
      .update(`${header}.${body}`)
      .digest("base64url");

    if (signature !== expectedSig) return null;

    const payload = JSON.parse(base64UrlDecode(body)) as JwtPayload;
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;

    return payload;
  } catch {
    return null;
  }
}

export function generateAccessToken(userId: string, tenantId: string, email: string, role: string): string {
  const now = Math.floor(Date.now() / 1000);
  return sign({
    sub: userId,
    tenantId,
    email,
    role,
    type: "access",
    iat: now,
    exp: now + ACCESS_TOKEN_EXPIRY,
  });
}

export function generateRefreshToken(userId: string, tenantId: string, email: string, role: string): string {
  const now = Math.floor(Date.now() / 1000);
  return sign({
    sub: userId,
    tenantId,
    email,
    role,
    type: "refresh",
    iat: now,
    exp: now + REFRESH_TOKEN_EXPIRY,
  });
}

export function verifyAccessToken(token: string): JwtPayload | null {
  const payload = verify(token);
  if (!payload || payload.type !== "access") return null;
  return payload;
}

export function verifyRefreshToken(token: string): JwtPayload | null {
  const payload = verify(token);
  if (!payload || payload.type !== "refresh") return null;
  return payload;
}

export type { JwtPayload };
