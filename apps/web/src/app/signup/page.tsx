"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/Button";
import { useAuth } from "@/lib/auth";
import { api, setAccessToken, ApiError } from "@/lib/api";
import type { User } from "@/lib/types";

interface RegisterResponse {
  accessToken: string;
  user: User;
}

export default function SignupPage() {
  const { user, loading, setUser } = useAuth();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace("/home");
  }, [loading, user, router]);

  const passwordOk = password.length >= 8 && /[a-zA-Z]/.test(password) && /[0-9]/.test(password);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!consent) {
      setError("Please accept the privacy consent to continue.");
      return;
    }
    setBusy(true);
    try {
      const data = await api<RegisterResponse>("/auth/register", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password,
          privacyConsent: true,
        }),
      });
      setAccessToken(data.accessToken);
      setUser(data.user);
      router.push("/home");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Your space to feel heard — private, gentle, and entirely yours."
      footer={
        <>
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-matcha-600 underline-offset-2 hover:underline dark:text-matcha-400">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div>
          <label htmlFor="name" className="mb-1.5 block text-sm font-medium">
            Your name
          </label>
          <input
            id="name"
            type="text"
            autoComplete="name"
            required
            className="input-base"
            placeholder="How should we greet you?"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            className="input-base"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="password" className="mb-1.5 block text-sm font-medium">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            required
            className="input-base"
            placeholder="8+ characters with a letter and a number"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {password.length > 0 && !passwordOk && (
            <p className="mt-1.5 text-xs text-warmgray dark:text-[#b0ab9e]">
              Use at least 8 characters, with a letter and a number.
            </p>
          )}
        </div>
        <label className="flex cursor-pointer items-start gap-2.5 text-sm leading-relaxed text-warmgray dark:text-[#b0ab9e]">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-matcha-600"
          />
          <span>
            I understand this is a supportive companion, not a licensed therapist, and I agree to the{" "}
            <Link href="/privacy" className="underline underline-offset-2">
              privacy policy
            </Link>
            . My data stays mine — I can export or delete it anytime.
          </span>
        </label>
        {error && (
          <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" disabled={busy || (password.length > 0 && !passwordOk)} className="w-full">
          {busy ? "Creating your space…" : "Start free"}
        </Button>
      </form>
    </AuthShell>
  );
}
