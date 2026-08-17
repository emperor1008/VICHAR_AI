import { Router } from "express";
import { getDb } from "../db.js";
import { asyncH, audit, ApiError } from "../security.js";
import { requireAuth, AuthedRequest } from "../auth.js";
import { revokeAllUserTokens } from "../auth.js";

const router = Router();
router.use(requireAuth);

/**
 * GDPR-style data export: the user's complete data in a portable JSON
 * document. Everything is scoped to the authenticated user.
 */
router.get("/export", asyncH(async (req: AuthedRequest, res) => {
  const db = getDb();
  const uid = req.user!.id;

  const user = db.prepare("SELECT * FROM users WHERE id = ?").get(uid) as any;
  const conversations = db.prepare("SELECT * FROM conversations WHERE user_id = ?").all(uid) as any[];
  const conversationIds = conversations.map((c) => c.id);
  const messages = conversationIds.length
    ? db.prepare(
        `SELECT * FROM messages WHERE conversation_id IN (${conversationIds.map(() => "?").join(",")}) ORDER BY created_at`,
      ).all(...conversationIds)
    : [];
  const moods = db.prepare("SELECT * FROM moods WHERE user_id = ?").all(uid);
  const journal = db.prepare("SELECT * FROM journal_entries WHERE user_id = ?").all(uid);
  const journalVault = db.prepare("SELECT * FROM journal_vaults WHERE user_id = ?").get(uid) as any;
  const goals = db.prepare("SELECT * FROM goals WHERE user_id = ?").all(uid);
  const sessions = db.prepare("SELECT * FROM sessions WHERE user_id = ?").all(uid);
  const memories = db.prepare("SELECT * FROM memories WHERE user_id = ?").all(uid);

  const data = {
    exportedAt: new Date().toISOString(),
    formatVersion: 2,
    profile: {
      id: user.id,
      email: user.email,
      name: user.name,
      nickname: user.nickname,
      age: user.age,
      gender: user.gender,
      pronouns: user.pronouns,
      profession: user.profession,
      studentWorking: user.student_working,
      timezone: user.timezone,
      language: user.language,
      emergencyContact: safeJson(user.emergency_contact),
      voiceId: user.voice_id,
      avatarId: user.avatar_id,
      personalityId: user.personality_id,
      createdAt: user.created_at,
    },
    conversations: conversations.map((c) => ({
      id: c.id,
      title: c.title,
      personalityId: c.personality_id,
      pinned: !!c.pinned,
      favorite: !!c.favorite,
      createdAt: c.created_at,
      messages: messages
        .filter((m: any) => m.conversation_id === c.id)
        .map((m: any) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          emotion: safeJson(m.emotion),
          reactions: safeJson(m.reactions),
          createdAt: m.created_at,
        })),
    })),
    moods: moods.map((m: any) => ({
      date: m.date,
      moodKey: m.mood_key,
      score: m.score,
      energy: m.energy,
      notes: m.notes,
      createdAt: m.created_at,
    })),
    journal: journal.map((j: any) => ({
      id: j.id,
      date: j.date,
      title: j.is_encrypted ? undefined : j.title,
      content: j.is_encrypted ? undefined : j.content,
      moodKey: j.is_encrypted ? undefined : j.mood_key,
      tags: j.is_encrypted ? undefined : safeJson(j.tags),
      isEncrypted: !!j.is_encrypted,
      encryptedPayload: j.is_encrypted ? j.encrypted_payload : undefined,
      createdAt: j.created_at,
    })),
    journalVault: journalVault ? {
      version: journalVault.version,
      kdf: journalVault.kdf,
      iterations: journalVault.iterations,
      salt: journalVault.salt,
      wrapIv: journalVault.wrap_iv,
      wrappedKey: journalVault.wrapped_key,
    } : null,
    goals: goals.map((g: any) => ({ id: g.id, title: g.title, category: g.category, completed: !!g.completed })),
    sessions: sessions.map((s: any) => ({ id: s.id, type: s.type, durationSeconds: s.duration_seconds, createdAt: s.created_at })),
    memories,
  };

  audit(uid, "export.downloaded", req);
  res.setHeader("Content-Disposition", 'attachment; filename="vichar-export.json"');
  res.type("application/json");
  res.send(JSON.stringify(data, null, 2));
}));

/**
 * Delete account: removes every row owned by the user and revokes all
 * sessions. There is no soft-delete of user content — this is permanent.
 */
router.delete("/account", asyncH(async (req: AuthedRequest, res) => {
  const db = getDb();
  const uid = req.user!.id;

  db.exec("BEGIN");
  try {
    revokeAllUserTokens(uid);
    db.prepare("DELETE FROM memories WHERE user_id = ?").run(uid);
    db.prepare("DELETE FROM sessions WHERE user_id = ?").run(uid);
    db.prepare("DELETE FROM goals WHERE user_id = ?").run(uid);
    db.prepare("DELETE FROM journal_entries WHERE user_id = ?").run(uid);
    db.prepare("DELETE FROM journal_vaults WHERE user_id = ?").run(uid);
    db.prepare("DELETE FROM moods WHERE user_id = ?").run(uid);
    db.prepare("DELETE FROM messages WHERE user_id = ?").run(uid);
    db.prepare("DELETE FROM conversations WHERE user_id = ?").run(uid);
    db.prepare("DELETE FROM users WHERE id = ?").run(uid);
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw new ApiError(500, "Could not delete account", "DELETE_FAILED");
  }
  audit(uid, "account.deleted", req);
  res.clearCookie("mm_refresh", { path: "/api/auth" });
  res.json({ ok: true, message: "Your account and all associated data have been permanently deleted." });
}));

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export default router;
