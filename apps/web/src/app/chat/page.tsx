"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { RequireAuth } from "@/components/RequireAuth";
import { Markdown } from "@/components/markdown";
import { Orb } from "@/components/Orb";
import { useAuth } from "@/lib/auth";
import { api, streamChat } from "@/lib/api";
import { timeAgo, cx } from "@/lib/format";
import type { Personality, Conversation, ChatMessage, EmotionEstimate, EmotionKey } from "@/lib/types";

interface EmotionMeta {
  emoji: string;
  label: string;
  color: string;
}

function ChatContent() {
  const { user, setUser, logout } = useAuth();
  const [personalities, setPersonalities] = useState<Personality[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [pendingText, setPendingText] = useState("");
  const [pendingEmotion, setPendingEmotion] = useState<EmotionEstimate | null>(null);
  const [emotionMeta, setEmotionMeta] = useState<EmotionMeta | null>(null);
  const [crisis, setCrisis] = useState<{ severity: string; countryCode: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Persists across streams so the orb shows the emotion arc: it heats up
  // while an anxious/overwhelmed message streams, then settles calm after
  // the grounding reply lands.
  const [orbEmotion, setOrbEmotion] = useState<EmotionKey>("calm");
  const settleRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  // Keep the latest accumulated text reachable from the onDone closure.
  const pendingTextRef = useRef("");
  useEffect(() => {
    pendingTextRef.current = pendingText;
  }, [pendingText]);

  const companion = personalities.find((p) => p.id === user?.personalityId) ?? personalities[0];

  const refreshConversations = useCallback(async () => {
    try {
      const d = await api<{ conversations: Conversation[] }>("/chats");
      setConversations(d.conversations);
    } catch {
      /* keep current */
    }
  }, []);

  useEffect(() => {
    api<{ personalities: Personality[] }>("/meta/companions")
      .then((d) => setPersonalities(d.personalities))
      .catch(() => {});
    refreshConversations();
  }, [refreshConversations]);

  // Auto-scroll to the newest message.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, pendingText, streaming]);

  useEffect(
    () => () => {
      abortRef.current?.abort();
      if (settleRef.current) clearTimeout(settleRef.current);
    },
    [],
  );

  async function openConversation(id: string) {
    if (streaming) abortRef.current?.abort();
    if (settleRef.current) clearTimeout(settleRef.current);
    setActiveId(id);
    setCrisis(null);
    setPendingText("");
    setPendingEmotion(null);
    setEmotionMeta(null);
    setOrbEmotion("calm");
    try {
      const d = await api<{ messages: ChatMessage[] }>(`/chats/${id}`);
      setMessages(d.messages);
    } catch {
      setMessages([]);
    }
  }

  function newChat() {
    if (streaming) abortRef.current?.abort();
    if (settleRef.current) clearTimeout(settleRef.current);
    setActiveId(null);
    setMessages([]);
    setPendingText("");
    setPendingEmotion(null);
    setEmotionMeta(null);
    setCrisis(null);
    setOrbEmotion("calm");
  }

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || streaming) return;
    setError(null);
    setCrisis(null);
    setPendingText("");
    setPendingEmotion(null);
    setEmotionMeta(null);

    setMessages((prev) => [
      ...prev,
      { id: `local-${Date.now()}`, role: "user", content: trimmed, reactions: {}, createdAt: new Date().toISOString() },
    ]);
    setInput("");
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    await streamChat(
      {
        conversationId: activeId ?? undefined,
        message: trimmed,
        personalityId: user?.personalityId,
      },
      {
        onToken: (t) => setPendingText((p) => p + t),
        onEmotion: (e) => {
          setPendingEmotion(e.emotion);
          setEmotionMeta(e.meta);
          setOrbEmotion(e.emotion.primary);
        },
        onCrisis: (severity, countryCode) => setCrisis({ severity, countryCode }),
        onDone: async (data) => {
          if (data.conversationId) {
            const wasNew = !activeId;
            if (wasNew) setActiveId(data.conversationId);
            await refreshConversations();
            if (wasNew) {
              // Server already persisted both messages — sync from it to stay
              // consistent (no duplicate assistant bubble).
              const d = await api<{ messages: ChatMessage[] }>(`/chats/${data.conversationId}`);
              setMessages(d.messages);
            } else if (pendingTextRef.current) {
              // Existing conversation: append the accumulated reply locally.
              setMessages((prev) => [
                ...prev,
                { id: data.assistantMessageId ?? `a-${Date.now()}`, role: "assistant", content: pendingTextRef.current, reactions: {}, createdAt: new Date().toISOString() },
              ]);
            }
          }
          setPendingText("");
          setPendingEmotion(null);
          setEmotionMeta(null);
          setStreaming(false);
          // Grounding arc: hold the sensed emotion a beat, then settle calm.
          if (settleRef.current) clearTimeout(settleRef.current);
          settleRef.current = setTimeout(() => setOrbEmotion("calm"), 1200);
        },
        onError: (message) => {
          setError(message);
          setPendingText("");
          setPendingEmotion(null);
          setEmotionMeta(null);
          setStreaming(false);
          if (settleRef.current) clearTimeout(settleRef.current);
          setOrbEmotion("calm");
        },
      },
      controller.signal,
    );
  }

  async function pickCompanion(id: string) {
    if (!user || user.personalityId === id) return;
    const previous = user;
    setUser({ ...user, personalityId: id });
    try {
      const d = await api<{ user: typeof user }>("/users/me", {
        method: "PATCH",
        body: JSON.stringify({ personalityId: id }),
      });
      setUser(d.user);
    } catch {
      setUser(previous);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    send(input);
  }

  const allMessages: ChatMessage[] =
    pendingText || streaming
      ? [...messages, { id: "pending", role: "assistant", content: pendingText, reactions: {}, createdAt: new Date().toISOString() }]
      : messages;

  return (
    <div className="flex h-[100dvh] flex-col">
      {/* Header */}
      <header className="glass !rounded-none border-x-0 border-t-0 px-4">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/home" className="focus-ring grid h-9 w-9 shrink-0 place-items-center rounded-full" aria-label="Back to home">

            </Link>
            <Orb emotion={orbEmotion} size={40} className="shrink-0" />
            <div className="min-w-0">
              <p className="truncate font-heading text-[15px] font-semibold leading-tight">
                {companion ? `${companion.emoji} ${companion.name}` : "Vichar"}
              </p>
              {emotionMeta && pendingEmotion && (
                <p className="text-xs capitalize text-warmgray dark:text-[#b0ab9e]">
                  sensing: {emotionMeta.emoji} {emotionMeta.label}
                  <span className="ml-1 lowercase opacity-70">({pendingEmotion.confidence})</span>
                </p>
              )}
            </div>
          </div>

          {/* Companion switcher */}
          <div className="hidden items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--bg-soft)] p-1 sm:flex">
            {personalities.map((p) => (
              <button
                key={p.id}
                onClick={() => pickCompanion(p.id)}
                className={cx(
                  "focus-ring rounded-full px-4 py-1.5 text-sm font-semibold transition-all",
                  user?.personalityId === p.id
                    ? "bg-matcha-500 text-white shadow-soft"
                    : "text-warmgray hover:bg-matcha-50 dark:text-[#b0ab9e] dark:hover:bg-matcha-900/25",
                )}
              >
                {p.emoji} {p.name}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button onClick={newChat} className="btn-ghost focus-ring hidden px-4 py-2 text-sm font-semibold sm:inline-flex">
              + New chat
            </button>
            <button onClick={logout} className="btn-ghost focus-ring px-4 py-2 text-sm font-semibold">
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-6xl flex-1 gap-0 overflow-hidden">
        {/* Sidebar */}
        <aside className="hidden w-72 shrink-0 flex-col border-r border-[var(--border)] md:flex">
          <div className="flex items-center justify-between px-5 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-warmgray dark:text-[#b0ab9e]">
              Conversations
            </p>
            <button onClick={newChat} className="focus-ring grid h-7 w-7 place-items-center rounded-full border border-[var(--border)] text-sm" aria-label="New chat">
              +
            </button>
          </div>
          <div className="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
            {conversations.length === 0 && (
              <p className="px-2 py-6 text-center text-sm text-warmgray dark:text-[#b0ab9e]">
                No conversations yet — start one and it&apos;ll appear here.
              </p>
            )}
            {conversations.map((c) => (
              <button
                key={c.id}
                onClick={() => openConversation(c.id)}
                className={cx(
                  "focus-ring w-full rounded-xl px-3.5 py-3 text-left transition-colors",
                  activeId === c.id ? "bg-matcha-50 dark:bg-matcha-900/25" : "hover:bg-[var(--bg-soft)]",
                )}
              >
                <p className="truncate text-sm font-medium">{c.title}</p>
                <p className="mt-0.5 text-xs text-warmgray dark:text-[#b0ab9e]">
                  {c.messageCount} messages · {timeAgo(c.updatedAt)}
                </p>
              </button>
            ))}
          </div>
        </aside>

        {/* Main chat column */}
        <main className="flex min-w-0 flex-1 flex-col">
          {crisis && (
            <div className="border-b border-amber-300/50 bg-amber-50 px-5 py-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-950/50 dark:text-amber-200">
              <strong className="font-semibold">You&apos;re not alone in this.</strong> Please reach out
              to someone you trust, and consider contacting a crisis line or your local emergency number
              ({crisis.countryCode === "GLOBAL" ? "112 / 911 / 999" : crisis.countryCode}).{" "}
              <Link href="/crisis" className="font-semibold underline underline-offset-2">
                See crisis resources
              </Link>
            </div>
          )}

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 sm:px-8">
            <div className="mx-auto max-w-3xl space-y-5">
              {allMessages.length === 0 && !streaming && (
                <div className="flex flex-col items-center pt-14 text-center">
                  <Orb emotion={pendingEmotion?.primary ?? "calm"} size={110} />
                  <h2 className="mt-6 font-heading text-xl font-semibold">
                    {companion ? `${companion.name} is here` : "Your companion is here"} 🌿
                  </h2>
                  <p className="mt-2 max-w-sm text-sm leading-relaxed text-warmgray dark:text-[#b0ab9e]">
                    Say anything — how your day went, what&apos;s on your mind, or just start with one of these:
                  </p>
                  <div className="mt-6 flex flex-wrap justify-center gap-2.5">
                    {(companion?.openers ?? []).map((opener) => (
                      <button
                        key={opener}
                        onClick={() => send(opener)}
                        className="focus-ring rounded-full border border-[var(--border)] bg-[var(--bg-soft)] px-4 py-2 text-sm text-warmgray transition-all hover:border-matcha-400/60 hover:bg-matcha-50/60 dark:text-[#b0ab9e] dark:hover:bg-matcha-900/20"
                      >
                        {opener}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {allMessages.map((m) =>
                m.role === "user" ? (
                  <div key={m.id} className="flex justify-end">
                    <div className="max-w-[85%] rounded-2xl rounded-br-md bg-matcha-500 px-4 py-3 text-[15px] leading-relaxed text-white shadow-soft">
                      {m.content}
                    </div>
                  </div>
                ) : (
                  <div key={m.id} className="flex justify-start">
                    <div className="max-w-[90%] rounded-2xl rounded-bl-md border border-[var(--border)] bg-[var(--card-solid)] px-4 py-3 text-[15px] leading-relaxed shadow-softer">
                      <Markdown text={m.content} />
                      {m.id === "pending" && streaming && !m.content && (
                        <span className="mt-1 inline-flex gap-1" aria-label="Typing">
                          <span className="typing-dot h-2 w-2 rounded-full bg-matcha-500" />
                          <span className="typing-dot h-2 w-2 rounded-full bg-matcha-500" />
                          <span className="typing-dot h-2 w-2 rounded-full bg-matcha-500" />
                        </span>
                      )}
                    </div>
                  </div>
                ),
              )}
            </div>
          </div>

          {/* Composer */}
          <div className="border-t border-[var(--border)] bg-[--bg-soft] px-4 py-4 sm:px-8">
            <form onSubmit={onSubmit} className="mx-auto flex max-w-3xl items-end gap-3">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send(input);
                  }
                }}
                rows={1}
                placeholder={streaming ? "Arpita is writing…" : "Share what's on your mind…"}
                className="input-base max-h-32 min-h-[46px] resize-none py-3"
                aria-label="Message"
              />
              <button
                type="submit"
                disabled={streaming || !input.trim()}
                className="btn-primary focus-ring grid h-[46px] w-[46px] shrink-0 place-items-center rounded-full text-lg disabled:opacity-50"
                aria-label="Send"
              >
                ➤
              </button>
            </form>
            {error && (
              <p role="alert" className="mx-auto mt-2 max-w-3xl text-sm text-red-600 dark:text-red-400">
                {error}
              </p>
            )}
            <p className="mx-auto mt-2 max-w-3xl text-center text-[11px] leading-relaxed text-warmgray dark:text-[#b0ab9e]">
              Vichar is a supportive companion, not a licensed therapist or crisis service. If you&apos;re
              in immediate danger, call your local emergency number or visit the{" "}
              <Link href="/crisis" className="underline underline-offset-2">crisis page</Link>.
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}

export default function ChatPage() {
  return (
    <RequireAuth>
      <ChatContent />
    </RequireAuth>
  );
}
