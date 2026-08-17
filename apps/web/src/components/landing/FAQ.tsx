"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { GlassCard } from "@/components/GlassCard";

const faqs = [
  {
    q: "Is Vichar a replacement for therapy?",
    a: "No — and we're proud to say it clearly. Vichar is a supportive companion for everyday emotional ups and downs, not a licensed mental health professional. It never diagnoses, and it will always encourage you to reach out to a professional when that's the right step. If you're in crisis, it connects you to local helplines immediately.",
  },
  {
    q: "What happens to my conversations?",
    a: "They're yours. Conversations are encrypted in transit, stored securely, and never sold or shared. You can delete any memory, any chat, or your entire account — and export everything you've shared at any time.",
  },
  {
    q: "Can Vichar really understand emotions?",
    a: "It makes careful, evidence-informed estimates based on your words, tone, and history — it never claims certainty about how you feel. Those estimates simply help it respond with the right warmth and pacing. You stay in control of what it knows.",
  },
  {
    q: "Who can I talk to?",
    a: "Two companions, and you can switch anytime: Arpita — warm, gentle, and deeply attentive — and Biniit — confident, friendly, and on your side. Same memory, different voice.",
  },
  {
    q: "Does it work on my phone?",
    a: "Vichar is fully responsive in any browser today, with a dedicated mobile app in the works. Your journal, chats, and insights sync wherever you are.",
  },
  {
    q: "Is my data used to train AI models?",
    a: "Never. Your data is used only to serve you. We don't train models on user conversations, and we don't share data with advertisers. Period.",
  },
];

export function FAQ() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="mx-auto max-w-3xl px-5 py-24">
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.6 }}
        className="text-center"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-matcha-600 dark:text-matcha-400">
          Questions
        </p>
        <h2 className="mt-3 font-heading text-3xl font-bold tracking-tight sm:text-4xl">
          Asked, answered, honestly
        </h2>
      </motion.div>

      <div className="mt-12 space-y-3">
        {faqs.map((f, i) => {
          const isOpen = open === i;
          return (
            <GlassCard key={f.q} className={isOpen ? "border-matcha-400/50" : ""}>
              <button
                className="focus-ring flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
                onClick={() => setOpen(isOpen ? null : i)}
                aria-expanded={isOpen}
              >
                <span className="font-heading text-[15px] font-semibold">{f.q}</span>
                <motion.span
                  animate={{ rotate: isOpen ? 45 : 0 }}
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-matcha-50 text-lg leading-none text-matcha-600 dark:bg-matcha-900/40 dark:text-matcha-400"
                >
                  +
                </motion.span>
              </button>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    className="overflow-hidden"
                  >
                    <p className="px-6 pb-6 text-sm leading-relaxed text-warmgray dark:text-[#b0ab9e]">
                      {f.a}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </GlassCard>
          );
        })}
      </div>
    </section>
  );
}
