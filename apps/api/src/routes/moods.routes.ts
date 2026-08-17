import { Router } from "express";
import { z } from "zod";
import { getDb } from "../db.js";
import { asyncH, audit, ApiError } from "../security.js";
import { requireAuth, AuthedRequest } from "../auth.js";
import { genId, nowIso } from "../utils.js";

const router = Router();
router.use(requireAuth);

// ---------------------------------------------------------------------------
// Moods
// ---------------------------------------------------------------------------
const MOOD_META: Record<string, { emoji: string; score: number }> = {
  joyful: { emoji: "😄", score: 9 },
  happy: { emoji: "😊", score: 8 },
  calm: { emoji: "😌", score: 7 },
  hopeful: { emoji: "🌅", score: 7 },
  neutral: { emoji: "😐", score: 5 },
  tired: { emoji: "😪", score: 4 },
  anxious: { emoji: "😰", score: 3 },
  sad: { emoji: "😢", score: 3 },
  lonely: { emoji: "🌙", score: 3 },
  angry: { emoji: "😠", score: 2 },
  overwhelmed: { emoji: "🌊", score: 2 },
};

const moodSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  moodKey: z.string().min(2).max(30),
  energy: z.number().int().min(1).max(10).nullable().optional(),
  notes: z.string().max(2000).optional().default(""),
});

router.get("/moods", asyncH(async (req: AuthedRequest, res) => {
  const { from, to } = req.query as { from?: string; to?: string };
  const db = getDb();
  let sql = "SELECT * FROM moods WHERE user_id = ?";
  const params: (string | number)[] = [req.user!.id];
  if (from && to) {
    sql += " AND date >= ? AND date <= ?";
    params.push(from, to);
  }
  sql += " ORDER BY date DESC";
  const rows = db.prepare(sql).all(...params) as any[];
  res.json({ moods: rows.map(serializeMood) });
}));

router.get("/moods/today", asyncH(async (req: AuthedRequest, res) => {
  const date = (req.query.date as string | undefined) ?? new Date().toISOString().slice(0, 10);
  const row = getDb()
    .prepare("SELECT * FROM moods WHERE user_id = ? AND date = ?")
    .get(req.user!.id, date);
  res.json({ mood: row ? serializeMood(row) : null });
}));

router.put("/moods", asyncH(async (req: AuthedRequest, res) => {
  const body = moodSchema.parse(req.body);
  const db = getDb();
  const meta = MOOD_META[body.moodKey] ?? { emoji: "🙂", score: 5 };
  const existing = db.prepare("SELECT id FROM moods WHERE user_id = ? AND date = ?").get(req.user!.id, body.date);
  const values = [body.moodKey, meta.score, meta.emoji, body.energy ?? null, body.notes, nowIso()];
  if (existing) {
    db.prepare(
      "UPDATE moods SET mood_key = ?, score = ?, emoji = ?, energy = ?, notes = ?, updated_at = ? WHERE id = ?",
    ).run(...values, existing.id);
  } else {
    db.prepare(
      "INSERT INTO moods (id, user_id, date, mood_key, score, emoji, energy, notes, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ).run(genId(), req.user!.id, body.date, ...values);
  }
  const row = db.prepare("SELECT * FROM moods WHERE user_id = ? AND date = ?").get(req.user!.id, body.date);
  audit(req.user!.id, "mood.upsert", req);
  res.json({ mood: serializeMood(row) });
}));

// Weekly/monthly insights for the timeline.
router.get("/moods/insights", asyncH(async (req: AuthedRequest, res) => {
  const db = getDb();
  const rows = db
    .prepare(
      "SELECT date, mood_key, score, emoji FROM moods WHERE user_id = ? ORDER BY date ASC",
    )
    .all(req.user!.id) as any[];
  if (!rows.length) {
    return res.json({ insights: { streak: 0, bestMood: null, averageScore: null, count: 0, trend: "neutral" } });
  }
  const avg = rows.reduce((a, r) => a + r.score, 0) / rows.length;
  const counts: Record<string, number> = {};
  for (const r of rows) counts[r.mood_key] = (counts[r.mood_key] ?? 0) + 1;
  const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  // Simple 7-day sliding trend
  let trend: "improving" | "declining" | "stable" | "neutral" = "neutral";
  if (rows.length >= 7) {
    const first7 = rows.slice(0, 7).reduce((a, r) => a + r.score, 0) / 7;
    const last7 = rows.slice(-7).reduce((a, r) => a + r.score, 0) / 7;
    const diff = last7 - first7;
    trend = diff > 0.5 ? "improving" : diff < -0.5 ? "declining" : "stable";
  }

  let streak = 0;
  const byDate = new Map(rows.map((r) => [r.date, true]));
  for (let d = new Date(); byDate.has(localDate(d)); d.setDate(d.getDate() - 1)) {
    streak++;
  }

  res.json({ insights: { streak, bestMood: best, averageScore: Math.round(avg * 10) / 10, count: rows.length, trend } });
}));

// ---------------------------------------------------------------------------
// Journal
// ---------------------------------------------------------------------------
const journalSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  title: z.string().max(120).optional().default(""),
  content: z.string().min(1, "Write something").max(20000),
  moodKey: z.string().max(30).optional().default(""),
  tags: z.array(z.string().max(30)).max(10).optional().default([]),
});

const encryptedJournalSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  encryptedPayload: z.string().min(40).max(100000),
});

const base64Value = z.string().min(16).max(1000).regex(/^[A-Za-z0-9+/]+={0,2}$/);
const vaultSchema = z.object({
  version: z.literal(1),
  kdf: z.literal("PBKDF2-SHA256"),
  iterations: z.number().int().min(100000).max(2000000),
  salt: base64Value,
  wrapIv: base64Value,
  wrappedKey: base64Value,
});

router.get("/journal/vault", asyncH(async (req: AuthedRequest, res) => {
  const row = getDb().prepare("SELECT * FROM journal_vaults WHERE user_id = ?").get(req.user!.id) as any;
  res.setHeader("Cache-Control", "no-store");
  res.json({ configured: !!row, vault: row ? serializeVault(row) : null });
}));

router.put("/journal/vault", asyncH(async (req: AuthedRequest, res) => {
  const body = vaultSchema.parse(req.body);
  const db = getDb();
  // INSERT OR IGNORE makes two near-simultaneous setup requests deterministic:
  // exactly one creates the vault and the other receives a clean 409 instead
  // of leaking a SQLite uniqueness error as a 500.
  const inserted = db.prepare(
    "INSERT OR IGNORE INTO journal_vaults (user_id, version, kdf, iterations, salt, wrap_iv, wrapped_key) VALUES (?, ?, ?, ?, ?, ?, ?)",
  ).run(req.user!.id, body.version, body.kdf, body.iterations, body.salt, body.wrapIv, body.wrappedKey);
  if (!inserted.changes) throw new ApiError(409, "A private diary is already configured", "VAULT_EXISTS");
  audit(req.user!.id, "journal.vault.created", req);
  res.status(201).json({ configured: true, vault: body });
}));

router.get("/journal", asyncH(async (req: AuthedRequest, res) => {
  const rows = getDb()
    .prepare("SELECT * FROM journal_entries WHERE user_id = ? ORDER BY date DESC, created_at DESC")
    .all(req.user!.id) as any[];
  res.setHeader("Cache-Control", "no-store");
  res.json({ entries: rows.map(serializeEntry) });
}));

