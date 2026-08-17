"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { cx } from "@/lib/format";
import type { JournalAppearance } from "@/lib/types";

export type NotebookPreferences = JournalAppearance;

const FONT_OPTIONS = [
  { id: "caveat", label: "Caveat", note: "Default handwritten", css: "var(--font-caveat), cursive" },
  { id: "kalam", label: "Kalam", note: "Soft handwritten", css: "var(--font-kalam), cursive" },
  { id: "patrick", label: "Patrick Hand", note: "Friendly handwritten", css: "var(--font-patrick), cursive" },
  { id: "dancing", label: "Dancing Script", note: "Elegant script", css: "var(--font-dancing), cursive" },
  { id: "indie", label: "Indie Flower", note: "Playful handwritten", css: "var(--font-indie), cursive" },
  { id: "merriweather", label: "Merriweather", note: "Classic diary", css: "var(--font-merriweather), serif" },
  { id: "poppins", label: "Poppins", note: "Clean and simple", css: "var(--font-poppins), sans-serif" },
];

const PAPER_STYLES = [
  { id: "ruled", label: "Ruled", icon: "📝" },
  { id: "plain", label: "Plain", icon: "📄" },
  { id: "grid", label: "Grid", icon: "▦" },
  { id: "dots", label: "Dots", icon: "⠿" },
  { id: "letter", label: "Letter paper", icon: "💌" },
  { id: "sketch", label: "Soft sketch", icon: "✏️" },
];

const NOTEBOOK_THEMES = [
  { id: "honey", label: "Honey Cream", icon: "🍯", paper: "#fff9ea", edge: "#d7a55f", ink: "#4b3426" },
  { id: "strawberry", label: "Strawberry Milk", icon: "🍓", paper: "#fff0f3", edge: "#dc8fa0", ink: "#673845" },
  { id: "matcha", label: "Matcha Garden", icon: "🍵", paper: "#eff6e8", edge: "#8aa575", ink: "#334a35" },
  { id: "lavender", label: "Lavender Dream", icon: "🪻", paper: "#f5effb", edge: "#a78cbc", ink: "#493c5e" },
  { id: "peach", label: "Peach Bloom", icon: "🍑", paper: "#fff0e4", edge: "#df9c78", ink: "#603d32" },
  { id: "moon", label: "Moonlight Blue", icon: "🌙", paper: "#edf3fa", edge: "#7892ad", ink: "#304357" },
  { id: "rose", label: "Rose Petal", icon: "🌹", paper: "#fff5f3", edge: "#bd7b7e", ink: "#613c45" },
  { id: "mint", label: "Mint Cloud", icon: "☁️", paper: "#eef8f4", edge: "#76a998", ink: "#31554b" },
];

const DECORATIONS = [
  { id: "flowers", label: "Pressed flowers", icon: "🌸", marks: ["🌸", "🌿", "🌼"] },
  { id: "hearts", label: "Tiny hearts", icon: "💗", marks: ["♡", "♥", "♡"] },
  { id: "stars", label: "Dreamy stars", icon: "✨", marks: ["✦", "☾", "✧"] },
  { id: "cozy", label: "Cozy desk", icon: "☕", marks: ["☕", "📎", "🍂"] },
  { id: "butterflies", label: "Butterfly garden", icon: "🦋", marks: ["🦋", "🌿", "❀"] },
  { id: "kawaii", label: "Cute friends", icon: "🐻", marks: ["🐻", "🍓", "🎀"] },
  { id: "clouds", label: "Cloud day", icon: "☁️", marks: ["☁️", "🌈", "✨"] },
  { id: "nature", label: "Little nature", icon: "🍄", marks: ["🍄", "🌱", "🐞"] },
  { id: "none", label: "No decorations", icon: "○", marks: [] },
];

const INK_COLORS = ["#4b3426", "#31526b", "#476244", "#70455f", "#5b4b78", "#242424"];
const PREFS_KEY = "vichar:notebook:prefs:v2";

