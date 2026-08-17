import { getDb } from "./db.js";
import { genId, nowIso } from "./utils.js";

export interface Memory {
  id: string;
  userId: string;
  category: string;
  content: string;
  importance: number;
  source: string;
  createdAt: string;
  updatedAt: string;
}

const CATEGORY_RULES: { re: RegExp; category: string; importance: number; label: (m: RegExpMatchArray) => string }[] = [
  {
    re: /\b(exam|test|interview|presentation)\s+(?:is\s+|on\s+|at\s+)?(?:in\s+)?(\w+|\d+\s*(?:th|st|nd|rd)?\s*(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|january|february|march|april|may|june|july|august|september|october|november|december)|\d{1,2}\/\d{1,2}|\d{1,2}\s+days|tomorrow|next\s+week)/i,
    category: "exam",
    importance: 4,
    label: (m) => `Has a ${m[1]} coming up (${m[2] ?? "soon"})`,
  },
  {
    re: /\b(my|i\s+have\s+a|we\s+have\s+a)\s+(goal|target|aim)\s+(is|to)\s+([^.,!?\n]+)/i,
    category: "goal",
    importance: 3,
    label: (m) => `Goal: ${m[4].trim()}`,
  },
  {
    re: /\bi\s+(want|need|would\s+love)\s+to\s+([^.,!?\n]{4,60})/i,
    category: "goal",
    importance: 2,
    label: (m) => `Wants to: ${m[2].trim()}`,
  },
  {
    re: /\b(my\s+)?(boyfriend|girlfriend|partner|husband|wife|fianc[eé]|crush|ex)\b/i,
    category: "relationship",
    importance: 3,
    label: () => "Is navigating a relationship situation",
  },
  {
    re: /\b(i\s+prefer|i\s+like|i\s+love)\s+([^.,!?\n]{4,50})/i,
    category: "preference",
    importance: 2,
    label: (m) => `Prefers: ${m[2].trim()}`,
  },
  {
    re: /\b(meditation|breathing|journaling|running|yoga|walks?|music|podcasts?)\s+helps?\s+(me|with)/i,
    category: "coping",
    importance: 3,
    label: (m) => `Coping tool that helps: ${m[1]}`,
  },
  {
    re: /\b(i\s+work\s+(on|as)|i'm\s+(a|an)\s+)?(student|developer|designer|engineer|freelancer|nurse|teacher|manager|founder|intern)\b/i,
    category: "preference",
    importance: 2,
    label: (m) => `Identity/context: ${m[3] ?? m[2]}`,
  },
  {
    re: /\bmy\s+(mom|dad|mother|father|sister|brother|family|roommate)\b/i,
    category: "relationship",
    importance: 2,
    label: (m) => `Mentioned ${m[1]}`,
  },
];

/** Extract candidate memories from a user message. */
export function extractMemories(text: string): Omit<Memory, "id" | "userId" | "source" | "createdAt" | "updatedAt">[] {
  const out: Omit<Memory, "id" | "userId" | "source" | "createdAt" | "updatedAt">[] = [];
  for (const rule of CATEGORY_RULES) {
    const m = text.match(rule.re);
    if (m) {
      out.push({
        category: rule.category,
        content: rule.label(m),
        importance: rule.importance,
      });
    }
  }
  // De-dupe by content
  const seen = new Set<string>();
  return out.filter((o) => {
    const k = `${o.category}:${o.content}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function saveMemories(userId: string, text: string): Memory[] {
  const db = getDb();
  const candidates = extractMemories(text);
  const saved: Memory[] = [];
  for (const c of candidates) {
    const existing = db
      .prepare("SELECT id FROM memories WHERE user_id = ? AND content = ?")
      .get(userId, c.content);
    if (existing) continue;
    const id = genId();
    db.prepare(
      `INSERT INTO memories (id, user_id, category, content, importance, source, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'ai', ?, ?)`,
    ).run(id, userId, c.category, c.content, c.importance, nowIso(), nowIso());
    saved.push(getMemory(id));
  }
  return saved;
}

export function getMemory(id: string): Memory {
  const row = getDb().prepare("SELECT * FROM memories WHERE id = ?").get(id) as any;
  return mapMemory(row);
}

export function listMemories(userId: string): Memory[] {
  const rows = getDb()
    .prepare("SELECT * FROM memories WHERE user_id = ? ORDER BY importance DESC, created_at DESC")
    .all(userId) as any[];
  return rows.map(mapMemory);
}

export function deleteMemory(userId: string, id: string): boolean {
  const res = getDb().prepare("DELETE FROM memories WHERE id = ? AND user_id = ?").run(id, userId);
  return res.changes > 0;
}

/** Top memories for prompt context (importance-weighted, capped). */
export function recallMemories(userId: string, limit = 6): Memory[] {
  return listMemories(userId).slice(0, limit);
}

function mapMemory(row: any): Memory {
  return {
    id: row.id,
    userId: row.user_id,
    category: row.category,
    content: row.content,
    importance: row.importance,
    source: row.source,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
