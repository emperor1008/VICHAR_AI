import Link from "next/link";

export function StaticPage({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto min-h-[100dvh] max-w-2xl px-5 py-16">
      <Link href="/" className="flex items-center gap-2.5" aria-label="Vichar home">
        <span className="font-heading text-lg font-semibold tracking-tight">Vichar</span>
      </Link>
      <h1 className="mt-10 font-heading text-3xl font-bold tracking-tight">{title}</h1>
      <div className="prose-vichar mt-8 space-y-5 text-[15px] leading-relaxed text-warmgray dark:text-[#b0ab9e] [&_h2]:mt-8 [&_h2]:font-heading [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-[var(--text)] [&_strong]:font-semibold [&_strong]:text-[var(--text)] [&_a]:text-matcha-600 [&_a]:underline [&_a]:underline-offset-2 [&_a]:dark:text-matcha-400">
        {children}
      </div>
    </main>
  );
}
