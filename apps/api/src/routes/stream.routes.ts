import { Router } from "express";
import { z } from "zod";
import { getDb } from "../db.js";
import { asyncH, ApiError } from "../security.js";
import { requireAuth, AuthedRequest } from "../auth.js";
import { genId, nowIso, truncate } from "../utils.js";
import { detectEmotion, emotionMeta } from "../emotion.js";
import { detectCrisis, crisisResponse } from "../safety.js";
import { getCrisisResources } from "../data/crisis.js";
import { getPersonality } from "../data/personalities.js";
import { streamReply } from "../llm/index.js";
import { recallMemories, saveMemories, extractMemories } from "../memory.js";
import { retrieveResources } from "../llm/rag.js";
import { getConversation } from "./chats.routes.js";
import type { UserRow } from "../types.js";

const router = Router();
router.use(requireAuth);

const streamSchema = z.object({
  conversationId: z.string().max(40).optional(),
  message: z.string().min(1, "Say something first").max(8000),
  personalityId: z.string().max(40).optional(),
  countryCode: z.string().max(3).optional(),
});

function sse(res: any, event: string, data: unknown) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

router.post(
  "/stream",
  asyncH(async (req: AuthedRequest, res) => {
    const body = streamSchema.parse(req.body);
    const db = getDb();
    const userId = req.user!.id;
    const text = body.message.trim();

    // ---- 1. Safety first: crisis detection gates the whole pipeline ----
    const crisis = detectCrisis(text);
    if (crisis.severity !== "none") {
      const conv = ensureConversation(userId, body, text);
      const msgId = saveMessage(userId, conv.id, "user", text, {});
      const resources = getCrisisResources(body.countryCode ?? "GLOBAL");
      const nameRow = db.prepare("SELECT name FROM users WHERE id = ?").get(userId) as { name: string } | undefined;
      const reply = crisisResponse(resources.countryCode, nameRow?.name || "friend");

      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      });
      sse(res, "crisis", { severity: crisis.severity, countryCode: resources.countryCode });
      for (const chunk of splitChunks(reply)) {
        sse(res, "token", { text: chunk });
        await new Promise((r) => setTimeout(r, 18));
      }
      const assistantId = saveMessage(userId, conv.id, "assistant", reply, {
        crisis: true,
        severity: crisis.severity,
      });
      touchConversation(conv.id, text);
      saveMemories(userId, text);
      sse(res, "done", {
        conversationId: conv.id,
        userMessageId: msgId,
        assistantMessageId: assistantId,
        crisis: true,
      });
      res.end();
      return;
    }

    // ---- 2. Emotion analysis ----
    const history = recentMessages(userId, body.conversationId);
    const prevEmotion = lastUserEmotion(userId);
    const emotion = detectEmotion(text, prevEmotion);

    // ---- 3. Conversation, message, context ----
    const conv = ensureConversation(userId, body, text);
    const msgId = saveMessage(userId, conv.id, "user", text, emotion);

    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(userId) as unknown as UserRow;
    const personality = getPersonality(body.personalityId ?? conv.personality_id);
    const memories = recallMemories(userId);
    const newMemories = saveMemories(userId, text);
    const resources = retrieveResources(text);

    const llmHistory = [...history, { role: "user" as const, content: text }].slice(-12);

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });

    // First frame: the estimated emotion so the client can animate the orb.
    sse(res, "emotion", { emotion, meta: emotionMeta(emotion) });

    let full = "";
    try {
      for await (const chunk of streamReply({
        personality,
        emotion,
        user: {
          name: user.name,
          nickname: user.nickname,
          pronouns: user.pronouns,
          language: user.language,
        },
        memories,
        resources,
        history: llmHistory.slice(0, -1),
        userMessage: text,
      })) {
        full += chunk;
        sse(res, "token", { text: chunk });
      }
    } catch (err: any) {
      // Fall back to the local engine if the remote provider fails.
      sse(res, "error", { message: err?.message ?? "Stream failed" });
      console.error("[stream] provider error:", err?.message);
    }

    if (!full) full = "I'm here. Take a breath with me — and tell me a little more when you're ready.";
    const assistantId = saveMessage(userId, conv.id, "assistant", full, { emotion: emotion.primary });
    touchConversation(conv.id, text);
    sse(res, "done", {
      conversationId: conv.id,
      userMessageId: msgId,
      assistantMessageId: assistantId,
      emotion,
      memoriesSaved: newMemories.length,
    });
    res.end();
  }),
);

function ensureConversation(userId: string, body: any, text: string): any {
  const db = getDb();
  if (body.conversationId) return getConversation(userId, body.conversationId);
  const id = genId();
  db.prepare(
    `INSERT INTO conversations (id, user_id, title, personality_id) VALUES (?, ?, ?, ?)`,
  ).run(id, userId, truncate(text, 48), body.personalityId ?? "arpita");
  return { id, personality_id: body.personalityId ?? "arpita" };
}

function saveMessage(userId: string, convId: string, role: "user" | "assistant", content: string, emotion: unknown): string {
  const id = genId();
  getDb()
    .prepare(
      "INSERT INTO messages (id, conversation_id, user_id, role, content, emotion) VALUES (?, ?, ?, ?, ?, ?)",
    )
    .run(id, convId, userId, role, content, JSON.stringify(emotion ?? {}));
  return id;
}

function touchConversation(convId: string, lastText: string): void {
  const db = getDb();
  const conv = db.prepare("SELECT title FROM conversations WHERE id = ?").get(convId) as { title: string } | undefined;
  if (!conv) return;
  db.prepare(
    "UPDATE conversations SET updated_at = ?, last_message_at = ?, title = ? WHERE id = ?",
  ).run(nowIso(), nowIso(), conv.title === "New conversation" ? truncate(lastText, 48) : conv.title, convId);
}

function recentMessages(userId: string, conversationId?: string): { role: "user" | "assistant"; content: string }[] {
  if (!conversationId) return [];
  const rows = getDb()
    .prepare(
      "SELECT role, content FROM messages WHERE conversation_id = ? AND user_id = ? AND role IN ('user','assistant') ORDER BY created_at DESC LIMIT 10",
    )
    .all(conversationId, userId) as any[];
  return rows.reverse().map((r) => ({ role: r.role, content: r.content }));
}

function lastUserEmotion(userId: string): any {
  const row = getDb()
    .prepare(
      "SELECT emotion FROM messages WHERE user_id = ? AND role = 'user' AND emotion != '{}' ORDER BY created_at DESC LIMIT 1",
    )
    .get(userId) as { emotion: string } | undefined;
  if (!row) return undefined;
  try {
    const e = JSON.parse(row.emotion);
    return e.primary || undefined;
  } catch {
    return undefined;
  }
}

function splitChunks(text: string): string[] {
  const chunks: string[] = [];
  const words = text.split(/(\s+)/);
  let buf = "";
  for (const w of words) {
    buf += w;
    if (buf.length >= 8) {
      chunks.push(buf);
      buf = "";
    }
  }
  if (buf) chunks.push(buf);
  return chunks;
}

export default router;
