import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { config } from "./config.js";

/**
 * Data layer. Uses Node's built-in `node:sqlite` (synchronous, zero native
 * deps) in local/demo mode, so the app runs anywhere Node 22.5+ exists.
 *
 * Production target is Supabase PostgreSQL — see /supabase/schema.sql for the
 * equivalent schema and DATABASE_URL support. All queries are parameterized.
 */
let db: DatabaseSync | null = null;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id                TEXT PRIMARY KEY,
  email             TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash     TEXT NOT NULL,
  name              TEXT NOT NULL DEFAULT '',
  nickname          TEXT NOT NULL DEFAULT '',
  age               INTEGER,
  gender            TEXT NOT NULL DEFAULT '',
  pronouns          TEXT NOT NULL DEFAULT '',
  profession        TEXT NOT NULL DEFAULT '',
  student_working   TEXT NOT NULL DEFAULT '',
  phone             TEXT NOT NULL DEFAULT '',
  timezone          TEXT NOT NULL DEFAULT 'UTC',
  language          TEXT NOT NULL DEFAULT 'en',
  emergency_contact TEXT NOT NULL DEFAULT '{}',
  voice_id          TEXT NOT NULL DEFAULT 'aura',
  avatar_id         TEXT NOT NULL DEFAULT 'leaf',
  personality_id    TEXT NOT NULL DEFAULT 'arpita',
  privacy_consent_at TEXT,
  onboarded_at       TEXT,
  created_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at         TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  last_seen_at       TEXT
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL,
  expires_at  TEXT NOT NULL,
  user_agent  TEXT NOT NULL DEFAULT '',
  revoked_at  TEXT,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_refresh_user ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_hash ON refresh_tokens(token_hash);

CREATE TABLE IF NOT EXISTS conversations (
  id               TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title            TEXT NOT NULL DEFAULT 'New conversation',
  personality_id   TEXT NOT NULL DEFAULT 'gentle-therapist',
  pinned           INTEGER NOT NULL DEFAULT 0,
  favorite         INTEGER NOT NULL DEFAULT 0,
  archived         INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  last_message_at  TEXT
);
CREATE INDEX IF NOT EXISTS idx_conv_user ON conversations(user_id, updated_at);

CREATE TABLE IF NOT EXISTS messages (
  id              TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role            TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
  content         TEXT NOT NULL,
  emotion         TEXT NOT NULL DEFAULT '{}',
  reactions       TEXT NOT NULL DEFAULT '{}',
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_msg_conv ON messages(conversation_id, created_at);

CREATE TABLE IF NOT EXISTS moods (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date        TEXT NOT NULL,               -- YYYY-MM-DD (user-local)
  mood_key    TEXT NOT NULL,               -- calm, anxious, joyful, ...
  score       INTEGER NOT NULL DEFAULT 5,  -- 1..10
  emoji       TEXT NOT NULL DEFAULT '',
  energy      INTEGER,                     -- 1..10
  notes       TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(user_id, date)
);
CREATE INDEX IF NOT EXISTS idx_mood_user ON moods(user_id, date);

CREATE TABLE IF NOT EXISTS journal_entries (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date        TEXT NOT NULL,
  title       TEXT NOT NULL DEFAULT '',
  content     TEXT NOT NULL,
  mood_key    TEXT NOT NULL DEFAULT '',
  tags        TEXT NOT NULL DEFAULT '[]',
  ai_summary  TEXT NOT NULL DEFAULT '',
  is_encrypted INTEGER NOT NULL DEFAULT 0,
  encrypted_payload TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_journal_user ON journal_entries(user_id, date);

CREATE TABLE IF NOT EXISTS journal_vaults (
  user_id       TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  version       INTEGER NOT NULL DEFAULT 1,
  kdf           TEXT NOT NULL,
  iterations    INTEGER NOT NULL,
  salt          TEXT NOT NULL,
  wrap_iv       TEXT NOT NULL,
  wrapped_key   TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS goals (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  category     TEXT NOT NULL DEFAULT 'general',
  target_date  TEXT,
  completed    INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  completed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_goals_user ON goals(user_id, completed);

CREATE TABLE IF NOT EXISTS sessions (
  id               TEXT PRIMARY KEY,
  user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type             TEXT NOT NULL,  -- breathing | meditation | focus | voice
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  mood_before      TEXT NOT NULL DEFAULT '',
  mood_after       TEXT NOT NULL DEFAULT '',
  created_at       TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id, created_at);

CREATE TABLE IF NOT EXISTS memories (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category    TEXT NOT NULL,  -- goal | exam | relationship | coping | communication | preference | event
  content     TEXT NOT NULL,
  importance  INTEGER NOT NULL DEFAULT 1,  -- 1..5
  source      TEXT NOT NULL DEFAULT 'ai',
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_memories_user ON memories(user_id);

CREATE TABLE IF NOT EXISTS auth_codes (
  id         TEXT PRIMARY KEY,
  target     TEXT NOT NULL,          -- phone number or email
  kind       TEXT NOT NULL,          -- 'otp' | 'reset'
  code_hash  TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at    TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_auth_codes_target ON auth_codes(target, kind);

CREATE TABLE IF NOT EXISTS audit_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    TEXT,
  action     TEXT NOT NULL,
  ip         TEXT NOT NULL DEFAULT '',
  user_agent TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user_id, created_at);
`;

export function getDb(): DatabaseSync {
  if (db) return db;
  if (config.dbPath !== ":memory:") {
    fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });
  }
  db = new DatabaseSync(config.dbPath);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec("PRAGMA busy_timeout = 5000;");
  db.exec(SCHEMA);
  // Existing local databases predate the private-diary columns. SQLite's
  // CREATE TABLE IF NOT EXISTS does not add new columns, so migrate safely.
  ensureColumn(db, "journal_entries", "is_encrypted", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn(db, "journal_entries", "encrypted_payload", "TEXT NOT NULL DEFAULT ''");
  return db;
}

function ensureColumn(database: DatabaseSync, table: string, column: string, definition: string): void {
  const columns = database.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!columns.some((item) => item.name === column)) {
    database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

/** Reset all tables — used by tests only. */
export function resetDb(): void {
  const d = getDb();
  d.exec(`
    DELETE FROM messages; DELETE FROM conversations; DELETE FROM moods;
    DELETE FROM journal_entries; DELETE FROM journal_vaults; DELETE FROM goals; DELETE FROM sessions;
    DELETE FROM memories; DELETE FROM refresh_tokens; DELETE FROM users;
    DELETE FROM audit_log;
  `);
}
