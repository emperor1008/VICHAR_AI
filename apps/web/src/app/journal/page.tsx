"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { RequireAuth } from "@/components/RequireAuth";
import { GlassCard } from "@/components/GlassCard";
import { Button } from "@/components/Button";
import {
  DEFAULT_NOTEBOOK_PREFERENCES,
  DiaryEntryPaper,
  NotebookEditor,
  readNotebookPreferences,
  type NotebookPreferences,
} from "@/components/NotebookEditor";
import { AmbientSoundMixer } from "@/components/AmbientSoundMixer";
import { useAuth } from "@/lib/auth";
import { useUndoRedo, type HistoryState } from "@/lib/useUndoRedo";
import { api } from "@/lib/api";
import { greeting, todayLocal, cx } from "@/lib/format";
import type { Mood, JournalEntry } from "@/lib/types";
import {
  createJournalVault,
  decryptJournalValue,
  encryptJournalValue,
  parseEncryptedValue,
  serializeEncryptedValue,
  unlockJournalVault,
  type JournalVaultRecord,
} from "@/lib/journalCrypto";

/* ------------------------------------------------------------------ */
/* Palette & content                                                   */
/* ------------------------------------------------------------------ */

type Tone = "calm" | "anxious" | "sad" | "joy";

const MOOD_CARDS: { key: string; emoji: string; label: string; tone: Tone }[] = [
  { key: "happy", emoji: "😊", label: "Happy", tone: "joy" },
  { key: "calm", emoji: "😌", label: "Calm", tone: "calm" },
  { key: "peaceful", emoji: "🌸", label: "Peaceful", tone: "calm" },
  { key: "loved", emoji: "🥰", label: "Loved", tone: "joy" },
  { key: "hopeful", emoji: "🌈", label: "Hopeful", tone: "joy" },
  { key: "motivated", emoji: "✨", label: "Motivated", tone: "joy" },
  { key: "empty", emoji: "🤍", label: "Empty", tone: "sad" },
  { key: "sad", emoji: "😔", label: "Sad", tone: "sad" },
  { key: "hurt", emoji: "😢", label: "Hurt", tone: "sad" },
  { key: "lonely", emoji: "😞", label: "Lonely", tone: "sad" },
  { key: "tired", emoji: "😴", label: "Tired", tone: "sad" },
  { key: "anxious", emoji: "😟", label: "Anxious", tone: "anxious" },
  { key: "overwhelmed", emoji: "😣", label: "Overwhelmed", tone: "anxious" },
  { key: "angry", emoji: "😡", label: "Angry", tone: "anxious" },
  { key: "confused", emoji: "😕", label: "Confused", tone: "calm" },
];

const DAILY_PROMPTS = [
  "What stayed in your heart today?",
  "What made you smile today?",
  "What challenged you today?",
  "What would you like to let go of?",
  "What are you grateful for?",
  "If today had a colour, what would it be?",
  "What did you learn about yourself today?",
  "What would you tell your younger self?",
  "What made today feel lighter?",
  "Where did you feel safe today?",
  "What is one kind thing you did for yourself?",
  "What is one thing you noticed that others missed?",
  "If you could keep one moment from today, which would it be?",
  "What are you proud of, even in secret?",
  "What does your heart need to hear tonight?",
];

const GRATITUDE_LABELS = [
  "Today I appreciate…",
  "Someone I'm thankful for…",
  "Something beautiful I noticed…",
];

const FLOWERS = ["🌸", "🌼", "🌷", "🪷", "🌺", "🌻", "🪻", "💮"];

/* Selectable background themes (Auto = mood-driven tones below). */
interface Theme {
  id: string;
  label: string;
  emoji: string;
  blobs: [string, string, string];
  paper: string;
}
const THEMES: Theme[] = [
  { id: "desk", label: "Cozy Morning Desk", emoji: "☕", blobs: ["#eab98a", "#f4d9ae", "#8ab6b0"], paper: "from-[#f7ecd9] via-[#f6e3c8] to-[#eef0da]" },
  { id: "sunrise", label: "Sunrise", emoji: "🌅", blobs: ["#f6b26b", "#f9d9a4", "#e8a5a0"], paper: "from-[#fdf1de] via-[#fbe5c8] to-[#f7dcc6]" },
  { id: "rain", label: "Rainy Window", emoji: "🌧", blobs: ["#9fb3c4", "#c3d0da", "#8a9fb4"], paper: "from-[#eef2f5] via-[#e6edf2] to-[#e0e8ef]" },
  { id: "ocean", label: "Ocean", emoji: "🌊", blobs: ["#7fb3c9", "#a5cfd4", "#6d95ab"], paper: "from-[#e8f1f3] via-[#ddecef] to-[#dbe7ef]" },
  { id: "night", label: "Night Sky", emoji: "🌌", blobs: ["#5a6494", "#7a6b9f", "#46527c"], paper: "from-[#f0eef4] via-[#e8e6f0] to-[#e2e4ef]" },
  { id: "blossom", label: "Cherry Blossom", emoji: "🌸", blobs: ["#f3c6d0", "#f6dbe0", "#c9a3c4"], paper: "from-[#fdf0f2] via-[#fbe4ea] to-[#f6e4f0]" },
  { id: "forest", label: "Forest", emoji: "🌿", blobs: ["#8fbf9a", "#b4d4a8", "#7a9f7f"], paper: "from-[#edf4e7] via-[#e2eeda] to-[#dcebd8]" },
  { id: "autumn", label: "Autumn", emoji: "🍂", blobs: ["#d9a05b", "#e8b877", "#c47a4a"], paper: "from-[#f9eeda] via-[#f5e2c2] to-[#f0d9b4]" },
  { id: "candle", label: "Candlelight", emoji: "🕯", blobs: ["#e8b36a", "#f0c98e", "#d99a5b"], paper: "from-[#f8ecd7] via-[#f5e0c0] to-[#f1d3a8]" },
  { id: "coffee", label: "Coffee Shop", emoji: "☕", blobs: ["#c9a381", "#e0bd9a", "#a67c52"], paper: "from-[#f6ead9] via-[#efe0c8] to-[#e9d6b8]" },
];

const TONES: Record<
  Tone,
  { blobs: [string, string, string]; paper: string; whisper: string | null }
> = {
  // Warm desk-at-sunset palette: beige-orange wall, teal accents, cream paper.
  calm: {
    blobs: ["#eab98a", "#f4d9ae", "#8ab6b0"],
    paper: "from-[#f7ecd9] via-[#f6e3c8] to-[#eef0da]",
    whisper: null,
  },
  anxious: {
    blobs: ["#8fb3c4", "#b7cfd8", "#7fa3b8"],
    paper: "from-[#eef2f4] via-[#e7eef3] to-[#eae5ef]",
    whisper: "Take a slow breath before you begin — nothing here has to be perfect.",
  },
  sad: {
    blobs: ["#a8b8c9", "#d9a7a0", "#e2c9a4"],
    paper: "from-[#f0ecea] via-[#eae3e7] to-[#e6e9ee]",
    whisper: "It's okay to write slowly today. You don't have to find the right words.",
  },
  joy: {
    blobs: ["#f2b279", "#f6d7a0", "#e89a7a"],
    paper: "from-[#fdf0d8] via-[#fbe3c4] to-[#f8dcc6]",
    whisper: "Savour this moment — write it down so you can revisit it on a harder day.",
  },
};

