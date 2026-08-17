"use client";

import Link from "next/link";
import { motion } from "framer-motion";

export function CTA() {
  return (
    <section className="mx-auto max-w-6xl px-5 pb-24">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.65 }}
        className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-matcha-500 via-matcha-600 to-[#5c7d4c] px-8 py-16 text-center text-white sm:px-16"
      >
        <div
          aria-hidden
          className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl"
        />

        <div className="relative mx-auto max-w-xl">
          <h2 className="font-heading text-3xl font-bold tracking-tight sm:text-4xl">
            Start feeling a little lighter today
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-white/85">
            Join Vichar free — no credit card, no cold intros. Just a companion that listens,
            understands, and stays.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/signup"
              className="focus-ring rounded-full bg-white px-8 py-3.5 text-base font-semibold text-matcha-700 shadow-lift transition-all hover:-translate-y-0.5 hover:shadow-xl"
            >
              Start free now
            </Link>
            <Link
              href="/login"
              className="focus-ring rounded-full border border-white/40 px-8 py-3.5 text-base font-semibold text-white transition-colors hover:bg-white/10"
            >
              I already have an account
            </Link>
          </div>
          <p className="mt-6 text-xs text-white/70">
            Web app available today · iOS &amp; Android coming soon
          </p>
        </div>
      </motion.div>
    </section>
  );
}
