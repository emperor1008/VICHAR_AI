import { Router } from "express";
import { z } from "zod";
import { getDb } from "../db.js";
import { asyncH, audit, ApiError } from "../security.js";
import { requireAuth, AuthedRequest } from "../auth.js";
import { genId, nowIso } from "../utils.js";

const router = Router();
router.use(requireAuth);

const listSchema = z.object({
  search: z.string().max(100).optional(),
  pinOnly: z.enum(["true", "false"]).optional(),
  favoriteOnly: z.enum(["true", "false"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
});

router.get(
  "/",
  asyncH(async (req: AuthedRequest, res) => {
    const { search, pinOnly, favoriteOnly, limit } = listSchema.parse(req.query);
    const db = getDb();
    const params: (string | number)[] = [req.user!.id];
    let where = "user_id = ? AND archived = 0";
    if (search) {
      where += " AND title LIKE ?";
      params.push(`%${search}%`);
    }
    if (pinOnly === "true") where += " AND pinned = 1";
    if (favoriteOnly === "true") where += " AND favorite = 1";
    params.push(limit);
    const rows = db
      .prepare(
        `SELECT id, title, personality_id, pinned, favorite, created_at, updated_at, last_message_at,
                (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = conversations.id) AS message_count
         FROM conversations WHERE ${where}
         ORDER BY pinned DESC, updated_at DESC LIMIT ?`,
      )
      .all(...params) as any[];
    res.json({
      conversations: rows.map((r) => ({
        id: r.id,
        title: r.title,
        personalityId: r.personality_id,
        pinned: !!r.pinned,
        favorite: !!r.favorite,
        messageCount: r.message_count,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        lastMessageAt: r.last_message_at,
      })),
    });
  }),
);

const createSchema = z.object({
  title: z.string().max(120).optional(),
  personalityId: z.string().max(40).optional(),
});

router.post(
  "/",
  asyncH(async (req: AuthedRequest, res) => {
    const body = createSchema.parse(req.body);
    const id = genId();
    getDb()
      .prepare(
        `INSERT INTO conversations (id, user_id, title, personality_id) VALUES (?, ?, ?, ?)`,
      )
      .run(id, req.user!.id, body.title?.trim() || "New conversation", body.personalityId || "arpita");
    res.status(201).json({ conversation: { id, title: body.title?.trim() || "New conversation", personalityId: body.personalityId || "arpita", pinned: false, favorite: false, messageCount: 0, createdAt: nowIso(), updatedAt: nowIso(), lastMessageAt: null } });
  }),
);

router.get(
  "/:id",
  asyncH(async (req: AuthedRequest, res) => {
    const row = getConversation(req.user!.id, req.params.id);
    const messages = getDb()
      .prepare(
        "SELECT id, role, content, emotion, reactions, created_at FROM messages WHERE conversation_id = ? ORDER BY created_at ASC",
      )
      .all(req.params.id) as any[];
    res.json({
      conversation: {
        id: row.id,
        title: row.title,
        personalityId: row.personality_id,
        pinned: !!row.pinned,
        favorite: !!row.favorite,
      },
      messages: messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        emotion: JSON.parse(m.emotion || "{}"),
        reactions: JSON.parse(m.reactions || "{}"),
        createdAt: m.created_at,
      })),
    });
  }),
);

const renameSchema = z.object({ title: z.string().min(1).max(120) });
const patchSchema = z.object({
  pinned: z.boolean().optional(),
  favorite: z.boolean().optional(),
  archived: z.boolean().optional(),
  personalityId: z.string().max(40).optional(),
});

router.patch(
  "/:id",
  asyncH(async (req: AuthedRequest, res) => {
    const body = patchSchema.parse(req.body);
    const db = getDb();
    getConversation(req.user!.id, req.params.id); // 404 if not owned
    const sets: string[] = [];
    const params: (string | number)[] = [];
    if (body.pinned !== undefined) { sets.push("pinned = ?"); params.push(body.pinned ? 1 : 0); }
    if (body.favorite !== undefined) { sets.push("favorite = ?"); params.push(body.favorite ? 1 : 0); }
    if (body.archived !== undefined) { sets.push("archived = ?"); params.push(body.archived ? 1 : 0); }
    if (body.personalityId !== undefined) { sets.push("personality_id = ?"); params.push(body.personalityId); }
    if (sets.length) {
      sets.push("updated_at = ?");
      params.push(nowIso(), req.params.id);
      db.prepare(`UPDATE conversations SET ${sets.join(", ")} WHERE id = ?`).run(...params);
    }
    const row = db.prepare("SELECT * FROM conversations WHERE id = ?").get(req.params.id) as any;
    res.json({ conversation: { id: row.id, title: row.title, personalityId: row.personality_id, pinned: !!row.pinned, favorite: !!row.favorite, archived: !!row.archived } });
  }),
);

router.delete(
  "/:id",
  asyncH(async (req: AuthedRequest, res) => {
    const result = getDb()
      .prepare("DELETE FROM conversations WHERE id = ? AND user_id = ?")
      .run(req.params.id, req.user!.id);
    if (!result.changes) throw new ApiError(404, "Conversation not found", "NOT_FOUND");
    audit(req.user!.id, "chat.deleted", req);
    res.json({ ok: true });
  }),
);

router.post(
  "/:id/rename",
  asyncH(async (req: AuthedRequest, res) => {
    const { title } = renameSchema.parse(req.body);
    getConversation(req.user!.id, req.params.id);
    getDb()
      .prepare("UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?")
      .run(title.trim(), nowIso(), req.params.id);
    res.json({ ok: true, title: title.trim() });
  }),
);

const reactSchema = z.object({ emoji: z.string().min(1).max(8) });

router.post(
  "/:id/messages/:messageId/reaction",
  asyncH(async (req: AuthedRequest, res) => {
    const { emoji } = reactSchema.parse(req.body);
    const db = getDb();
    const msg = db
      .prepare("SELECT reactions FROM messages WHERE id = ? AND conversation_id = ? AND user_id = ?")
      .get(req.params.messageId, req.params.id, req.user!.id) as any;
    if (!msg) throw new ApiError(404, "Message not found", "NOT_FOUND");
    const reactions: Record<string, number> = JSON.parse(msg.reactions || "{}");
    if (reactions[emoji]) {
      reactions[emoji]--;
      if (reactions[emoji] <= 0) delete reactions[emoji];
    } else {
      reactions[emoji] = 1;
    }
    db.prepare("UPDATE messages SET reactions = ? WHERE id = ?").run(JSON.stringify(reactions), req.params.messageId);
    res.json({ reactions });
  }),
);

// Plain JSON send (used by voice mode / fallback); the main chat uses SSE.
const sendSchema = z.object({ message: z.string().min(1).max(8000) });

export function getConversation(userId: string, id: string): any {
  const row = getDb()
    .prepare("SELECT * FROM conversations WHERE id = ? AND user_id = ? AND archived = 0")
    .get(id, userId);
  if (!row) throw new ApiError(404, "Conversation not found", "NOT_FOUND");
  return row;
}

export default router;