interface NotebookEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  title?: string;
  onTitleChange?: (title: string) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  initialPreferences?: Partial<NotebookPreferences>;
  onPreferencesChange?: (preferences: NotebookPreferences) => void;
}

export const DEFAULT_NOTEBOOK_PREFERENCES: NotebookPreferences = {
  fontFamily: "caveat",
  fontSize: 22,
  textColor: "#4b3426",
  paperStyle: "ruled",
  notebookTheme: "honey",
  decoration: "flowers",
};

function normalisePreferences(value?: Partial<NotebookPreferences>): NotebookPreferences {
  const merged = { ...DEFAULT_NOTEBOOK_PREFERENCES, ...value };
  return {
    fontFamily: FONT_OPTIONS.some((option) => option.id === merged.fontFamily) ? merged.fontFamily : DEFAULT_NOTEBOOK_PREFERENCES.fontFamily,
    fontSize: Math.min(30, Math.max(17, Number(merged.fontSize) || DEFAULT_NOTEBOOK_PREFERENCES.fontSize)),
    textColor: INK_COLORS.includes(merged.textColor) ? merged.textColor : DEFAULT_NOTEBOOK_PREFERENCES.textColor,
    paperStyle: PAPER_STYLES.some((option) => option.id === merged.paperStyle) ? merged.paperStyle : DEFAULT_NOTEBOOK_PREFERENCES.paperStyle,
    notebookTheme: NOTEBOOK_THEMES.some((option) => option.id === merged.notebookTheme) ? merged.notebookTheme : DEFAULT_NOTEBOOK_PREFERENCES.notebookTheme,
    decoration: DECORATIONS.some((option) => option.id === merged.decoration) ? merged.decoration : DEFAULT_NOTEBOOK_PREFERENCES.decoration,
  };
}

export function journalPageBackground(preferences: NotebookPreferences): React.CSSProperties {
  const theme = NOTEBOOK_THEMES.find((option) => option.id === preferences.notebookTheme) ?? NOTEBOOK_THEMES[0];
  const line = preferences.notebookTheme === "moon" ? "rgba(85,116,145,.18)" : "rgba(126,94,67,.15)";
  if (preferences.paperStyle === "ruled" || preferences.paperStyle === "letter") {
    const margin = preferences.paperStyle === "letter"
      ? "linear-gradient(90deg, transparent 0 42px, rgba(219,110,118,.28) 42px 43px, transparent 43px),"
      : "";
    return {
      backgroundColor: theme.paper,
      backgroundImage: `${margin}repeating-linear-gradient(0deg, transparent 0 31px, ${line} 31px 32px)`,
      backgroundSize: "100% 32px",
    };
  }
  if (preferences.paperStyle === "grid") {
    return {
      backgroundColor: theme.paper,
      backgroundImage: `linear-gradient(${line} 1px, transparent 1px), linear-gradient(90deg, ${line} 1px, transparent 1px)`,
      backgroundSize: "22px 22px",
    };
  }
  if (preferences.paperStyle === "dots") {
    return {
      backgroundColor: theme.paper,
      backgroundImage: `radial-gradient(circle, ${line} 1.2px, transparent 1.3px)`,
      backgroundSize: "20px 20px",
    };
  }
  if (preferences.paperStyle === "sketch") {
    return {
      backgroundColor: theme.paper,
      backgroundImage: `repeating-linear-gradient(8deg, transparent 0 19px, ${line} 20px, transparent 21px)`,
      backgroundSize: "100% 42px",
    };
  }
  return { backgroundColor: theme.paper };
}

export function readNotebookPreferences(): NotebookPreferences {
  try {
    const saved = localStorage.getItem(PREFS_KEY);
    return saved ? normalisePreferences(JSON.parse(saved) as Partial<NotebookPreferences>) : { ...DEFAULT_NOTEBOOK_PREFERENCES };
  } catch {
    return { ...DEFAULT_NOTEBOOK_PREFERENCES };
  }
}

