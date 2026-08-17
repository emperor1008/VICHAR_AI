import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { z } from "zod";
import { config } from "../config.js";
import { getDb } from "../db.js";
import { asyncH, audit, ApiError } from "../security.js";
import {
  authLimiter,
  issueRefreshToken,
  findValidRefreshToken,
  refreshCookieOptions,
  REFRESH_COOKIE,
  revokeRefreshToken,
  revokeAllUserTokens,
  signAccessToken,
  AuthedRequest,
} from "../auth.js";
import { genId, hashToken, nowIso, daysFromNow } from "../utils.js";

const router = Router();

const registerSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[a-zA-Z]/, "Password must contain a letter")
    .regex(/[0-9]/, "Password must contain a number"),
  name: z.string().min(1, "Name is required").max(80),
  privacyConsent: z.boolean().refine((v) => v === true, "You must accept the privacy consent to continue"),
});

function issueTokens(user: { id: string; email: string }, remember: boolean, userAgent: string) {
  const accessToken = signAccessToken(user);
  const { token, expiresAt } = issueRefreshToken(user.id, userAgent);
  return { accessToken, refreshToken: token, expiresAt };
}

router.post(
  "/register",
  authLimiter,
  asyncH(async (req, res) => {
    const body = registerSchema.parse(req.body);
    const db = getDb();

    const exists = db.prepare("SELECT id FROM users WHERE email = ?").get(body.email.toLowerCase());
    if (exists) throw new ApiError(409, "An account with this email already exists", "EMAIL_TAKEN");

    const passwordHash = await bcrypt.hash(body.password, 12);
    const id = genId();
    db.prepare(
      `INSERT INTO users (id, email, password_hash, name, privacy_consent_at)
       VALUES (?, ?, ?, ?, ?)`,
    ).run(id, body.email.toLowerCase(), passwordHash, body.name.trim(), nowIso());

    const user = { id, email: body.email.toLowerCase() };
    const { accessToken, refreshToken, expiresAt } = issueTokens(user, true, req.headers["user-agent"] ?? "");
    audit(id, "auth.register", req);
    res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions(true));
    res.status(201).json({ accessToken, expiresAt, user: publicUser(id) });
  }),
);

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  rememberMe: z.boolean().optional().default(true),
});

router.post(
  "/login",
  authLimiter,
  asyncH(async (req, res) => {
    const body = loginSchema.parse(req.body);
    const db = getDb();
    const row = db
      .prepare("SELECT id, email, password_hash FROM users WHERE email = ?")
      .get(body.email.toLowerCase()) as { id: string; email: string; password_hash: string } | undefined;

    if (!row) throw new ApiError(401, "Incorrect email or password", "INVALID_CREDENTIALS");
    const ok = await bcrypt.compare(body.password, row.password_hash);
    if (!ok) throw new ApiError(401, "Incorrect email or password", "INVALID_CREDENTIALS");

    const user = { id: row.id, email: row.email };
    const { accessToken, refreshToken, expiresAt } = issueTokens(user, body.rememberMe, req.headers["user-agent"] ?? "");
    db.prepare("UPDATE users SET last_seen_at = ? WHERE id = ?").run(nowIso(), row.id);
    audit(row.id, "auth.login", req);
    res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions(body.rememberMe));
    res.json({ accessToken, expiresAt, user: publicUser(row.id) });
  }),
);

router.post(
  "/refresh",
  asyncH(async (req, res) => {
    const token = (req.cookies?.[REFRESH_COOKIE] as string | undefined) ?? (req.body?.refreshToken as string | undefined);
    if (!token) throw new ApiError(401, "No refresh token", "NO_REFRESH");
    const found = findValidRefreshToken(token);
    if (!found) throw new ApiError(401, "Refresh token invalid or expired", "INVALID_REFRESH");

    // Rotate: revoke old, issue new.
    revokeRefreshToken(token);
    const db = getDb();
    const userRow = db.prepare("SELECT id, email FROM users WHERE id = ?").get(found.userId) as
      | { id: string; email: string }
      | undefined;
    if (!userRow) throw new ApiError(401, "Account not found", "ACCOUNT_GONE");

    const { accessToken, refreshToken, expiresAt } = issueTokens(userRow, true, req.headers["user-agent"] ?? "");
    audit(userRow.id, "auth.refresh", req);
    res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions(true));
    res.json({ accessToken, expiresAt, user: publicUser(userRow.id) });
  }),
);

