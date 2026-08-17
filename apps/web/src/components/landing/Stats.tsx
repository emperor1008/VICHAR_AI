"use client";

import { motion } from "framer-motion";

const stats = [
  { value: "24/7", label: "Always here, day or night" },
  { value: "10+", label: "Emotions recognized with care" },
  { value: "2", label: "Companions, Arpita & Biniit" },
  { value: "100%", label: "Your data stays yours" },
];

export function Stats() {
  return (
    <section className="mx-auto max-w-6xl px-5 pb-24">
      <div className="glass grid grid-cols-2 gap-8 p-10 lg:grid-cols-4">
        {stats.map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: i * 0.08 }}
            className="text-center"
          >
            <p className="font-heading text-3xl font-bold text-matcha-600 dark:text-matcha-400 sm:text-4xl">
              {s.value}
            </p>
            <p className="mt-2 text-sm text-warmgray dark:text-[#b0ab9e]">{s.label}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