interface Insights {
  streak: number;
  bestMood: string | null;
  averageScore: number | null;
  count: number;
  trend: "improving" | "declining" | "stable" | "neutral";
}

interface Draft {
  title: string;
  content: string;
  moods: string[];
  gratitude: string[];
  appearance: NotebookPreferences;
}

const LEGACY_DRAFT_KEY = "vichar:journal:draft";
const SHARED_ENCRYPTED_DRAFT_KEY = "vichar:journal:draft:v2";
const DRAFT_KEY_PREFIX = "vichar:journal:draft:v3";
const THEME_KEY = "vichar:journal:theme";
const FAV_KEY = "vichar:journal:favorites";
function emptyDraft(): Draft {
  return {
    title: "",
    content: "",
    moods: [],
    gratitude: ["", "", ""],
    appearance: { ...DEFAULT_NOTEBOOK_PREFERENCES },
  };
}

interface EncryptedDiaryPayload extends Omit<Draft, "appearance"> {
  format: 1 | 2;
  appearance?: NotebookPreferences;
}

function readingMinutes(content: string): number {
  const words = content.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 180));
}

function dayPrompt(): string {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const day = Math.floor((now.getTime() - start.getTime()) / 86400000);
  return DAILY_PROMPTS[day % DAILY_PROMPTS.length];
}

/* ------------------------------------------------------------------ */
/* The page                                                            */
/* ------------------------------------------------------------------ */