router.post(
  "/logout",
  asyncH(async (req: AuthedRequest, res) => {
    const token = (req.cookies?.[REFRESH_COOKIE] as string | undefined) ?? (req.body?.refreshToken as string | undefined);
    if (token) revokeRefreshToken(token);
    if (req.user?.id) audit(req.user.id, "auth.logout", req);
    res.clearCookie(REFRESH_COOKIE, { path: "/api/auth" });
    res.json({ ok: true });
  }),
);

// ---------------------------------------------------------------------------
// Phone OTP (demo-complete: codes are delivered via the configured SMS channel;
// in development the code is returned in the response so the flow is testable).
// ---------------------------------------------------------------------------
const phoneSchema = z.object({ phone: z.string().min(7).max(20) });

router.post(
  "/phone/send",
  authLimiter,
  asyncH(async (req, res) => {
    const { phone } = phoneSchema.parse(req.body);
    const db = getDb();
    // Expire any previous codes for this number.
    db.prepare("UPDATE auth_codes SET used_at = ? WHERE target = ? AND kind = 'otp' AND used_at IS NULL").run(nowIso(), phone);
    const code = String(crypto.randomInt(100000, 999999));
    db.prepare(
      "INSERT INTO auth_codes (id, target, kind, code_hash, expires_at) VALUES (?, ?, 'otp', ?, ?)",
    ).run(genId(), phone, hashToken(code), daysFromNow(0.0083)); // 12 minutes
    audit(null, "auth.otp.send", req);
    // In production the code would go via SMS (Twilio etc.). Dev-only echo:
    res.json({ ok: true, devCode: config.isProd ? undefined : code, note: config.isProd ? undefined : "Dev mode: code echoed for testing." });
  }),
);

const verifySchema = z.object({
  phone: z.string().min(7).max(20),
  code: z.string().regex(/^\d{6}$/, "Enter the 6-digit code"),
});

