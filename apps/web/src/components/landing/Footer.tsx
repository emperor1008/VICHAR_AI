import Link from "next/link";

const columns: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "#features" },
      { label: "AI Coach", href: "/login" },
      { label: "Mood Journal", href: "/login" },
      { label: "Meditation", href: "/login" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "#" },
      { label: "Careers", href: "#" },
      { label: "Press", href: "#" },
    ],
  },
  {
    title: "Support",
    links: [
      { label: "FAQ", href: "#faq" },
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
      { label: "Crisis resources", href: "/crisis" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-[var(--border)] bg-[--bg-soft]">
      <div className="mx-auto max-w-6xl px-5 py-16">
        <div className="grid gap-10 md:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div>
            <Link href="/" className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-matcha-400 to-matcha-600 text-lg">
                🍃
              </span>
              <span className="font-heading text-lg font-semibold tracking-tight">Vichar</span>
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-warmgray dark:text-[#b0ab9e]">
              An emotionally intelligent AI companion for everyday mental wellness. Because every
              feeling deserves to be heard. A support tool — not a replacement for licensed professionals.
            </p>
            <div className="mt-5 flex gap-3">
              {["𝕏", "in", "ig"].map((s) => (
                <a
                  key={s}
                  href="#"
                  aria-label={`Vichar on ${s}`}
                  className="focus-ring grid h-9 w-9 place-items-center rounded-full border border-[var(--border)] text-sm font-semibold transition-colors hover:border-matcha-400 hover:text-matcha-600"
                >
                  {s}
                </a>
              ))}
            </div>
          </div>

          {columns.map((col) => (
            <div key={col.title}>
              <p className="text-sm font-semibold">{col.title}</p>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link
                      href={l.href}
                      className="text-sm text-warmgray transition-colors hover:text-matcha-600 dark:text-[#b0ab9e]"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 flex flex-col items-center justify-between gap-4 border-t border-[var(--border)] pt-7 text-xs text-warmgray dark:text-[#b0ab9e] sm:flex-row">
          <p>© {new Date().getFullYear()} Vichar AI. Made with care, not with your data.</p>
          <p className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full bg-matcha-500" />
            If you're in crisis, please reach out to local emergency services or a helpline.
          </p>
        </div>
      </div>
    </footer>
  );
}
