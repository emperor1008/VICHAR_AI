"use client";

import Link from "next/link";

export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <main className="relative flex min-h-[100dvh] items-center justify-center overflow-hidden px-5 py-16">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 left-1/2 h-[420px] w-[640px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(127,163,107,0.16)_0%,transparent_65%)] blur-2xl"
      />

      <div className="relative w-full max-w-md">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2.5" aria-label="Vichar home">
          <span className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-matcha-400 to-matcha-600 text-xl shadow-soft">
            🍃
          </span>
          <span className="font-heading text-xl font-semibold tracking-tight">Vichar</span>
        </Link>

        <div className="glass p-8 sm:p-10">
          <h1 className="text-center font-heading text-2xl font-bold tracking-tight">{title}</h1>
          {subtitle && (
            <p className="mt-2 text-center text-sm leading-relaxed text-warmgray dark:text-[#b0ab9e]">
              {subtitle}
            </p>
          )}
          <div className="mt-8">{children}</div>
        </div>

        {footer && (
          <p className="mt-6 text-center text-sm text-warmgray dark:text-[#b0ab9e]">{footer}</p>
        )}
      </div>
    </main>
  );
}