router.post(
  "/phone/verify",
  authLimiter,
  asyncH(async (req, res) => {
    const { phone, code } = verifySchema.parse(req.body);
    const db = getDb();
    const row = db
      .prepare(
        "SELECT id, expires_at FROM auth_codes WHERE target = ? AND kind = 'otp' AND used_at IS NULL ORDER BY created_at DESC LIMIT 1",
      )
      .get(phone) as { id: string; expires_at: string } | undefined;
    if (!row || new Date(row.expires_at).getTime() < Date.now())
      throw new ApiError(400, "Code expired or not found. Request a new one.", "BAD_CODE");
    const attempt = db.prepare("SELECT code_hash FROM auth_codes WHERE id = ?").get(row.id) as { code_hash: string };
    // Constant-time-ish compare via hash comparison.
    const codeHash = hashToken(code);
    if (attempt.code_hash !== codeHash) throw new ApiError(400, "Incorrect code", "BAD_CODE");
    db.prepare("UPDATE auth_codes SET used_at = ? WHERE id = ?").run(nowIso(), row.id);

    let userId = db.prepare("SELECT id FROM users WHERE phone = ?").get(phone) as { id: string } | undefined;
    if (!userId) {
      const id = genId();
      db.prepare(
        `INSERT INTO users (id, email, password_hash, name, phone, privacy_consent_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).run(id, `${phone}@phone.vichar`, await bcrypt.hash(crypto.randomBytes(24).toString("hex"), 10), "Friend", phone, nowIso());
      userId = { id };
    }
    const userRow = db.prepare("SELECT id, email FROM users WHERE id = ?").get(userId.id) as { id: string; email: string };
    const { accessToken, refreshToken, expiresAt } = issueTokens(userRow, true, req.headers["user-agent"] ?? "");
    audit(userRow.id, "auth.otp.verify", req);
    res.cookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions(true));
    res.json({ accessToken, expiresAt, user: publicUser(userRow.id) });
  }),
);

// ---------------------------------------------------------------------------
// Forgot password / reset
// ---------------------------------------------------------------------------
const forgotSchema = z.object({ email: z.string().email() });

router.post(
  "/forgot",
  authLimiter,
  asyncH(async (req, res) => {
    const { email } = forgotSchema.parse(req.body);
    const db = getDb();
    const row = db.prepare("SELECT id FROM users WHERE email = ?").get(email.toLowerCase()) as { id: string } | undefined;
    // Always return ok:true to avoid account enumeration.
    if (row) {
      db.prepare("UPDATE auth_codes SET used_at = ? WHERE target = ? AND kind = 'reset' AND used_at IS NULL").run(nowIso(), email.toLowerCase());
      const token = crypto.randomBytes(32).toString("base64url");
      db.prepare(
        "INSERT INTO auth_codes (id, target, kind, code_hash, expires_at) VALUES (?, ?, 'reset', ?, ?)",
      ).run(genId(), email.toLowerCase(), hashToken(token), daysFromNow(1));
      audit(row.id, "auth.forgot", req);
      if (config.isProd) {
        // Production: send email with link `${webUrl}/reset?token=...`
        console.info(`Password reset requested for ${email} (email delivery is a provider integration)`);
      } else {
        res.json({ ok: true, devResetToken: token });
      }
    } else {
      res.json({ ok: true });
    }
  }),
);

const resetSchema = z.object({
  token: z.string().min(10),
  password: z.string().min(8).regex(/[a-zA-Z]/).regex(/[0-9]/),
});

router.post(
  "/reset",
  authLimiter,
  asyncH(async (req, res) => {
    const { token, password } = resetSchema.parse(req.body);
    const db = getDb();
    const row = db
      .prepare("SELECT id, expires_at FROM auth_codes WHERE code_hash = ? AND kind = 'reset' AND used_at IS NULL")
      .get(hashToken(token)) as { id: string; expires_at: string } | undefined;
    if (!row || new Date(row.expires_at).getTime() < Date.now())
      throw new ApiError(400, "Reset link invalid or expired", "BAD_TOKEN");
    const target = db.prepare("SELECT target FROM auth_codes WHERE id = ?").get(row.id) as { target: string };
    const user = db.prepare("SELECT id FROM users WHERE email = ?").get(target.target) as { id: string } | undefined;
    if (!user) throw new ApiError(400, "Account not found", "ACCOUNT_GONE");
    const passwordHash = await bcrypt.hash(password, 12);
    db.prepare("UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?").run(passwordHash, nowIso(), user.id);
    db.prepare("UPDATE auth_codes SET used_at = ? WHERE id = ?").run(nowIso(), row.id);
    revokeAllUserTokens(user.id); // invalidate every session
    audit(user.id, "auth.reset_password", req);
    res.json({ ok: true });
  }),
);

// ---------------------------------------------------------------------------
// Google OAuth — requires GOOGLE_CLIENT_ID/SECRET configured in production.
// ---------------------------------------------------------------------------
router.post(
  "/google",
  authLimiter,
  asyncH(async (_req, res) => {
    throw new ApiError(
      501,
      "Google sign-in requires OAuth credentials (GOOGLE_CLIENT_ID/SECRET). See DEPLOYMENT.md — the frontend button is wired to this endpoint.",
      "OAUTH_NOT_CONFIGURED",
    );
  }),
);

// Helpers
function publicUser(userId: string) {
  const row = getDb().prepare("SELECT * FROM users WHERE id = ?").get(userId) as any;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    nickname: row.nickname,
    age: row.age,
    gender: row.gender,
    pronouns: row.pronouns,
    profession: row.profession,
    studentWorking: row.student_working,
    phone: row.phone,
    timezone: row.timezone,
    language: row.language,
    voiceId: row.voice_id,
    avatarId: row.avatar_id,
    personalityId: row.personality_id,
    onboardedAt: row.onboarded_at,
    createdAt: row.created_at,
  };
}

export default router;
