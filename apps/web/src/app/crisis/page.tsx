import { StaticPage } from "@/components/StaticPage";

export const metadata = {
  title: "Crisis resources",
  description: "Immediate help when you need it most.",
};

const INTERNATIONAL = [
  { country: "India", name: "iCall / Vandrevala Foundation", number: "9152987821 / 1860-2662-345" },
  { country: "United States", name: "988 Suicide & Crisis Lifeline", number: "988" },
  { country: "United Kingdom", name: "Samaritans", number: "116 123" },
  { country: "Canada", name: "Talk Suicide Canada", number: "988" },
  { country: "Australia", name: "Lifeline", number: "13 11 14" },
];

export default function CrisisPage() {
  return (
    <StaticPage title="You are not alone 💚">
      <p>
        If you are in immediate danger, <strong>please call your local emergency number right away</strong>{" "}
        — 112, 911, or 999 — or go to the nearest emergency room. You deserve help that is immediate and human.
      </p>
      <p>
        If you are thinking about self-harm or suicide, please reach out to someone now: a trusted friend or
        family member, a crisis line, or a mental-health professional. These feelings can pass, and people
        who get help feel better. <strong>Please don&apos;t stay alone with this.</strong>
      </p>
      <h2>International crisis lines</h2>
      <p>
        Most lines are free, confidential, and available 24/7. If your country isn&apos;t listed, search for
        &ldquo;suicide prevention helpline [your country]&rdquo; or use{" "}
        <a href="https://findahelpline.com" target="_blank" rel="noreferrer noopener">
          findahelpline.com
        </a>
        .
      </p>
      <div className="overflow-hidden rounded-2xl border border-[var(--border)]">
        {INTERNATIONAL.map((r, i) => (
          <div
            key={r.country}
            className={
              "flex flex-wrap items-center justify-between gap-2 px-5 py-4 " +
              (i % 2 ? "bg-[var(--bg-soft)]" : "")
            }
          >
            <div>
              <p className="font-semibold text-[var(--text)]">{r.country}</p>
              <p className="text-sm">{r.name}</p>
            </div>
            <p className="font-heading text-lg font-bold text-matcha-600 dark:text-matcha-400">{r.number}</p>
          </div>
        ))}
      </div>
      <h2>What helps right now</h2>
      <ul className="list-disc space-y-2 pl-5">
        <li>Move to somewhere with people, even if you don&apos;t talk.</li>
        <li>Slow your breath — in for four, out for six, a few times.</li>
        <li>Tell one person how you&apos;re feeling, in one sentence.</li>
        <li>Remove anything you could use to hurt yourself from easy reach.</li>
      </ul>
      <p>
        When you&apos;re ready, you can also talk it through with your companion — it will listen without
        judgment and point you to the right support.{" "}
        <a href="/signup">Start a conversation</a>.
      </p>
      <p className="text-sm opacity-70">
        Vichar is not a crisis service, licensed therapist, or medical provider. In an emergency, always
        contact local emergency services.
      </p>
    </StaticPage>
  );
}
