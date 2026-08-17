import { Router } from "express";
import { z } from "zod";
import { getDb } from "../db.js";
import { asyncH, audit } from "../security.js";
import { requireAuth, AuthedRequest } from "../auth.js";
import { serializeUser } from "../serialize.js";
import { genId, nowIso } from "../utils.js";
const router = Router();
router.use(requireAuth);

const profileSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  nickname: z.string().max(40).optional(),
  age: z.number().int().min(13).max(120).nullable().optional(),
  gender: z.string().max(30).optional(),
  pronouns: z.string().max(40).optional(),
  profession: z.string().max(80).optional(),
  studentWorking: z.enum(["student", "working", "both", "neither"]).optional(),
  phone: z.string().max(20).optional(),
  timezone: z.string().max(60).optional(),
  language: z.string().max(10).optional(),
  voiceId: z.string().max(40).optional(),
  avatarId: z.string().max(40).optional(),
  personalityId: z.string().max(40).optional(),
  onboarded: z.boolean().optional(),
});

router.get(
  "/me",
  asyncH(async (req: AuthedRequest, res) => {
    const row = getDb().prepare("SELECT * FROM users WHERE id = ?").get(req.user!.id) as any;
    res.json({ user: serializeUser(row) });
  }),
);

router.patch(
  "/me",
  asyncH(async (req: AuthedRequest, res) => {
    const body = profileSchema.parse(req.body);
    const db = getDb();
    const current = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user!.id) as any;

    const updates: Record<string, string | number | null> = {
      name: body.name ?? current.name,
      nickname: body.nickname ?? current.nickname,
      age: body.age === undefined ? current.age : body.age,
      gender: body.gender ?? current.gender,
      pronouns: body.pronouns ?? current.pronouns,
      profession: body.profession ?? current.profession,
      student_working: body.studentWorking ?? current.student_working,
      phone: body.phone ?? current.phone,
      timezone: body.timezone ?? current.timezone,
      language: body.language ?? current.language,
      voice_id: body.voiceId ?? current.voice_id,
      avatar_id: body.avatarId ?? current.avatar_id,
      personality_id: body.personalityId ?? current.personality_id,
      onboarded_at: body.onboarded ? nowIso() : current.onboarded_at,
      updated_at: nowIso(),
    };

    db.prepare(
      `UPDATE users SET name=?, nickname=?, age=?, gender=?, pronouns=?, profession=?, student_working=?,
       phone=?, timezone=?, language=?, voice_id=?, avatar_id=?, personality_id=?, onboarded_at=?, updated_at=?
       WHERE id=?`,
    ).run(
      updates.name, updates.nickname, updates.age, updates.gender, updates.pronouns,
      updates.profession, updates.student_working, updates.phone, updates.timezone,
      updates.language, updates.voice_id, updates.avatar_id, updates.personality_id,
      updates.onboarded_at, updates.updated_at, req.user!.id,
    );

    const row = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user!.id) as any;
    res.json({ user: serializeUser(row) });
  }),
);

// Emergency contact — stored on the profile but returned only via this route
// and the encrypted export (never in the shared /users/me payload).
router.get(
  "/emergency",
  asyncH(async (req: AuthedRequest, res) => {
    const row = getDb().prepare("SELECT emergency_contact FROM users WHERE id = ?").get(req.user!.id) as any;
    try {
      res.json({ emergencyContact: JSON.parse(row.emergency_contact) });
    } catch {
      res.json({ emergencyContact: null });
    }
  }),
);

const emergencySchema = z.object({
  name: z.string().max(80).optional().default(""),
  relationship: z.string().max(40).optional().default(""),
  phone: z.string().max(20).optional().default(""),
});

router.put(
  "/emergency",
  asyncH(async (req: AuthedRequest, res) => {
    const body = emergencySchema.parse(req.body);
    getDb()
      .prepare("UPDATE users SET emergency_contact = ?, updated_at = ? WHERE id = ?")
      .run(JSON.stringify(body), nowIso(), req.user!.id);
    audit(req.user!.id, "profile.emergency_updated", req);
    res.json({ emergencyContact: body });
  }),
);

export default router;
