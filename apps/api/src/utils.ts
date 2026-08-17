import { nanoid } from "nanoid";
import crypto from "node:crypto";

export const genId = (): string => nanoid(21);

/** SHA-256 hash of an opaque refresh token, for safe storage. */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function daysFromNow(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

export function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

/** Deterministic pseudo-random selection from an array (stable per string). */
export function pickStable<T>(arr: readonly T[], key: string): T {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return arr[h % arr.length];
}

export function pickRandom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function safeJsonParse<T>(raw: string, fallback: T): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function stripHtml(s: string): string {
  return s.replace(/<[^>]*>/g, "");
}

export function truncate(s: string, max: number): string {
  const clean = s.replace(/\s+/g, " ").trim();
  return clean.length > max ? clean.slice(0, max - 1).trimEnd() + "…" : clean;
}

/** Extract a short, quotable phrase from user text for reflective mirroring. */
export function mirrorPhrase(text: string, max = 60): string {
  const sentences = text
    .split(/[.!?\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 8);
  const pick = sentences[0] ?? text.trim();
  const cleaned = pick.replace(/^(i\s+am\s+|i'm\s+|i feel\s+|i\s+feel\s+)/i, "").trim();
  return truncate(cleaned, max) || text.trim().slice(0, max);
}
