import { Router } from "express";
import { z } from "zod";
import { getDb } from "../db.js";
import { asyncH, audit, ApiError } from "../security.js";
import { requireAuth, AuthedRequest } from "../auth.js";
import { genId, nowIso } from "../utils.js";

const router = Router();
router.use(requireAuth);

// ---------------------------------------------------------------------------
// Daily goals
// ---------------------------------------------------------------------------
const goalSchema = z.object({
  title: z.string().min(1).max(200),
  category: z.string().max(40).optional().default("general"),
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
});

router.get("/goals", asyncH(async (req: AuthedRequest, res) => {
  const rows = getDb()
    .prepare("SELECT * FROM goals WHERE user_id = ? ORDER BY completed ASC, created_at DESC")
    .all(req.user!.id) as any[];
  res.json({ goals: rows.map(serialize) });
}));

router.post("/goals", asyncH(async (req: AuthedRequest, res) => {
  const body = goalSchema.parse(req.body);
  const id = genId();
  getDb()
    .prepare(
      "INSERT INTO goals (id, user_id, title, category, target_date) VALUES (?, ?, ?, ?, ?)",
    )
    .run(id, req.user!.id, body.title.trim(), body.category, body.targetDate ?? null);
  res.status(201).json({ goal: serialize({ id, user_id: req.user!.id, title: body.title.trim(), category: body.category, target_date: body.targetDate, completed: 0, created_at: nowIso(), completed_at: null }) });
}));

router.patch("/goals/:id", asyncH(async (req: AuthedRequest, res) => {
  const body = z.object({ completed: z.boolean().optional(), title: z.string().min(1).max(200).optional() }).parse(req.body);
  const db = getDb();
  const existing = db.prepare("SELECT * FROM goals WHERE id = ? AND user_id = ?").get(req.params.id, req.user!.id);
  if (!existing) throw new ApiError(404, "Goal not found", "NOT_FOUND");
  if (body.completed !== undefined) {
    db.prepare("UPDATE goals SET completed = ?, completed_at = ? WHERE id = ?").run(
      body.completed ? 1 : 0,
      body.completed ? nowIso() : null,
      req.params.id,
    );
  }
  if (body.title) {
    db.prepare("UPDATE goals SET title = ? WHERE id = ?").run(body.title.trim(), req.params.id);
  }
  const row = db.prepare("SELECT * FROM goals WHERE id = ?").get(req.params.id);
  res.json({ goal: serialize(row) });
}));

router.delete("/goals/:id", asyncH(async (req: AuthedRequest, res) => {
  const r = getDb().prepare("DELETE FROM goals WHERE id = ? AND user_id = ?").run(req.params.id, req.user!.id);
  if (!r.changes) throw new ApiError(404, "Goal not found", "NOT_FOUND");
  res.json({ ok: true });
}));

// ---------------------------------------------------------------------------
// Practice sessions (breathing / meditation / focus / voice)
// ---------------------------------------------------------------------------
const sessionSchema = z.object({
  type: z.enum(["breathing", "meditation", "focus", "voice"]),
  durationSeconds: z.number().int().min(0).max(86400),
  moodBefore: z.string().max(30).optional().default(""),
  moodAfter: z.string().max(30).optional().default(""),
});

router.post("/sessions", asyncH(async (req: AuthedRequest, res) => {
  const body = sessionSchema.parse(req.body);
  getDb()
    .prepare(
      "INSERT INTO sessions (id, user_id, type, duration_seconds, mood_before, mood_after) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .run(genId(), req.user!.id, body.type, body.durationSeconds, body.moodBefore, body.moodAfter);
  audit(req.user!.id, `session.${body.type}`, req);
  res.status(201).json({ ok: true });
}));

router.get("/sessions", asyncH(async (req: AuthedRequest, res) => {
  const rows = getDb()
    .prepare("SELECT * FROM sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT 200")
    .all(req.user!.id) as any[];
  const total = rows.reduce((a, r) => a + (r.duration_seconds || 0), 0);
  const byType: Record<string, number> = {};
  for (const r of rows) byType[r.type] = (byType[r.type] ?? 0) + 1;
  res.json({
    sessions: rows.map((r) => ({
      id: r.id,
      type: r.type,
      durationSeconds: r.duration_seconds,
      moodBefore: r.mood_before,
      moodAfter: r.mood_after,
      createdAt: r.created_at,
    })),
    stats: { totalSessions: rows.length, totalMinutes: Math.round(total / 60), byType },
  });
}));

function serialize(r: any) {
  return { id: r.id, title: r.title, category: r.category, targetDate: r.target_date, completed: !!r.completed, createdAt: r.created_at, completedAt: r.completed_at };
}

export default router;