export function NotebookEditor({
  value,
  onChange,
  placeholder,
  title,
  onTitleChange,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  initialPreferences,
  onPreferencesChange,
}: NotebookEditorProps) {
  const [preferences, setPreferences] = useState<NotebookPreferences>(() => normalisePreferences(initialPreferences));
  const [showToolbar, setShowToolbar] = useState(true);

  useEffect(() => {
    if (!initialPreferences) setPreferences(readNotebookPreferences());
    // The initial page appearance is intentionally captured only when the
    // editor mounts. Later changes are made through the style controls.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(preferences)); } catch { /* private mode */ }
    onPreferencesChange?.(preferences);
  }, [onPreferencesChange, preferences]);

  const updatePreference = useCallback(
    <K extends keyof NotebookPreferences>(key: K, preferenceValue: NotebookPreferences[K]) => {
      setPreferences((current) => ({ ...current, [key]: preferenceValue }));
    },
    [],
  );

  const font = FONT_OPTIONS.find((option) => option.id === preferences.fontFamily) ?? FONT_OPTIONS[0];
  const theme = NOTEBOOK_THEMES.find((option) => option.id === preferences.notebookTheme) ?? NOTEBOOK_THEMES[0];
  const decoration = DECORATIONS.find((option) => option.id === preferences.decoration) ?? DECORATIONS[0];

  const pageBackground = useMemo<React.CSSProperties>(() => journalPageBackground(preferences), [preferences]);

  const date = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-white/65 px-4 py-3 shadow-softer backdrop-blur dark:bg-white/5">
        <div className="flex items-center gap-2">
          <span className="text-lg">🎀</span>
          <div>
            <p className="text-sm font-semibold">Make this page yours</p>
            <p className="text-xs text-warmgray">Handwritten by default · colours and cute details are optional</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onUndo} disabled={!canUndo} className="focus-ring rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-semibold disabled:opacity-35" aria-label="Undo">↶ Undo</button>
          <button type="button" onClick={onRedo} disabled={!canRedo} className="focus-ring rounded-full border border-[var(--border)] px-3 py-1.5 text-xs font-semibold disabled:opacity-35" aria-label="Redo">↷ Redo</button>
          <button type="button" onClick={() => setShowToolbar((open) => !open)} aria-expanded={showToolbar} className="focus-ring rounded-full bg-[#f0a35e]/15 px-3 py-1.5 text-xs font-semibold text-[#8a4a1f]">
            {showToolbar ? "Hide styles" : "Style page"}
          </button>
        </div>
      </div>

      {showToolbar && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="grid gap-4 rounded-3xl border border-[var(--border)] bg-[#fffaf3]/90 p-4 shadow-soft backdrop-blur dark:bg-[#2a2118]/90 sm:grid-cols-2">
          <label className="text-xs font-semibold text-warmgray">
            Writing font
            <select value={preferences.fontFamily} onChange={(event) => updatePreference("fontFamily", event.target.value)} className="focus-ring mt-1.5 w-full rounded-xl border border-[var(--border)] bg-white px-3 py-2.5 text-sm text-[#3a2e26]">
              {FONT_OPTIONS.map((option) => <option key={option.id} value={option.id}>{option.label} · {option.note}</option>)}
            </select>
          </label>
          <label className="text-xs font-semibold text-warmgray">
            Writing size · {preferences.fontSize}px
            <input type="range" min="17" max="30" step="1" value={preferences.fontSize} onChange={(event) => updatePreference("fontSize", Number(event.target.value))} className="mt-3 w-full accent-[#e07d3f]" />
          </label>

          <div className="sm:col-span-2">
            <p className="text-xs font-semibold text-warmgray">Page colour</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {NOTEBOOK_THEMES.map((option) => (
                <button key={option.id} type="button" onClick={() => updatePreference("notebookTheme", option.id)} aria-pressed={preferences.notebookTheme === option.id} className={cx("focus-ring rounded-full border px-3 py-2 text-xs font-semibold transition-transform hover:-translate-y-0.5", preferences.notebookTheme === option.id ? "border-[#8a4a1f] shadow-soft" : "border-[var(--border)]")} style={{ background: option.paper, color: option.ink }}>
                  {option.icon} {option.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-warmgray">Paper pattern</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {PAPER_STYLES.map((option) => (
                <button key={option.id} type="button" onClick={() => updatePreference("paperStyle", option.id)} aria-pressed={preferences.paperStyle === option.id} className={cx("focus-ring rounded-full border px-3 py-1.5 text-xs font-semibold", preferences.paperStyle === option.id ? "border-[#8ab6b0] bg-[#e6f2ef] text-[#456b66]" : "border-[var(--border)]")}>
                  {option.icon} {option.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-warmgray">Ink colour</p>
            <div className="mt-2 flex gap-2">
              {INK_COLORS.map((colour) => (
                <button key={colour} type="button" onClick={() => updatePreference("textColor", colour)} aria-label={`Use ink colour ${colour}`} aria-pressed={preferences.textColor === colour} className={cx("focus-ring h-8 w-8 rounded-full border-2 border-white shadow-softer", preferences.textColor === colour && "ring-2 ring-[#e07d3f] ring-offset-2")} style={{ background: colour }} />
              ))}
            </div>
          </div>

          <div className="sm:col-span-2">
            <p className="text-xs font-semibold text-warmgray">Cute page decorations</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {DECORATIONS.map((option) => (
                <button key={option.id} type="button" onClick={() => updatePreference("decoration", option.id)} aria-pressed={preferences.decoration === option.id} className={cx("focus-ring rounded-full border px-3 py-1.5 text-xs font-semibold", preferences.decoration === option.id ? "border-[#dc8fa0] bg-[#fff0f3] text-[#7a4050]" : "border-[var(--border)]")}>
                  {option.icon} {option.label}
                </button>
              ))}
            </div>
          </div>
        </motion.div>
      )}

      <motion.div initial={{ opacity: 0, rotateX: -2 }} animate={{ opacity: 1, rotateX: 0 }} transition={{ duration: 0.45 }} className="diary-book" style={{ "--diary-edge": theme.edge } as React.CSSProperties}>
        <div className="diary-bookmark" aria-hidden />
        <section className="diary-page diary-page-left" style={pageBackground}>
          {decoration.marks.map((mark, index) => <span key={`${mark}-${index}`} className={`diary-decoration diary-decoration-${index + 1}`} aria-hidden>{mark}</span>)}
          <p className="text-xs font-semibold uppercase tracking-[0.2em] opacity-55">My private diary</p>
          <p className="mt-3 text-sm opacity-60">{date}</p>
          {title !== undefined && onTitleChange && (
            <input value={title} onChange={(event) => onTitleChange(event.target.value)} placeholder="Give today a title…" aria-label="Entry title" className="focus-ring mt-10 w-full border-0 bg-transparent text-3xl font-semibold outline-none placeholder:opacity-35" style={{ fontFamily: font.css, color: preferences.textColor }} />
          )}
          <div className="mt-auto pb-8 text-center">
            <p className="text-3xl">❦</p>
            <p className="mt-2 text-sm opacity-55" style={{ fontFamily: font.css }}>A quiet place for everything you feel.</p>
          </div>
        </section>

        <section className="diary-page diary-page-right" style={pageBackground}>
          {decoration.marks.slice().reverse().map((mark, index) => <span key={`${mark}-right-${index}`} className={`diary-decoration diary-decoration-${index + 1}`} aria-hidden>{mark}</span>)}
          <textarea
            value={value}
            onChange={(event) => onChange(event.target.value)}
            placeholder={placeholder || "Dear diary…\n\nWrite freely. Nothing here has to be perfect, and no feeling is too small for this page."}
            aria-label="Private diary entry"
            spellCheck
            className="focus-ring relative z-10 h-[52vh] min-h-[380px] w-full resize-y border-0 bg-transparent px-2 py-6 outline-none placeholder:opacity-35"
            style={{ fontFamily: font.css, fontSize: `${preferences.fontSize}px`, color: preferences.textColor, lineHeight: ["ruled", "letter"].includes(preferences.paperStyle) ? "32px" : "1.65" }}
          />
          <div className="relative z-10 mt-2 flex items-center justify-between border-t border-black/5 pt-3 text-xs opacity-50">
            <span>{value.trim() ? value.trim().split(/\s+/).length : 0} words</span>
            <span>encrypted when saved 🔒</span>
          </div>
        </section>
      </motion.div>

      <div className="flex flex-wrap gap-2 text-xs text-warmgray dark:text-[#b0ab9e]">
        <span className="rounded-full bg-white/45 px-3 py-1 dark:bg-white/5">✍️ {font.label} · {preferences.fontSize}px</span>
        <span className="rounded-full bg-white/45 px-3 py-1 dark:bg-white/5">{theme.icon} {theme.label}</span>
        <span className="rounded-full bg-white/45 px-3 py-1 dark:bg-white/5">{decoration.icon} {decoration.label}</span>
      </div>
    </div>
  );
}

interface DiaryEntryPaperProps {
  title: string;
  content: string;
  date: string;
  gratitude?: string[];
  appearance?: Partial<NotebookPreferences>;
}

export function DiaryEntryPaper({ title, content, date, gratitude = [], appearance }: DiaryEntryPaperProps) {
  const preferences = normalisePreferences(appearance);
  const theme = NOTEBOOK_THEMES.find((option) => option.id === preferences.notebookTheme) ?? NOTEBOOK_THEMES[0];
  const font = FONT_OPTIONS.find((option) => option.id === preferences.fontFamily) ?? FONT_OPTIONS[0];
  const decoration = DECORATIONS.find((option) => option.id === preferences.decoration) ?? DECORATIONS[0];
  const pageBackground = journalPageBackground(preferences);
  const gratitudeItems = gratitude.map((item) => item.trim()).filter(Boolean);
  const formattedDate = new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <motion.article
      initial={{ opacity: 0, rotateY: -4, y: 10 }}
      animate={{ opacity: 1, rotateY: 0, y: 0 }}
      transition={{ duration: 0.5 }}
      className="diary-read-sheet"
      style={{ ...pageBackground, "--diary-edge": theme.edge } as React.CSSProperties}
    >
      <div className="diary-read-binding" aria-hidden />
      {decoration.marks.map((mark, index) => (
        <span key={`${mark}-read-${index}`} className={`diary-decoration diary-decoration-${index + 1}`} aria-hidden>{mark}</span>
      ))}
      <header className="relative z-10 border-b border-black/5 pb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] opacity-50">My private diary · encrypted page</p>
        <h1 className="mt-4 text-3xl font-semibold sm:text-4xl" style={{ fontFamily: font.css, color: preferences.textColor }}>{title}</h1>
        <p className="mt-2 text-sm opacity-55">{formattedDate}</p>
      </header>
      <div
        className="relative z-10 min-h-[310px] whitespace-pre-wrap py-8"
        style={{
          fontFamily: font.css,
          fontSize: `${preferences.fontSize}px`,
          color: preferences.textColor,
          lineHeight: ["ruled", "letter"].includes(preferences.paperStyle) ? "32px" : "1.75",
        }}
      >
        {content}
      </div>
      {gratitudeItems.length > 0 && (
        <aside className="relative z-10 rounded-2xl border border-black/5 bg-white/35 p-5" style={{ color: preferences.textColor }}>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] opacity-55">Little things I held close</p>
          <ul className="mt-3 space-y-2" style={{ fontFamily: font.css, fontSize: `${Math.max(18, preferences.fontSize - 2)}px` }}>
            {gratitudeItems.map((item, index) => <li key={`${item}-${index}`}>♡ {item}</li>)}
          </ul>
        </aside>
      )}
      <footer className="relative z-10 mt-7 flex items-center justify-between border-t border-black/5 pt-4 text-xs opacity-50">
        <span>❦ Private memory</span>
        <span>🔒 Opened only on this unlocked diary</span>
      </footer>
    </motion.article>
  );
}
