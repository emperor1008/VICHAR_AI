import { StaticPage } from "@/components/StaticPage";

export const metadata = {
  title: "Terms",
  description: "The terms of using Vichar.",
};

export default function TermsPage() {
  return (
    <StaticPage title="Terms of service">
      <p>
        By using Vichar you agree to these terms. They&apos;re written in plain language on purpose.
      </p>
      <h2>What Vichar is</h2>
      <p>
        Vichar is an <strong>emotional-support companion</strong> for everyday ups and downs. It is{" "}
        <strong>not</strong> a licensed mental-health professional, not a therapy or medical service,
        and not a substitute for professional care. It never diagnoses, and it will always encourage
        professional support when that&apos;s the right step.
      </p>
      <h2>In an emergency</h2>
      <p>
        Vichar is not a crisis service. If you or someone else is in immediate danger, call your local
        emergency number (112 / 911 / 999) or visit the{" "}
        <a href="/crisis">crisis resources page</a>.
      </p>
      <h2>Using the service</h2>
      <ul className="list-disc space-y-2 pl-5">
        <li>Be 13 or older to use Vichar.</li>
        <li>Don&apos;t use Vichar to harm yourself or others, or to plan harm.</li>
        <li>Don&apos;t attempt to extract private data or abuse the service.</li>
      </ul>
      <h2>Your content</h2>
      <p>
        Everything you share remains yours. You can export or permanently delete it at any time. We never
        sell your data and never train models on your conversations.
      </p>
      <h2>No guarantees</h2>
      <p>
        Vichar provides information and companionship in good faith, but we make no medical guarantees.
        Always rely on professional advice for health decisions.
      </p>
      <p className="text-sm opacity-70">
        Questions? Reach us at support@vichar.example.
      </p>
    </StaticPage>
  );
}
