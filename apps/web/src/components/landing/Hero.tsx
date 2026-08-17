"use client";

import Link from "next/link";
import { motion } from "framer-motion";

const chips = [
  { emoji: "💚", label: "No judgment" },
  { emoji: "🌙", label: "Available 24/7" },
  { emoji: "🔒", label: "Private by design" },
];

export function Hero() {
  return (
    <section className="relative overflow-hidden pb-24 pt-32 md:pt-40">
      {/* soft backdrop blobs */}
      <div aria-hidden className="pointer-events-none absolute -top-32 left-1/2 h-[480px] w-[720px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(127,163,107,0.18)_0%,transparent_65%)] blur-2xl" />
      <div aria-hidden className="pointer-events-none absolute right-[-160px] top-40 h-96 w-96 rounded-full bg-[radial-gradient(circle,rgba(166,139,200,0.14)_0%,transparent_65%)] blur-2xl" />

      <div className="relative mx-auto max-w-6xl px-5">
        <div className="mx-auto max-w-2xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="glass mx-auto inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium text-warmgray dark:text-[#b0ab9e]"
          >
            <span className="inline-block h-2 w-2 rounded-full bg-matcha-500" />
            Your AI companion for emotional wellness
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.08 }}
            className="mt-6 font-heading text-4xl font-bold leading-[1.12] tracking-tight sm:text-5xl lg:text-[3.4rem]"
          >
            An AI companion that{" "}
            <span className="bg-gradient-to-r from-matcha-600 via-matcha-500 to-amethyst-500 bg-clip-text text-transparent">
              understands you
            </span>{" "}
            before it responds
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.16 }}
            className="mx-auto mt-6 max-w-md text-base leading-relaxed text-warmgray dark:text-[#b0ab9e]"
          >
            Vichar listens, senses how you feel, and adapts — for anxiety, stress, overthinking,
            tough days, and everything in between. Always kind. Never judging.
            Because every feeling deserves to be heard.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.65, delay: 0.24 }}
            className="mt-8 flex flex-wrap items-center justify-center gap-4"
          >
            <Link href="/signup" className="btn-primary focus-ring px-8 py-3.5 text-base">
              Start free
            </Link>
            <Link href="#features" className="btn-ghost focus-ring px-8 py-3.5 text-base font-semibold">
              See how it works
            </Link>
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.7, delay: 0.4 }}
            className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-warmgray dark:text-[#b0ab9e]"
          >
            {chips.map((c) => (
              <span key={c.label} className="inline-flex items-center gap-1.5">
                <span>{c.emoji}</span> {c.label}
              </span>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
