"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { BrandMark } from "@/components/BrandMark";
import { useTheme } from "@/lib/theme";
import { cx } from "@/lib/format";

const links = [
  { href: "#features", label: "Features" },
  { href: "#faq", label: "FAQ" },
];

export function Navbar() {
  const { theme, toggle } = useTheme();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cx(
        "fixed inset-x-0 top-0 z-50 transition-all duration-300",
        scrolled ? "glass !rounded-none border-x-0 border-t-0" : "bg-transparent",
      )}
    >
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <Link href="/" className="flex items-center gap-2.5" aria-label="Vichar AI home">
          <BrandMark size="sm" decorative priority />
          <span className="font-heading text-lg font-semibold tracking-tight">Vichar AI</span>
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-sm text-warmgray transition-colors hover:text-olive dark:text-[#b0ab9e] dark:hover:text-[#edeae2]"
            >
              {l.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={toggle}
            aria-label="Toggle dark mode"
            className="focus-ring grid h-9 w-9 place-items-center rounded-full border border-[var(--border)] bg-[var(--card)] text-base transition-transform hover:scale-105"
          >
            {theme === "dark" ? "☀️" : "🌙"}
          </button>
          <Link href="/login" className="btn-ghost focus-ring hidden px-5 py-2 text-sm font-semibold sm:inline-flex">
            Sign in
          </Link>
          <Link href="/signup" className="btn-primary focus-ring hidden px-5 py-2 text-sm sm:inline-flex">
            Get started
          </Link>
          <button
            className="focus-ring grid h-9 w-9 place-items-center rounded-full border border-[var(--border)] bg-[var(--card)] md:hidden"
            aria-label="Toggle menu"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? "✕" : "☰"}
          </button>
        </div>
      </nav>

      {open && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass mx-4 mb-4 mt-1 flex flex-col gap-1 p-3 md:hidden"
        >
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="rounded-xl px-4 py-2.5 text-sm font-medium hover:bg-matcha-50 dark:hover:bg-matcha-900/30"
            >
              {l.label}
            </a>
          ))}
          <div className="my-1 border-t border-[var(--border)]" />
          <Link href="/login" onClick={() => setOpen(false)} className="btn-ghost px-4 py-2.5 text-center text-sm font-semibold">
            Sign in
          </Link>
          <Link href="/signup" onClick={() => setOpen(false)} className="btn-primary px-4 py-2.5 text-center text-sm">
            Get started
          </Link>
        </motion.div>
      )}
    </header>
  );
}
