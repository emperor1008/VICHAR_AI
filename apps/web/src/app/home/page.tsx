"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { RequireAuth } from "@/components/RequireAuth";
import { BrandMark } from "@/components/BrandMark";
import { GlassCard } from "@/components/GlassCard";
import { Button } from "@/components/Button";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { greeting, todayLocal, cx } from "@/lib/format";
import type { Personality, Mood } from "@/lib/types";

const MOOD_CHOICES = [
  { key: "calm", emoji: "😌", label: "Calm" },
  { key: "hopeful", emoji: "🌅", label: "Hopeful" },
  { key: "happy", emoji: "😊", label: "Happy" },
  { key: "neutral", emoji: "😐", label: "Okay" },
  { key: "anxious", emoji: "😰", label: "Anxious" },
  { key: "sad", emoji: "😢", label: "Sad" },
  { key: "lonely", emoji: "🌙", label: "Lonely" },
  { key: "overwhelmed", emoji: "🌊", label: "Overwhelmed" },
];

function HomeContent() {
  const { user, setUser, logout } = useAuth();
  const [personalities, setPersonalities] = useState<Personality[]>([]);
  const [affirmation, setAffirmation] = useState("");
  const [todayMood, setTodayMood] = useState<Mood | null>(null);
  const [savingMood, setSavingMood] = useState<string | null>(null);

  useEffect(() => {
    api<{ personalities: Personality[] }>("/meta/companions")
      .then((d) => setPersonalities(d.personalities))
      .catch(() => {});
    api<{ affirmation: string }>("/meta/affirmation")
      .then((d) => setAffirmation(d.affirmation))
      .catch(() => {});
    api<{ mood: Mood | null }>(`/moods/today?date=${todayLocal()}`)
      .then((d) => setTodayMood(d.mood))
      .catch(() => {});
  }, []);

  const pickCompanion = useCallback(
    async (id: string) => {
      if (!user || user.personalityId === id) return;
      const optimistic = { ...user, personalityId: id };
      setUser(optimistic);
      try {
        const d = await api<{ user: typeof user }>("/users/me", {
          method: "PATCH",
          body: JSON.stringify({ personalityId: id }),
        });
        setUser(d.user);
      } catch {
        // revert on failure
        setUser(user);
      }
    },
    [user, setUser],
  );

  async function logMood(key: string) {
    setSavingMood(key);
    try {
      const d = await api<{ mood: Mood }>("/moods", {
        method: "PUT",
        body: JSON.stringify({ date: todayLocal(), moodKey: key, energy: null, notes: "" }),
      });
      setTodayMood(d.mood);
    } finally {
      setSavingMood(null);
    }
  }

  const companion = personalities.find((p) => p.id === user?.personalityId) ?? personalities[0];
  const firstName = user?.nickname || user?.name?.split(" ")[0] || "friend";

  return (
    <main className="mx-auto max-w-5xl px-5 pb-24 pt-10">
      {/* Top bar */}
      <header className="flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5" aria-label="Vichar AI home">
          <BrandMark size="sm" decorative />
          <span className="font-heading text-lg font-semibold tracking-tight">Vichar AI</span>
        </Link>
        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-warmgray dark:text-[#b0ab9e] sm:inline">{user?.email}</span>
          <button onClick={logout} className="btn-ghost focus-ring px-4 py-2 text-sm font-semibold">
            Sign out
          </button>
        </div>
      </header>

      {/* Greeting + affirmation */}
      <section className="mt-12 flex flex-col items-start justify-between gap-8 md:flex-row md:items-center">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-matcha-600 dark:text-matcha-400">
            {greeting()}
          </p>
          <h1 className="mt-2 font-heading text-3xl font-bold tracking-tight sm:text-4xl">
            Hello, {firstName} 👋
          </h1>
          <p className="mt-3 max-w-md leading-relaxed text-warmgray dark:text-[#b0ab9e]">
            {companion
              ? `${companion.emoji} ${companion.name} is here — ${companion.tagline.toLowerCase()}.`
              : "Your companion is here whenever you need them."}
          </p>
        </div>
        <BrandMark size="xl" decorative className="shadow-soft" />
      </section>

      {affirmation && (
        <GlassCard className="mt-8 flex items-start gap-4 p-6">
          <span className="text-2xl" aria-hidden>🌱</span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-warmgray dark:text-[#b0ab9e]">
              Today&apos;s affirmation
            </p>
            <p className="mt-1.5 font-heading text-lg font-medium leading-relaxed">“{affirmation}”</p>
          </div>
        </GlassCard>
      )}

      {/* Journal — the quiet sanctuary */}
      <Link href="/journal" className="mt-8 block">
        <div className="group flex flex-col items-start justify-between gap-4 rounded-3xl border border-[var(--border)] bg-gradient-to-br from-[#f7ecd9] to-[#f0dfc2] p-6 shadow-soft transition-all hover:-translate-y-0.5 hover:border-[#e2a86b]/70 sm:flex-row sm:items-center sm:p-7 dark:from-[#33291d] dark:to-[#241e16]">
          <div className="flex items-start gap-4">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/70 text-2xl shadow-sm dark:bg-white/10">
              📓
            </span>
            <div>
              <p className="font-heading text-lg font-semibold">Your journal</p>
              <p className="mt-1 max-w-md text-sm leading-relaxed text-warmgray dark:text-[#b0ab9e]">
                A private, peaceful place for your thoughts — prompts, gratitude, mood, and a memory garden that
                grows with every page.
              </p>
            </div>
          </div>
          <span className="inline-flex shrink-0 items-center gap-2 rounded-full bg-gradient-to-r from-[#f0a35e] to-[#e07d3f] px-5 py-2.5 text-sm font-semibold text-white shadow-soft transition-transform group-hover:scale-[1.03]">
            Open journal 🌿
          </span>
        </div>
      </Link>

      <div className="mt-10 grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        {/* Companion picker */}
        <GlassCard className="p-6 sm:p-8">
          <h2 className="font-heading text-lg font-semibold">Choose your companion</h2>
          <p className="mt-1 text-sm text-warmgray dark:text-[#b0ab9e]">
            Same memory, different voice — switch anytime.
          </p>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {personalities.map((p) => {
              const active = user?.personalityId === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => pickCompanion(p.id)}
                  className={cx(
                    "focus-ring rounded-2xl border p-5 text-left transition-all",
                    active
                      ? "border-matcha-500 bg-matcha-50 shadow-soft dark:border-matcha-500/60 dark:bg-matcha-900/25"
                      : "border-[var(--border)] bg-[var(--bg-soft)] hover:border-matcha-400/60",
                  )}
                  aria-pressed={active}
                >
                  <span className="text-3xl">{p.emoji}</span>
                  <p className="mt-3 font-heading text-base font-semibold">
                    {p.name}
                    {active && <span className="ml-2 text-xs font-semibold text-matcha-600 dark:text-matcha-400">· your companion</span>}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-warmgray dark:text-[#b0ab9e]">{p.description}</p>
                </button>
              );
            })}
          </div>
          <Link href="/chat" className="mt-8 block">
            <Button size="lg" className="w-full">
              {companion ? `Talk to ${companion.name}` : "Start a conversation"} 💬
            </Button>
          </Link>
        </GlassCard>

        {/* Mood check-in */}
        <GlassCard className="p-6 sm:p-8">
          <h2 className="font-heading text-lg font-semibold">How are you feeling right now?</h2>
          <p className="mt-1 text-sm text-warmgray dark:text-[#b0ab9e]">
            One tap — no pressure, no judgment.
          </p>
          {todayMood && (
            <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-matcha-50 px-4 py-1.5 text-sm font-medium text-matcha-700 dark:bg-matcha-900/30 dark:text-matcha-300">
              Logged today: {todayMood.emoji} {todayMood.moodKey}
            </p>
          )}
          <div className="mt-5 grid grid-cols-2 gap-2.5">
            {MOOD_CHOICES.map((m) => (
              <button
                key={m.key}
                onClick={() => logMood(m.key)}
                disabled={savingMood !== null}
                className={cx(
                  "focus-ring flex items-center gap-2.5 rounded-xl border border-[var(--border)] bg-[var(--bg-soft)] px-3.5 py-2.5 text-sm font-medium transition-all hover:border-matcha-400/60 hover:bg-matcha-50/60 dark:hover:bg-matcha-900/20",
                  savingMood === m.key && "opacity-60",
                  todayMood?.moodKey === m.key && "border-matcha-500 bg-matcha-50 dark:border-matcha-500/60 dark:bg-matcha-900/25",
                )}
              >
                <span className="text-lg">{m.emoji}</span> {m.label}
              </button>
            ))}
          </div>
        </GlassCard>
      </div>
    </main>
  );
}

export default function HomePage() {
  return (
    <RequireAuth>
      <HomeContent />
    </RequireAuth>
  );
}
