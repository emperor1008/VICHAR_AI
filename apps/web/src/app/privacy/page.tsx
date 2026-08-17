import { StaticPage } from "@/components/StaticPage";

export const metadata = {
  title: "Privacy",
  description: "How Vichar protects your data.",
};

export default function PrivacyPage() {
  return (
    <StaticPage title="Privacy — your data stays yours">
      <p>
        Vichar is built <strong>privacy-first by design</strong>. Everything you share is private,
        scoped to your account, and never sold. Here&apos;s exactly what that means.
      </p>
      <h2>What we store</h2>
      <ul className="list-disc space-y-2 pl-5">
        <li>Your profile (name, email, preferences) — used only to serve you.</li>
        <li>Your conversations, moods, journal entries, goals, and memories.</li>
        <li>
          <strong>Memories are saved only with your consent</strong> — you can view, edit, export, or
          delete any of them at any time.
        </li>
      </ul>
      <h2>What we never do</h2>
      <ul className="list-disc space-y-2 pl-5">
        <li>We never sell your data or share it with advertisers.</li>
        <li>We don&apos;t train AI models on your conversations.</li>
        <li>We never read your conversations to build a profile for anyone else.</li>
      </ul>
      <h2>How it&apos;s protected</h2>
      <ul className="list-disc space-y-2 pl-5">
        <li>Passwords are hashed with Argon2 — we can&apos;t see them, and neither can anyone else.</li>
        <li>All traffic is encrypted in transit (HTTPS), with short-lived session tokens and rotating refresh tokens.</li>
        <li>Security-relevant actions are audit-logged without your message content.</li>
      </ul>
      <h2>Your controls</h2>
      <ul className="list-disc space-y-2 pl-5">
        <li>
          <strong>Export</strong> — download everything you&apos;ve shared as a portable file at any time.
        </li>
        <li>
          <strong>Delete</strong> — remove any memory, chat, or your entire account. Deletion is permanent.
        </li>
        <li>All of this is available from your account settings.</li>
      </ul>
      <p className="text-sm opacity-70">
        This is a concise summary; ask us any time at privacy@vichar.example for the full details.
      </p>
    </StaticPage>
  );
}