router.post("/journal", asyncH(async (req: AuthedRequest, res) => {
  const db = getDb();
  const vaultConfigured = !!db.prepare("SELECT user_id FROM journal_vaults WHERE user_id = ?").get(req.user!.id);
  if (typeof req.body?.encryptedPayload === "string") {
    if (!vaultConfigured) throw new ApiError(409, "Configure the private diary before saving encrypted pages", "VAULT_REQUIRED");
    const body = encryptedJournalSchema.parse(req.body);
    const id = genId();
    db.prepare(
      "INSERT INTO journal_entries (id, user_id, date, title, content, mood_key, tags, is_encrypted, encrypted_payload) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)",
    ).run(id, req.user!.id, body.date, "", "", "", "[]", body.encryptedPayload);
    audit(req.user!.id, "journal.encrypted.created", req);
    return res.status(201).json({
      entry: serializeEntry({
        id,
        user_id: req.user!.id,
        date: body.date,
        title: "",
        content: "",
        mood_key: "",
        tags: "[]",
        ai_summary: "",
        is_encrypted: 1,
        encrypted_payload: body.encryptedPayload,
        created_at: nowIso(),
        updated_at: nowIso(),
      }),
    });
  }
  if (vaultConfigured) {
    throw new ApiError(400, "This private diary accepts encrypted pages only", "ENCRYPTION_REQUIRED");
  }
  const body = journalSchema.parse(req.body);
  const id = genId();
  db
    .prepare(
      "INSERT INTO journal_entries (id, user_id, date, title, content, mood_key, tags) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
    .run(id, req.user!.id, body.date, body.title, body.content, body.moodKey, JSON.stringify(body.tags));
  audit(req.user!.id, "journal.created", req);
  res.status(201).json({ entry: serializeEntry({ id, user_id: req.user!.id, date: body.date, title: body.title, content: body.content, mood_key: body.moodKey, tags: JSON.stringify(body.tags), ai_summary: "", created_at: nowIso(), updated_at: nowIso() }) });
}));

// Converts a legacy plaintext entry to encrypted storage after the browser has
// unlocked it. The server never receives the diary password or plaintext.
router.put("/journal/:id", asyncH(async (req: AuthedRequest, res) => {
  const body = encryptedJournalSchema.pick({ encryptedPayload: true }).parse(req.body);
  const db = getDb();
  const vaultConfigured = !!db.prepare("SELECT user_id FROM journal_vaults WHERE user_id = ?").get(req.user!.id);
  if (!vaultConfigured) throw new ApiError(409, "Configure the private diary before encrypting pages", "VAULT_REQUIRED");
  const existing = db.prepare("SELECT id FROM journal_entries WHERE id = ? AND user_id = ?").get(req.params.id, req.user!.id);
  if (!existing) throw new ApiError(404, "Entry not found", "NOT_FOUND");
  db.prepare(
    "UPDATE journal_entries SET title = '', content = '', mood_key = '', tags = '[]', ai_summary = '', is_encrypted = 1, encrypted_payload = ?, updated_at = ? WHERE id = ? AND user_id = ?",
  ).run(body.encryptedPayload, nowIso(), req.params.id, req.user!.id);
  audit(req.user!.id, "journal.encrypted.migrated", req);
  res.json({ ok: true });
}));

router.delete("/journal/:id", asyncH(async (req: AuthedRequest, res) => {
  const r = getDb().prepare("DELETE FROM journal_entries WHERE id = ? AND user_id = ?").run(req.params.id, req.user!.id);
  if (!r.changes) throw new ApiError(404, "Entry not found", "NOT_FOUND");
  res.json({ ok: true });
}));

function serializeMood(r: any) {
  return { id: r.id, date: r.date, moodKey: r.mood_key, score: r.score, emoji: r.emoji, energy: r.energy, notes: r.notes, createdAt: r.created_at, updatedAt: r.updated_at };
}

function serializeEntry(r: any) {
  let tags: string[] = [];
  try { tags = JSON.parse(r.tags); } catch { /* keep [] */ }
  const encrypted = !!r.is_encrypted;
  return {
    id: r.id,
    date: r.date,
    title: encrypted ? "Private entry" : r.title,
    content: encrypted ? "" : r.content,
    moodKey: encrypted ? "" : r.mood_key,
    tags: encrypted ? [] : tags,
    aiSummary: encrypted ? "" : r.ai_summary,
    isEncrypted: encrypted,
    encryptedPayload: encrypted ? r.encrypted_payload : "",
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function serializeVault(r: any) {
  return {
    version: r.version,
    kdf: r.kdf,
    iterations: r.iterations,
    salt: r.salt,
    wrapIv: r.wrap_iv,
    wrappedKey: r.wrapped_key,
  };
}

function localDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default router;
