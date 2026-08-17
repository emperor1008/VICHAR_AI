import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import rateLimit from "express-rate-limit";
import { config } from "./config.js";
import { getDb } from "./db.js";
import { hashToken, nowIso, daysFromNow } from "./utils.js";

export interface AuthUser {
  id: string;
  email: string;
}

interface AccessPayload extends jwt.JwtPayload {
  sub: string;
  email: string;
}

/** Sign a short-lived access token. */
export function signAccessToken(user: AuthUser): string {
  return jwt.sign({ email: user.email }, config.jwt.accessSecret, {
    subject: user.id,
    expiresIn: config.jwt.accessTtl as jwt.SignOptions["expiresIn"],
    issuer: "vichar-api",
    audience: "vichar-web",
  });
}

/** Issue a fresh opaque refresh token and store its hash (rotatable). */
export function issueRefreshToken(userId: string, userAgent: string): { token: string; expiresAt: string } {
  const token = crypto.randomBytes(48).toString("base64url");
  const expiresAt = daysFromNow(config.jwt.refreshTtlDays);
  getDb()
    .prepare(
      "INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at, user_agent) VALUES (?, ?, ?, ?, ?)",
    )
    .run(crypto.randomUUID(), userId, hashToken(token), expiresAt, userAgent.slice(0, 200));
  return { token, expiresAt };
}

/** Look up a valid (non-revoked, non-expired) refresh token by hash. */
export function findValidRefreshToken(token: string): { userId: string; id: string } | null {
  const row = getDb()
    .prepare(
      "SELECT id, user_id, expires_at FROM refresh_tokens WHERE token_hash = ? AND revoked_at IS NULL",
    )
    .get(hashToken(token)) as { id: string; user_id: string; expires_at: string } | undefined;
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) return null;
  return { userId: row.user_id, id: row.id };
}

export function revokeRefreshToken(token: string): void {
  getDb()
    .prepare("UPDATE refresh_tokens SET revoked_at = ? WHERE token_hash = ?")
    .run(nowIso(), hashToken(token));
}

export function revokeAllUserTokens(userId: string): void {
  getDb().prepare("UPDATE refresh_tokens SET revoked_at = ? WHERE user_id = ?").run(nowIso(), userId);
}

export function decodeAccessToken(token: string): AccessPayload | null {
  try {
    const decoded = jwt.verify(token, config.jwt.accessSecret, {
      issuer: "vichar-api",
      audience: "vichar-web",
    }) as AccessPayload;
    return decoded;
  } catch {
    return null;
  }
}

export interface AuthedRequest extends Request {
  user?: AuthUser;
}

/** requireAuth — verifies the Bearer access token and attaches req.user. */
export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Missing access token" } });
  }
  const payload = decodeAccessToken(token);
  if (!payload?.sub) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Invalid or expired token" } });
  }
  const user = getDb().prepare("SELECT id, email FROM users WHERE id = ?").get(payload.sub) as
    | { id: string; email: string }
    | undefined;
  if (!user) {
    return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Account not found" } });
  }
  req.user = user;
  next();
}

/** Cookie name for the refresh token (HttpOnly, same-site, sent only to /api). */
export const REFRESH_COOKIE = "mm_refresh";

export const refreshCookieOptions = (remember: boolean) => ({
  httpOnly: true,
  secure: config.isProd,
  sameSite: "lax" as const,
  path: "/api/auth",
  maxAge: (remember ? 30 : 1) * 24 * 60 * 60 * 1000,
});

/** Stricter limit for auth endpoints (brute-force protection). */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: { code: "RATE_LIMITED", message: "Too many attempts. Please try again later." } },
});

/** General API limit. */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 600,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: { code: "RATE_LIMITED", message: "Rate limit exceeded." } },
});
