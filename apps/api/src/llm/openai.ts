import { config } from "../config.js";
import type { Personality } from "../data/personalities.js";
import type { EmotionEstimate } from "../emotion.js";
import type { Memory } from "../memory.js";
import type { ResourceDoc } from "./rag.js";
import { formatResources } from "./rag.js";
import { buildSystemPrompt } from "./systemPrompt.js";
import type { UserRow } from "../types.js";

export interface ChatHistoryItem {
  role: "user" | "assistant";
  content: string;
}

interface OpenAiInput {
  personality: Personality;
  emotion: EmotionEstimate;
  user: Pick<UserRow, "name" | "nickname" | "pronouns" | "language">;
  memories: Memory[];
  resources: ResourceDoc[];
  history: ChatHistoryItem[];
  userMessage: string;
}

/**
 * OpenAI-compatible streaming provider (works with OpenAI, OpenRouter,
 * Azure, local models exposing the same API). Requires LLM_PROVIDER=openai
 * and OPENAI_API_KEY in the environment.
 */
export async function* streamOpenAI(input: OpenAiInput): AsyncGenerator<string> {
  const system = buildSystemPrompt({
    personality: input.personality,
    emotion: input.emotion,
    memories: input.memories,
    user: input.user,
  }) + formatResources(input.resources);

  const messages = [
    { role: "system", content: system },
    ...input.history.map((h) => ({ role: h.role, content: h.content })),
    { role: "user", content: input.userMessage },
  ];

  const controller = new AbortController();
  const res = await fetch(`${config.llm.openaiBaseUrl}/chat/completions`, {
    method: "POST",
    signal: controller.signal,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.llm.openaiApiKey}`,
    },
    body: JSON.stringify({
      model: config.llm.openaiModel,
      messages,
      stream: true,
      temperature: 0.7,
      max_tokens: 600,
    }),
  });

  if (!res.ok || !res.body) {
    const body = await res.text().catch(() => "");
    throw new Error(`LLM provider error ${res.status}: ${body.slice(0, 200)}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (payload === "[DONE]") return;
        try {
          const json = JSON.parse(payload);
          const delta = json.choices?.[0]?.delta?.content;
          if (delta) yield delta;
        } catch {
          // skip keep-alive / partial lines
        }
      }
    }
  } finally {
    controller.abort();
  }
}