function JournalWorkspace({ diaryKey, onLock }: { diaryKey: CryptoKey; onLock: () => void }) {
  const { user } = useAuth();
  const draftStorageKey = `${DRAFT_KEY_PREFIX}:${user?.id ?? "session"}`;
  const [view, setView] = useState<"home" | "write" | "read">("home");
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [todayMood, setTodayMood] = useState<Mood | null>(null);
  const [insights, setInsights] = useState<Insights | null>(null);
  const [reading, setReading] = useState<JournalEntry | null>(null);
  const [prompt, setPrompt] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(() => emptyDraft());
  const [saving, setSaving] = useState(false);
  const [savedWhisper, setSavedWhisper] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<string>("auto");
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const draftSaveRevision = useRef(0);

  // Undo/Redo for rich editing
  const { setState: setEditorHistory, undo, redo, canUndo, canRedo } = useUndoRedo({
    content: draft.content,
    title: draft.title,
  });

  /* ---- persisted preferences ---- */
  useEffect(() => {
    try {
      const t = localStorage.getItem(THEME_KEY);
      if (t) setTheme(t);
      const f = localStorage.getItem(FAV_KEY);
      if (f) setFavorites(new Set(JSON.parse(f) as string[]));
    } catch { /* ignore */ }
  }, []);

  const pickTheme = useCallback((id: string) => {
    setTheme(id);
    try { localStorage.setItem(THEME_KEY, id); } catch { /* ignore */ }
  }, []);

  const toggleFavorite = useCallback((id: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try { localStorage.setItem(FAV_KEY, JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const updateAppearance = useCallback((appearance: NotebookPreferences) => {
    setDraft((current) => {
      const unchanged = (Object.keys(appearance) as (keyof NotebookPreferences)[])
        .every((key) => current.appearance[key] === appearance[key]);
      return unchanged ? current : { ...current, appearance };
    });
  }, []);

  /* ---- data ---- */
  const load = useCallback(async () => {
    const [journalResult, moodResult, insightResult] = await Promise.allSettled([
      api<{ entries: JournalEntry[] }>("/journal"),
      api<{ mood: Mood | null }>(`/moods/today?date=${todayLocal()}`),
      api<{ insights: Insights }>("/moods/insights"),
    ]);
    if (moodResult.status === "fulfilled") setTodayMood(moodResult.value.mood);
    if (insightResult.status === "fulfilled") setInsights(insightResult.value.insights);
    if (journalResult.status !== "fulfilled") {
      setError("Your diary pages could not be loaded right now. Please check that the Vichar API is running.");
      return;
    }
    setError(null);

    const unlockedEntries = await Promise.all(journalResult.value.entries.map(async (entry) => {
      if (entry.isEncrypted && entry.encryptedPayload) {
        try {
          const payload = await decryptJournalValue<EncryptedDiaryPayload>(diaryKey, parseEncryptedValue(entry.encryptedPayload));
          const gratitude = Array.isArray(payload.gratitude) ? payload.gratitude : [];
          const moods = Array.isArray(payload.moods) ? payload.moods : [];
          return {
            ...entry,
            title: payload.title || "An entry",
            content: payload.content,
            moodKey: moods[0] ?? "",
            tags: moods.slice(1),
            gratitude,
            appearance: payload.appearance ? { ...DEFAULT_NOTEBOOK_PREFERENCES, ...payload.appearance } : { ...DEFAULT_NOTEBOOK_PREFERENCES },
          };
        } catch {
          return { ...entry, title: "Could not decrypt this page", content: "This encrypted entry could not be opened.", moodKey: "" };
        }
      }

      // One-way migration of legacy plaintext entries. Encryption happens in
      // the browser; the server receives only the encrypted replacement.
      try {
        const legacyPayload: EncryptedDiaryPayload = {
          format: 2,
          title: entry.title,
          content: entry.content,
          moods: [entry.moodKey, ...entry.tags].filter(Boolean),
          gratitude: ["", "", ""],
          appearance: { ...DEFAULT_NOTEBOOK_PREFERENCES },
        };
        const encrypted = await encryptJournalValue(diaryKey, legacyPayload);
        await api(`/journal/${entry.id}`, {
          method: "PUT",
          body: JSON.stringify({ encryptedPayload: serializeEncryptedValue(encrypted) }),
        });
      } catch {
        // Keep the readable in-memory copy if migration cannot complete. The
        // next unlock will retry without losing the original entry.
      }
      return entry;
    }));
    setEntries(unlockedEntries);
  }, [diaryKey]);
  useEffect(() => {
    void load();
  }, [load]);

  /* ---- autosave draft ---- */
  useEffect(() => {
    if (view !== "write") return;
    // Start encryption immediately after each change. Unlike a timer-based
    // debounce, this cannot be cancelled when the user quickly taps Back or
    // Lock after typing. The revision guard prevents an older async result
    // from overwriting the newest encrypted draft.
    const revision = ++draftSaveRevision.current;
    const snapshot: EncryptedDiaryPayload = {
      ...draft,
      moods: [...draft.moods],
      gratitude: [...draft.gratitude],
      appearance: { ...draft.appearance },
      format: 2,
    };
    void encryptJournalValue<EncryptedDiaryPayload>(diaryKey, snapshot)
      .then((encrypted) => {
        if (revision === draftSaveRevision.current) {
          localStorage.setItem(draftStorageKey, serializeEncryptedValue(encrypted));
        }
      })
      .catch(() => { /* private mode or crypto failure */ });
  }, [diaryKey, draft, draftStorageKey, view]);

  const startWriting = useCallback(async (withPrompt?: string) => {
    let next = { ...emptyDraft(), appearance: readNotebookPreferences() };
    try {
      const userDraft = localStorage.getItem(draftStorageKey);
      const sharedDraft = userDraft ? null : localStorage.getItem(SHARED_ENCRYPTED_DRAFT_KEY);
      const raw = userDraft ?? sharedDraft;
      if (raw) {
        const decrypted = await decryptJournalValue<EncryptedDiaryPayload>(diaryKey, parseEncryptedValue(raw));
        next = {
          ...emptyDraft(),
          ...decrypted,
          gratitude: Array.isArray(decrypted.gratitude) ? decrypted.gratitude : ["", "", ""],
          moods: Array.isArray(decrypted.moods) ? decrypted.moods : [],
          appearance: { ...DEFAULT_NOTEBOOK_PREFERENCES, ...(decrypted.appearance ?? {}) },
        };
        if (sharedDraft) {
          localStorage.setItem(draftStorageKey, raw);
          localStorage.removeItem(SHARED_ENCRYPTED_DRAFT_KEY);
        }
      } else {
        // Migrate the old plaintext draft only after the private vault is open.
        const legacy = localStorage.getItem(LEGACY_DRAFT_KEY);
        if (legacy) {
          const legacyDraft = JSON.parse(legacy) as Partial<Draft>;
          next = {
            ...next,
            ...legacyDraft,
            appearance: { ...next.appearance, ...(legacyDraft.appearance ?? {}) },
          };
          const encrypted = await encryptJournalValue<EncryptedDiaryPayload>(diaryKey, { ...next, format: 2 });
          localStorage.setItem(draftStorageKey, serializeEncryptedValue(encrypted));
          localStorage.removeItem(LEGACY_DRAFT_KEY);
        }
      }
    } catch { /* ignore corrupt draft */ }
    setDraft(next);
    // Initialize editor history with the draft content
    setEditorHistory({ content: next.content, title: next.title });
    setPrompt(withPrompt ?? null);
    setError(null);
    setSavedWhisper(null);
    setView("write");
    window.scrollTo({ top: 0 });
  }, [diaryKey, draftStorageKey, setEditorHistory]);

  const openEntry = useCallback((e: JournalEntry) => {
    setReading(e);
    setView("read");
    window.scrollTo({ top: 0 });
  }, []);

  async function saveEntry() {
    const body = draft.content.trim();
    if (!body) {
      setError("There's nothing written yet — but that's okay, come back whenever you're ready.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload: EncryptedDiaryPayload = {
        format: 2,
        title: draft.title.trim() || "An entry",
        content: body,
        moods: draft.moods.length ? draft.moods : (todayMood?.moodKey ? [todayMood.moodKey] : []),
        gratitude: draft.gratitude,
        appearance: draft.appearance,
      };
      const encrypted = await encryptJournalValue(diaryKey, payload);
      await api<{ entry: JournalEntry }>("/journal", {
        method: "POST",
        body: JSON.stringify({
          date: todayLocal(),
          encryptedPayload: serializeEncryptedValue(encrypted),
        }),
      });
      // Invalidate any encryption still completing for the just-saved draft
      // before removing it, otherwise a late promise could restore it.
      draftSaveRevision.current += 1;
      localStorage.removeItem(draftStorageKey);
      localStorage.removeItem(SHARED_ENCRYPTED_DRAFT_KEY);
      localStorage.removeItem(LEGACY_DRAFT_KEY);
      setDraft(emptyDraft());
      setPrompt(null);
      setView("home");
      void load();
      setSavedWhisper("Saved and encrypted. Only your diary password can open this page. 🔒");
      setTimeout(() => setSavedWhisper(null), 4000);
    } catch {
      setError("Couldn't save right now — your draft is still here, so nothing is lost.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteEntry(id: string) {
    if (!window.confirm("Delete this entry? It will be gone, but your other pages stay safe.")) return;
    try {
      await api(`/journal/${id}`, { method: "DELETE" });
      setError(null);
      void load();
      setView("home");
    } catch {
      setError("Couldn't delete that entry right now.");
    }
  }

  /* ---- ambient tone ---- */
  const tone: Tone = useMemo(() => {
    if (view === "write" && draft.moods.length) {
      const card = MOOD_CARDS.find((m) => m.key === draft.moods[0]);
      if (card) return card.tone;
    }
    if (todayMood) {
      const map: Record<string, Tone> = {
        anxious: "anxious", overwhelmed: "anxious", frustrated: "anxious",
        sad: "sad", lonely: "sad",
        happy: "joy", joyful: "joy", hopeful: "joy", calm: "calm", neutral: "calm", tired: "sad", angry: "anxious",
      };
      return map[todayMood.moodKey] ?? "calm";
    }
    return "calm";
  }, [view, draft.moods, todayMood]);
  // Theme overrides the mood-driven palette; comfort whisper still follows mood.
  const themed = theme === "auto" ? null : (THEMES.find((th) => th.id === theme) ?? null);
  const t = {
    blobs: themed?.blobs ?? TONES[tone].blobs,
    paper: themed?.paper ?? TONES[tone].paper,
    whisper: TONES[tone].whisper,
  };

  const dust = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => ({
        left: `${(i * 7.3 + 3) % 96}%`,
        size: 3 + (i % 3) * 2,
        dur: 16 + (i % 5) * 5,
        delay: -(i * 2.7),
        opacity: 0.25 + (i % 4) * 0.09,
      })),
    [],
  );

  const firstName = user?.nickname || user?.name?.split(" ")[0] || "friend";
  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  /* ------------------------------------------------------------------ */
  /* Home view                                                           */
  /* ------------------------------------------------------------------ */
  if (view === "home") {
    const promptText = dayPrompt();
    return (
      <main className={cx("jrnl relative min-h-screen overflow-x-hidden bg-gradient-to-br pb-32 pt-6", t.paper)}>
        <Ambience blobs={t.blobs} dust={dust} />

        <div className="relative mx-auto max-w-3xl px-5">
          <TopBar theme={theme} onTheme={pickTheme} onLock={onLock} />
          <BottomNav onNew={() => startWriting()} />

          <section className="fade-up mt-10">
            <p className="jrnl-hand text-2xl text-[#b06a2e] dark:text-[#e8b877]">{today}</p>
            <h1 className="mt-1 font-heading text-3xl font-bold tracking-tight sm:text-4xl">
              {greeting()}, {firstName} 🌿
            </h1>
            <p className="mt-2 font-heading text-lg font-medium text-[#7a6c62] dark:text-[#c9bfb2]">
              How are you feeling today?
            </p>
            <p className="mt-3 max-w-lg leading-relaxed text-warmgray dark:text-[#b0ab9e]">
              Your thoughts are safe here. Nothing you write has to be perfect — this is your private space,
              away from everything else.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-3 text-sm">
              {todayMood ? (
                <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-white/60 px-4 py-1.5 font-medium backdrop-blur dark:bg-white/5">
                  Today&apos;s mood: {todayMood.emoji} {todayMood.moodKey}
                </span>
              ) : (
                <span className="inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-white/60 px-4 py-1.5 font-medium backdrop-blur dark:bg-white/5">
                  No mood logged yet today
                </span>
              )}
              {insights && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-white/60 px-4 py-1.5 font-medium backdrop-blur dark:bg-white/5">
                  🔥 {insights.streak > 0 ? `${insights.streak}-day streak` : "Start your streak today"}
                  {entries.length > 0 && <span className="text-warmgray dark:text-[#b0ab9e]">· {entries.length} page{entries.length === 1 ? "" : "s"}</span>}
                </span>
              )}
            </div>
          </section>

          {savedWhisper && (
            <div className="fade-up mt-5 rounded-2xl border border-[#89ad91]/45 bg-[#edf6ee]/85 px-5 py-3.5 text-sm font-semibold text-[#45684d] shadow-softer backdrop-blur" role="status">
              {savedWhisper}
            </div>
          )}
          {error && (
            <div className="mt-5 rounded-2xl border border-rose-300/60 bg-rose-50/85 px-5 py-3.5 text-sm text-rose-700" role="alert">
              {error}
            </div>
          )}

          {/* Quick actions */}
          <section className="mt-8 grid gap-4 sm:grid-cols-2">
            <button
              onClick={() => startWriting()}
              className="focus-ring group rounded-3xl border border-[var(--border)] bg-white/70 p-6 text-left shadow-soft backdrop-blur transition-all hover:-translate-y-0.5 hover:border-[#e2a86b]/70 dark:bg-white/5"
            >
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-[#f0a35e] to-[#e07d3f] text-xl shadow-soft">
                ✍️
              </span>
              <p className="mt-4 font-heading text-lg font-semibold">New entry</p>
              <p className="mt-1 text-sm leading-relaxed text-warmgray dark:text-[#b0ab9e]">
                A blank page, waiting just for you. No pressure.
              </p>
            </button>
            <button
              onClick={() => startWriting(promptText)}
              className="focus-ring group rounded-3xl border border-[var(--border)] bg-white/70 p-6 text-left shadow-soft backdrop-blur transition-all hover:-translate-y-0.5 hover:border-[#e2a86b]/70 dark:bg-white/5"
            >
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-[#8ab6b0] to-[#6d9590] text-xl shadow-soft">
                🕊️
              </span>
              <p className="mt-4 font-heading text-lg font-semibold">Quick reflection</p>
              <p className="jrnl-hand mt-1 text-xl leading-snug text-[#3a2e26] dark:text-[#e8e4da]">“{promptText}”</p>
            </button>
          </section>

          {/* Daily prompt */}
          <GlassCard className="mt-6 p-6 sm:p-7">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-warmgray dark:text-[#b0ab9e]">
              Today&apos;s gentle prompt
            </p>
            <p className="jrnl-hand mt-1 text-2xl font-medium leading-snug text-[#3a2e26] dark:text-[#e8e4da]">“{promptText}”</p>
            <Button size="sm" className="btn-warm mt-4" onClick={() => startWriting(promptText)}>
              Write with this prompt
            </Button>
          </GlassCard>

          {/* Memory garden */}
          {entries.length > 0 && (
            <GlassCard className="mt-6 p-6 sm:p-7">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-warmgray dark:text-[#b0ab9e]">
                Your memory garden
              </p>
              <p className="mt-1 text-sm text-warmgray dark:text-[#b0ab9e]">
                Every entry blooms here — this is your emotional growth, gently growing.
              </p>
              <div className="mt-5 flex flex-wrap items-end gap-3">
                {entries.slice(0, 14).map((e, i) => (
                  <button
                    key={e.id}
                    onClick={() => openEntry(e)}
                    aria-label={`Open entry from ${e.date}`}
                    className={cx(
                      "jrnl-bloom focus-ring grid h-10 w-10 place-items-center rounded-full text-xl transition-transform hover:scale-110",
                      i === 0 && "jrnl-glow",
                    )}
                    style={{ animationDelay: `${i * 0.12}s` }}
                  >
                    {FLOWERS[i % FLOWERS.length]}
                  </button>
                ))}
                {entries.length > 14 && (
                  <span className="text-sm text-warmgray dark:text-[#b0ab9e]">+{entries.length - 14} more</span>
                )}
              </div>
            </GlassCard>
          )}

          {/* Recent entries */}
          <section className="mt-6">
            <h2 className="font-heading text-lg font-semibold">Your pages</h2>
            {entries.length === 0 ? (
              <GlassCard className="mt-4 p-10 text-center">
                <span className="text-4xl" aria-hidden>🌱</span>
                <p className="jrnl-hand mt-4 text-3xl font-medium text-[#3a2e26] dark:text-[#e8e4da]">
                  Every beautiful story begins with the first page.
                </p>
                <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-warmgray dark:text-[#b0ab9e]">
                  Your journal is waiting to hold today&apos;s thoughts. Whenever you&apos;re ready, it will be here.
                </p>
                <Button className="btn-warm mt-6" onClick={() => startWriting()}>
                  Begin your first entry
                </Button>
              </GlassCard>
            ) : (
              <ul className="mt-4 space-y-3">
                {entries.map((e) => {
                  const mood = MOOD_CARDS.find((m) => m.key === e.moodKey);
                  return (
                    <li key={e.id}>
                      <div className="group relative rounded-2xl border border-[var(--border)] bg-white/70 shadow-soft backdrop-blur transition-all hover:-translate-y-0.5 hover:border-[#e2a86b]/70 dark:bg-white/5">
                        <button
                          type="button"
                          onClick={() => openEntry(e)}
                          className="focus-ring w-full rounded-2xl p-5 pr-16 text-left"
                        >
                          <div className="flex items-center gap-3">
                          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/70 text-xl shadow-sm dark:bg-white/10">
                            {mood?.emoji ?? "📓"}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-heading text-base font-semibold">{e.title}</p>
                            <p className="text-sm text-warmgray dark:text-[#b0ab9e]">
                              {new Date(e.date + "T00:00:00").toLocaleDateString(undefined, {
                                weekday: "short",
                                month: "short",
                                day: "numeric",
                              })}{" "}
                              · {readingMinutes(e.content)} min read
                            </p>
                          </div>
                          </div>
                          {e.content && (
                            <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-warmgray dark:text-[#b0ab9e]">
                              {e.content}
                            </p>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleFavorite(e.id)}
                          aria-label={favorites.has(e.id) ? "Remove from favourites" : "Add to favourites"}
                          aria-pressed={favorites.has(e.id)}
                          className={cx(
                            "focus-ring absolute right-4 top-5 grid h-9 w-9 place-items-center rounded-full text-lg transition-transform hover:scale-110",
                            favorites.has(e.id) ? "text-[#d95f5f]" : "text-warmgray opacity-60 hover:opacity-100 dark:text-[#b0ab9e]",
                          )}
                        >
                          {favorites.has(e.id) ? "♥" : "♡"}
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </main>
    );
  }

  /* ------------------------------------------------------------------ */
  /* Read view                                                           */
  /* ------------------------------------------------------------------ */
  if (view === "read" && reading) {
    const mood = MOOD_CARDS.find((m) => m.key === reading.moodKey);
    return (
      <main className={cx("jrnl relative min-h-screen overflow-x-hidden bg-gradient-to-br pb-32 pt-6", t.paper)}>
        <Ambience blobs={t.blobs} dust={dust} />
        <div className="relative mx-auto max-w-3xl px-5">
          <TopBar theme={theme} onTheme={pickTheme} onLock={onLock} />
          <BottomNav onNew={() => startWriting()} />

          <div className="jrnl-view mt-10">
            <button onClick={() => setView("home")} className="focus-ring inline-flex items-center gap-2 text-sm font-semibold text-warmgray transition-colors hover:text-[var(--matcha)] dark:text-[#b0ab9e]">
              ← Back to journal
            </button>

            <div className="mt-5 flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-2 rounded-full bg-white/70 px-4 py-1.5 text-sm font-medium backdrop-blur dark:bg-white/10">
                  {mood?.emoji ?? "📓"} {mood?.label ?? "Entry"}
                </span>
                <span className="rounded-full bg-white/55 px-4 py-1.5 text-xs font-semibold text-warmgray backdrop-blur dark:bg-white/5">🔐 Decrypted on this device</span>
            </div>

            <div className="mt-4">
              <DiaryEntryPaper
                title={reading.title}
                content={reading.content}
                date={reading.date}
                gratitude={reading.gratitude}
                appearance={reading.appearance}
              />
            </div>

            {error && (
              <div className="mt-5 rounded-2xl border border-rose-300/60 bg-rose-50/85 px-5 py-3.5 text-sm text-rose-700" role="alert">
                {error}
              </div>
            )}

            <GlassCard className="mt-5 p-5">
              <div className="flex flex-wrap items-center gap-3">
                <Button className="btn-warm" onClick={() => startWriting()}>Keep writing</Button>
                <Button
                  variant="ghost"
                  onClick={() => toggleFavorite(reading.id)}
                  aria-pressed={favorites.has(reading.id)}
                  className={favorites.has(reading.id) ? "!text-[#d95f5f]" : undefined}
                >
                  {favorites.has(reading.id) ? "♥ Favourite" : "♡ Favourite"}
                </Button>
                <Button variant="danger" onClick={() => deleteEntry(reading.id)}>
                  Delete this page
                </Button>
              </div>
            </GlassCard>
          </div>
        </div>
      </main>
    );
  }

  /* ------------------------------------------------------------------ */
  /* Write view                                                          */
  /* ------------------------------------------------------------------ */
  const anxious = tone === "anxious";
  const selectedMoods = new Set(draft.moods);

  function toggleMood(key: string) {
    setDraft((d) => {
      const has = d.moods.includes(key);
      const moods = has ? d.moods.filter((m) => m !== key) : [...d.moods, key];
      return { ...d, moods };
    });
  }

  return (
    <main className={cx("jrnl relative min-h-screen overflow-x-hidden bg-gradient-to-br pb-32 pt-6", t.paper)}>
      <Ambience blobs={t.blobs} dust={dust} />
      <div className="relative mx-auto max-w-3xl px-5">
        <TopBar theme={theme} onTheme={pickTheme} onLock={onLock} />
        <BottomNav onNew={() => startWriting()} />

        <div className="jrnl-view mt-8">
          <button onClick={() => { setView("home"); setPrompt(null); }} className="focus-ring inline-flex items-center gap-2 text-sm font-semibold text-warmgray transition-colors hover:text-[var(--matcha)] dark:text-[#b0ab9e]">
            ← Back to journal
          </button>

          {prompt && (
            <GlassCard className="mt-5 flex items-start gap-4 p-5">
              <span className="text-2xl" aria-hidden>🕊️</span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-warmgray dark:text-[#b0ab9e]">
                  Today&apos;s gentle prompt
                </p>
                <p className="jrnl-hand mt-0.5 text-2xl font-medium leading-snug text-[#3a2e26] dark:text-[#e8e4da]">“{prompt}”</p>
              </div>
            </GlassCard>
          )}

          {t.whisper && (
            <p className="jrnl-hand mt-5 text-center text-xl text-[#7a6c62] dark:text-[#c9bfb2]">“{t.whisper}”</p>
          )}

          {/* A little coffee cup with rising steam — the cozy desk feeling */}
          <div className="jrnl-cup pointer-events-none absolute right-8 top-40 hidden select-none opacity-80 sm:block" aria-hidden>
            <span className="jrnl-steam" />
            <span className="jrnl-steam" />
            <span className="jrnl-steam" />
            <span className="block text-4xl drop-shadow-[0_6px_10px_rgba(107,79,58,0.35)]">☕</span>
          </div>

          {/* Premium Notebook Editor */}
          <div className="mt-5">
            <NotebookEditor
              value={draft.content}
              onChange={(content) => {
                setDraft((d) => ({ ...d, content }));
                setEditorHistory({ content, title: draft.title });
              }}
              title={draft.title}
              onTitleChange={(title) => {
                setDraft((d) => ({ ...d, title }));
                setEditorHistory({ content: draft.content, title });
              }}
              onUndo={() => {
                const prev = undo();
                setDraft((d) => ({ ...d, content: prev.content, title: prev.title }));
              }}
              onRedo={() => {
                const next = redo();
                setDraft((d) => ({ ...d, content: next.content, title: next.title }));
              }}
              canUndo={canUndo}
              canRedo={canRedo}
              initialPreferences={draft.appearance}
              onPreferencesChange={updateAppearance}
            />
          </div>

          {/* Mood picker */}
          <section className="mt-8">
            <h2 className="font-heading text-lg font-semibold">How did this make you feel?</h2>
            <p className="mt-1 text-sm text-warmgray dark:text-[#b0ab9e]">
              You can pick more than one — the first one becomes this page&apos;s colour.
            </p>
            <div className="mt-4 grid grid-cols-3 gap-2.5 sm:grid-cols-4">
              {MOOD_CARDS.map((m) => {
                const on = selectedMoods.has(m.key);
                return (
                  <button
                    key={m.key}
                    onClick={() => toggleMood(m.key)}
                    aria-pressed={on}
                    className={cx(
                      "focus-ring flex flex-col items-center gap-1.5 rounded-2xl border border-[var(--border)] bg-white/60 px-2 py-4 text-sm font-medium transition-all hover:border-[#e2a86b]/70 dark:bg-white/5",
                      on && "jrnl-mood-selected border-transparent bg-white/80 dark:bg-white/10",
                    )}
                  >
                    <span className="text-2xl">{m.emoji}</span>
                    {m.label}
                  </button>
                );
              })}
            </div>
          </section>

          {/* Gratitude */}
          <GlassCard className="mt-8 p-6 sm:p-7">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-warmgray dark:text-[#b0ab9e]">
              A small gratitude pause
            </p>
            <p className="mt-1 text-sm text-warmgray dark:text-[#b0ab9e]">
              Optional — three tiny things, however simple.
            </p>
            <div className="mt-4 space-y-3">
              {GRATITUDE_LABELS.map((label, i) => (
                <input
                  key={label}
                  value={draft.gratitude[i] ?? ""}
                  onChange={(e) =>
                    setDraft((d) => {
                      const g = [...d.gratitude];
                      g[i] = e.target.value;
                      return { ...d, gratitude: g };
                    })
                  }
                  placeholder={label}
                  aria-label={label}
                  className="focus-ring w-full rounded-xl border border-[var(--border)] bg-white/60 px-4 py-3 text-sm outline-none placeholder:text-warmgray/60 backdrop-blur dark:bg-white/5 dark:placeholder:text-[#b0ab9e]/60"
                />
              ))}
            </div>
          </GlassCard>

          {/* Grounding when anxious */}
          {anxious && (
            <GlassCard className="mt-8 flex items-center gap-6 p-6">
              <span className="jrnl-breathe grid h-16 w-16 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#8fb3c4] to-[#6d95ab] text-sm font-semibold text-white shadow-soft" aria-hidden>
                in… out…
              </span>
              <div>
                <p className="font-heading text-base font-semibold">Before you go on — one slow breath.</p>
                <p className="mt-1 text-sm leading-relaxed text-warmgray dark:text-[#b0ab9e]">
                  Breathe in for four, out for six. If your thoughts are racing, try naming five things you can
                  see right now. Then return to the page — it will still be here.
                </p>
              </div>
            </GlassCard>
          )}

          {error && (
            <p className="mt-6 rounded-2xl border border-rose-300/60 bg-rose-50/80 px-5 py-3.5 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-950/30 dark:text-rose-300">
              {error}
            </p>
          )}

          <div className="mt-8 flex flex-col items-center gap-3">
            <Button size="lg" className="btn-warm w-full sm:w-auto" onClick={saveEntry} disabled={saving}>
              {saving ? "Saving…" : "Save this page"} 🌿
            </Button>
            <p className="text-xs text-warmgray dark:text-[#b0ab9e]">
              Your draft is saved as you type — this page is always here when you need it.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}

function playUnlockChime() {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AC();
    const gain = ctx.createGain();
    const oscillator = ctx.createOscillator();
    const now = ctx.currentTime;
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(420, now);
    oscillator.frequency.exponentialRampToValueAtTime(760, now + 0.18);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.07, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.34);
    window.setTimeout(() => ctx.close().catch(() => {}), 500);
  } catch { /* sound is optional */ }
}

const COVER_KEY = "vichar:journal:cover:v1";
const DIARY_COVERS = [
  { id: "rosewood", label: "Rosewood", icon: "🌸", marks: ["🌸", "🌿"], colours: ["#b7655b", "#8e4a43", "#743b37"], border: "#7b3e37" },
  { id: "matcha", label: "Matcha", icon: "🍃", marks: ["🍃", "🌼"], colours: ["#8fa579", "#667c59", "#4f6548"], border: "#506247" },
  { id: "lavender", label: "Lavender", icon: "🪻", marks: ["🪻", "✨"], colours: ["#a18aaf", "#796b92", "#5d5379"], border: "#5c5070" },
  { id: "midnight", label: "Midnight", icon: "🌙", marks: ["🌙", "✦"], colours: ["#536785", "#394b69", "#273750"], border: "#2d3c55" },
] as const;

function PrivateDiaryVault() {
  const { user } = useAuth();
  const [vault, setVault] = useState<JournalVaultRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [diaryKey, setDiaryKey] = useState<CryptoKey | null>(null);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [opening, setOpening] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [capsLock, setCapsLock] = useState(false);
  const [coverId, setCoverId] = useState<(typeof DIARY_COVERS)[number]["id"]>("rosewood");
  const openingTimer = useRef<number | null>(null);

  useEffect(() => {
    api<{ configured: boolean; vault: JournalVaultRecord | null }>("/journal/vault")
      .then((data) => setVault(data.vault))
      .catch(() => setError("The private diary could not connect. Please make sure the Vichar API is running."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(COVER_KEY);
      if (DIARY_COVERS.some((cover) => cover.id === saved)) {
        setCoverId(saved as (typeof DIARY_COVERS)[number]["id"]);
      }
    } catch { /* use the rosewood cover */ }
  }, []);

  const pickCover = useCallback((id: (typeof DIARY_COVERS)[number]["id"]) => {
    setCoverId(id);
    try { localStorage.setItem(COVER_KEY, id); } catch { /* preference is optional */ }
  }, []);

  const finishOpening = useCallback((key: CryptoKey) => {
    playUnlockChime();
    setOpening(true);
    const delay = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 120 : 1450;
    if (openingTimer.current !== null) window.clearTimeout(openingTimer.current);
    openingTimer.current = window.setTimeout(() => {
      setDiaryKey(key);
      setPassword("");
      setConfirmation("");
      setOpening(false);
      setBusy(false);
      openingTimer.current = null;
    }, delay);
  }, []);

  const lockDiary = useCallback(() => {
    if (openingTimer.current !== null) {
      window.clearTimeout(openingTimer.current);
      openingTimer.current = null;
    }
    setDiaryKey(null);
    setPassword("");
    setConfirmation("");
    setOpening(false);
    setBusy(false);
    setError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  useEffect(() => () => {
    if (openingTimer.current !== null) window.clearTimeout(openingTimer.current);
  }, []);

  // Clear the unlocked workspace after five minutes without activity. The
  // component unmount removes all decrypted journal text from React state.
  useEffect(() => {
    if (!diaryKey) return;
    let timer = window.setTimeout(lockDiary, 5 * 60 * 1000);
    const reset = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(lockDiary, 5 * 60 * 1000);
    };
    const events: (keyof WindowEventMap)[] = ["pointerdown", "keydown", "scroll"];
    events.forEach((event) => window.addEventListener(event, reset, { passive: true }));
    return () => {
      window.clearTimeout(timer);
      events.forEach((event) => window.removeEventListener(event, reset));
    };
  }, [diaryKey, lockDiary]);

  // If the user leaves the diary tab hidden, close the decrypted workspace.
  useEffect(() => {
    if (!diaryKey) return;
    let hiddenTimer: number | null = null;
    const onVisibility = () => {
      if (document.hidden) {
        if (hiddenTimer !== null) window.clearTimeout(hiddenTimer);
        hiddenTimer = window.setTimeout(lockDiary, 60_000);
      } else if (hiddenTimer !== null) {
        window.clearTimeout(hiddenTimer);
        hiddenTimer = null;
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      if (hiddenTimer !== null) window.clearTimeout(hiddenTimer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [diaryKey, lockDiary]);

  async function handleVault(event: React.FormEvent) {
    event.preventDefault();
    if (busy || opening) return;
    setError(null);
    if (password.length < 10) {
      setError("Use at least 10 characters so your private diary is harder to guess.");
      return;
    }
    if (!vault && password !== confirmation) {
      setError("The two passwords do not match yet.");
      return;
    }
    setBusy(true);
    try {
      if (vault) {
        const key = await unlockJournalVault(password, vault);
        finishOpening(key);
      } else {
        const created = await createJournalVault(password);
        await api("/journal/vault", { method: "PUT", body: JSON.stringify(created.vault) });
        setVault(created.vault);
        finishOpening(created.diaryKey);
      }
    } catch {
      setBusy(false);
      setError(vault ? "That password did not open your diary. Please try again." : "Your diary could not be secured right now. Please try again.");
    }
  }

  if (diaryKey) return <JournalWorkspace diaryKey={diaryKey} onLock={lockDiary} />;

  const firstName = user?.nickname || user?.name?.split(" ")[0] || "My";
  const ownerLabel = firstName === "My" ? "My" : `${firstName}’s`;
  const cover = DIARY_COVERS.find((item) => item.id === coverId) ?? DIARY_COVERS[0];
  const coverStyle = {
    "--vault-cover-one": cover.colours[0],
    "--vault-cover-two": cover.colours[1],
    "--vault-cover-three": cover.colours[2],
    "--vault-cover-border": cover.border,
  } as React.CSSProperties;
  const passwordStrength = [
    password.length >= 10,
    password.length >= 14,
    /[A-Z]/.test(password) && /[a-z]/.test(password),
    /\d/.test(password) || /[^A-Za-z0-9]/.test(password),
  ].filter(Boolean).length;
  const strengthLabel = ["Start typing", "Needs more", "Fair", "Good", "Strong"][passwordStrength];
  return (
    <main className="jrnl jrnl-vault-stage relative min-h-screen overflow-hidden bg-gradient-to-br from-[#f7e8d2] via-[#f9efe3] to-[#dfe9db] px-5 py-8">
      <div className="jrnl-vault-blob jrnl-vault-blob-one" />
      <div className="jrnl-vault-blob jrnl-vault-blob-two" />
      <div className="relative mx-auto flex min-h-[calc(100vh-4rem)] max-w-5xl flex-col">
        <header className="flex items-center justify-between">
          <Link href="/home" className="focus-ring rounded-full bg-white/55 px-4 py-2 text-sm font-semibold shadow-softer backdrop-blur">← Home</Link>
          <span className="rounded-full border border-white/60 bg-white/45 px-4 py-2 text-xs font-semibold text-[#6b5546] backdrop-blur">🔐 Client-side encrypted</span>
        </header>

        <div className="grid flex-1 place-items-center py-8">
          <div className="w-full max-w-xl text-center">
            <p className="jrnl-hand text-2xl text-[#a96738]">A quiet place that belongs only to you</p>
            <h1 className="mt-2 font-heading text-3xl font-bold text-[#4a3427] sm:text-4xl">{vault ? "Welcome back to your diary" : "Create your private diary"}</h1>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-[#786456]">
              {vault
                ? "Your pages remain encrypted until the correct password opens this book."
                : "Choose a separate diary password. Vichar stores encrypted pages, not readable journal text."}
            </p>

            <div className={cx("jrnl-vault-book mx-auto mt-8", opening && "is-opening", error && "has-error")} style={coverStyle}>
              <div className="jrnl-vault-pages" aria-hidden />
              <div className="jrnl-vault-inside" aria-hidden>
                <span>🔓</span>
                <p className="jrnl-hand">Welcome to your quiet place</p>
              </div>
              <div className="jrnl-vault-cover">
                <span className="jrnl-vault-corner jrnl-vault-corner-a" aria-hidden>{cover.marks[0]}</span>
                <span className="jrnl-vault-corner jrnl-vault-corner-b" aria-hidden>{cover.marks[1]}</span>
                <div className="jrnl-vault-label">
                  <span className="text-2xl">❦</span>
                  <p className="jrnl-hand mt-2 text-3xl font-bold">{ownerLabel} Private Diary</p>
                  <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.28em] opacity-65">thoughts · dreams · little moments</p>
                </div>
                <div className="jrnl-vault-strap" aria-hidden />
                <div className="jrnl-vault-lock" aria-hidden>
                  <span className="jrnl-vault-shackle" />
                  <span className="jrnl-vault-lockbody">⌁</span>
                </div>
              </div>
            </div>

            <div className="mx-auto mt-5 flex max-w-md flex-wrap justify-center gap-2" aria-label="Choose diary cover">
              {DIARY_COVERS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => pickCover(item.id)}
                  aria-pressed={coverId === item.id}
                  className={cx(
                    "focus-ring rounded-full border px-3 py-1.5 text-xs font-semibold backdrop-blur transition-all",
                    coverId === item.id ? "border-[#6b5546] bg-white/85 shadow-softer" : "border-white/60 bg-white/40 text-[#786456] hover:bg-white/70",
                  )}
                >
                  {item.icon} {item.label}
                </button>
              ))}
            </div>

            <form onSubmit={handleVault} className="mx-auto mt-5 max-w-md rounded-3xl border border-white/70 bg-white/65 p-5 text-left shadow-soft backdrop-blur">
              {loading ? (
                <p className="py-5 text-center text-sm font-semibold text-[#786456]">Preparing your private space…</p>
              ) : (
                <>
                  <label className="text-xs font-semibold text-[#6b5546]">
                    {vault ? "Diary password" : "Create diary password"}
                    <div className="mt-2 flex rounded-2xl border border-[#d7c1aa] bg-white/80 p-1 focus-within:ring-2 focus-within:ring-[#dc9d6f]/35">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(event) => { setPassword(event.target.value); setError(null); }}
                        onKeyUp={(event) => setCapsLock(event.getModifierState("CapsLock"))}
                        onBlur={() => setCapsLock(false)}
                        autoComplete={vault ? "current-password" : "new-password"}
                        placeholder="At least 10 characters"
                        className="min-w-0 flex-1 bg-transparent px-3 py-2.5 text-sm outline-none"
                        disabled={busy || opening}
                        autoFocus
                      />
                      <button type="button" onClick={() => setShowPassword((show) => !show)} className="focus-ring rounded-xl px-3 text-xs font-semibold text-[#786456]">{showPassword ? "Hide" : "Show"}</button>
                    </div>
                    {capsLock && <span className="mt-1.5 block text-[11px] font-medium text-amber-700">Caps Lock is on</span>}
                  </label>
                  {!vault && (
                    <label className="mt-3 block text-xs font-semibold text-[#6b5546]">
                      Confirm diary password
                      <input type={showPassword ? "text" : "password"} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="new-password" className="focus-ring mt-2 w-full rounded-2xl border border-[#d7c1aa] bg-white/80 px-4 py-3 text-sm outline-none" disabled={busy || opening} />
                    </label>
                  )}
                  {!vault && password.length > 0 && (
                    <div className="mt-3" aria-label={`Password strength: ${strengthLabel}`}>
                      <div className="flex gap-1.5">
                        {[1, 2, 3, 4].map((level) => (
                          <span key={level} className={cx("h-1.5 flex-1 rounded-full", level <= passwordStrength ? "bg-[#6f9f83]" : "bg-[#d8cdc1]")} />
                        ))}
                      </div>
                      <p className="mt-1.5 text-[11px] text-[#786456]">{strengthLabel} · a longer passphrase is easier to remember and harder to guess.</p>
                    </div>
                  )}
                  {error && <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2.5 text-xs font-medium text-rose-700" role="alert">{error}</p>}
                  <button type="submit" disabled={busy || opening} className="btn-warm focus-ring mt-4 w-full px-5 py-3 text-sm disabled:opacity-50">
                    {opening ? "Opening your diary…" : busy ? "Checking the lock…" : vault ? "Unlock and open diary" : "Secure and open diary"}
                  </button>
                  {!vault && <p className="mt-3 text-center text-[11px] leading-relaxed text-[#897466]">Important: if you forget this password, the encrypted pages cannot be recovered. Vichar never receives or stores it.</p>}
                </>
              )}
            </form>
            <div className="mx-auto mt-4 grid max-w-md grid-cols-3 gap-2 text-center text-[10px] font-semibold text-[#786456] sm:text-[11px]">
              <span className="rounded-2xl bg-white/40 px-2 py-2.5">🔐 Password stays here</span>
              <span className="rounded-2xl bg-white/40 px-2 py-2.5">🛡️ AES-256 encrypted</span>
              <span className="rounded-2xl bg-white/40 px-2 py-2.5">⏳ Auto-locks privately</span>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

/* ------------------------------------------------------------------ */
/* Shared pieces                                                       */
/* ------------------------------------------------------------------ */

function Ambience({ blobs, dust }: { blobs: [string, string, string]; dust: { left: string; size: number; dur: number; delay: number; opacity: number }[] }) {
  return (
    <>
      <div className="jrnl-blob left-[-8vw] top-[-10vh] h-[46vh] w-[46vw]" style={{ background: blobs[0] }} />
      <div className="jrnl-blob right-[-10vw] top-[30vh] h-[42vh] w-[42vw]" style={{ background: blobs[1] }} />
      <div className="jrnl-blob bottom-[-14vh] left-[24vw] h-[40vh] w-[40vw]" style={{ background: blobs[2] }} />
      {dust.map((d, i) => (
        <span
          key={i}
          className="jrnl-dust"
          style={{
            left: d.left,
            width: d.size,
            height: d.size,
            animationDuration: `${d.dur}s`,
            animationDelay: `${d.delay}s`,
            opacity: d.opacity,
          }}
        />
      ))}
    </>
  );
}

function TopBar({
  theme,
  onTheme,
  onLock,
}: {
  theme: string;
  onTheme: (id: string) => void;
  onLock: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <header className="flex flex-wrap items-center justify-between gap-3">
      <Link href="/home" className="flex items-center gap-2.5" aria-label="Back to home">
        <span className="font-heading text-lg font-semibold tracking-tight">
          Journal <span className="font-normal text-warmgray dark:text-[#b0ab9e]">· your sanctuary</span>
        </span>
      </Link>
      <div className="flex items-center gap-2">
        {/* Theme picker */}
        <div className="relative">
          <button
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-label="Choose a background theme"
            title="Background theme"
            className="focus-ring grid h-9 w-9 place-items-center rounded-full border border-[var(--border)] bg-white/60 text-base backdrop-blur transition-colors hover:border-[#e2a86b]/70 dark:bg-white/5"
          >
            {THEMES.find((th) => th.id === theme)?.emoji ?? "🎨"}
          </button>
          {open && (
            <div className="absolute right-0 top-full z-50 mt-2 w-60 rounded-2xl border border-[var(--border)] bg-[#fffaf1]/95 p-2 shadow-soft backdrop-blur dark:bg-[#2a2118]/95">
              <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-[0.16em] text-warmgray dark:text-[#b0ab9e]">
                Background mood
              </p>
              <button
                onClick={() => { onTheme("auto"); setOpen(false); }}
                className={cx(
                  "focus-ring flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-semibold transition-colors",
                  theme === "auto" ? "bg-[#f0a35e]/20 text-[#8a4a1f] dark:text-[#f0c9a0]" : "hover:bg-[#f0a35e]/10",
                )}
              >
                🎨 Auto · follow my mood
              </button>
              <div className="my-1.5 h-px bg-[var(--border)]" />
              {THEMES.map((th) => (
                <button
                  key={th.id}
                  onClick={() => { onTheme(th.id); setOpen(false); }}
                  className={cx(
                    "focus-ring flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-semibold transition-colors",
                    theme === th.id ? "bg-[#f0a35e]/20 text-[#8a4a1f] dark:text-[#f0c9a0]" : "hover:bg-[#f0a35e]/10",
                  )}
                >
                  <span>{th.emoji}</span> {th.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <AmbientSoundMixer />
        <button
          type="button"
          onClick={onLock}
          className="focus-ring rounded-full border border-[var(--border)] bg-white/60 px-3.5 py-2 text-sm font-semibold backdrop-blur transition-colors hover:border-[#b87946] dark:bg-white/5"
          title="Lock private diary"
        >
          🔒 Lock
        </button>
      </div>
    </header>
  );
}

function BottomNav({ onNew }: { onNew: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="jrnl-nav" aria-label="Journal navigation">
      <Link href="/home" className={cx("jrnl-nav-link", pathname === "/home" && "text-[#3a2e26] dark:text-[#f0e8dc]")}>
        🏠 Home
      </Link>
      <Link
        href="/journal"
        className="jrnl-nav-link"
        aria-current={pathname === "/journal" ? "page" : undefined}
      >
        📓 Journal
      </Link>
      <button onClick={onNew} className="jrnl-nav-add focus-ring" aria-label="New entry">
        ＋
      </button>
    </nav>
  );
}

export default function JournalPage() {
  return (
    <RequireAuth>
      <PrivateDiaryVault />
    </RequireAuth>
  );
}
