"use client";

import { motion } from "framer-motion";
import { GlassCard } from "@/components/GlassCard";

const testimonials = [
  {
    quote:
      "I came to Vichar after a breakup, mostly to vent. It didn't just listen — it asked the right questions and helped me see the situation more clearly. I cried twice, but the good kind.",
    name: "Maya, 22",
    role: "Student",
    emoji: "🌸",
  },
  {
    quote:
      "As someone with constant exam anxiety, the breathing exercises and the way it reframes my panic have genuinely changed my study nights. It feels premium, not clinical.",
    name: "Arjun, 24",
    role: "Graduate student",
    emoji: "📚",
  },
  {
    quote:
      "I was skeptical about an AI therapist. Then it caught that I was being hard on myself before I even said it out loud. That moment — it understood me. Now it's part of my routine.",
    name: "Sofia, 27",
    role: "Product designer",
    emoji: "🌙",
  },
];

export function Testimonials() {
  return (
    <section id="stories" className="bg-[--bg-soft] py-24">
      <div className="mx-auto max-w-6xl px-5">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
          className="mx-auto max-w-2xl text-center"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-matcha-600 dark:text-matcha-400">
            Stories
          </p>
          <h2 className="mt-3 font-heading text-3xl font-bold tracking-tight sm:text-4xl">
            Real people, real moments
          </h2>
          <p className="mt-4 text-warmgray dark:text-[#b0ab9e]">
            Names changed, feelings kept. Here's what Vichar's early community says.
          </p>
        </motion.div>

        <div className="mt-14 grid gap-5 md:grid-cols-3">
          {testimonials.map((t, i) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.55, delay: i * 0.12 }}
            >
              <GlassCard hover className="flex h-full flex-col p-7">
                <span className="text-3xl">{t.emoji}</span>
                <p className="mt-4 flex-1 text-[15px] leading-relaxed">"{t.quote}"</p>
                <div className="mt-6 flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-amethyst-200 to-amethyst-400 font-heading font-semibold text-white">
                    {t.name[0]}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{t.name}</p>
                    <p className="text-xs text-warmgray dark:text-[#b0ab9e]">{t.role}</p>
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
