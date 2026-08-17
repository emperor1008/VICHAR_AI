"use client";

import { motion } from "framer-motion";
import { GlassCard } from "@/components/GlassCard";

const features = [
  {
    emoji: "💬",
    title: "Conversations that feel human",
    desc: "Streaming, warm, and personal. Vichar listens first, then responds with empathy and practical support — never scripts, never judgment.",
  },
  {
    emoji: "🌡️",
    title: "Emotion-aware responses",
    desc: "Vichar gently senses how you're feeling from your words — anxious, overwhelmed, hopeful — and adapts its tone and pacing to match.",
  },
  {
    emoji: "🧠",
    title: "Remembers your journey",
    desc: "Your goals, your exam dates, your relationships, what actually helps you calm down. Vichar remembers — with your consent — so you never have to repeat yourself.",
  },
  {
    emoji: "📔",
    title: "Mood journal & insights",
    desc: "Log how you feel with a tap, and watch gentle trends emerge over weeks and months. Spot what lifts you and what drains you.",
  },
  {
    emoji: "🌿",
    title: "Guided calm, anytime",
    desc: "Breathing exercises, guided meditations, sleep stories, and focus timers — small rituals that ground you in under five minutes.",
  },
  {
    emoji: "🗣️",
    title: "Talk, don't type",
    desc: "Real voice conversations with natural speech. Vichar hears more than words — tone, pauses, and pace shape its responses.",
  },
];

export function Features() {
  return (
    <section id="features" className="mx-auto max-w-6xl px-5 py-24">
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.6 }}
        className="mx-auto max-w-2xl text-center"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-matcha-600 dark:text-matcha-400">
          How it helps
        </p>
        <h2 className="mt-3 font-heading text-3xl font-bold tracking-tight sm:text-4xl">
          Everything you need to feel a little more human
        </h2>
        <p className="mt-4 text-warmgray dark:text-[#b0ab9e]">
          Built with clinicians, designers, and people who've been through it — one calm experience,
          two companions, endless ways to feel heard.
        </p>
      </motion.div>

      <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((f, i) => (
          <motion.div
            key={f.title}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.55, delay: (i % 3) * 0.1 }}
          >
            <GlassCard hover className="h-full p-7">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-matcha-50 text-2xl dark:bg-matcha-900/30">
                {f.emoji}
              </div>
              <h3 className="mt-5 font-heading text-lg font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-warmgray dark:text-[#b0ab9e]">{f.desc}</p>
            </GlassCard>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
