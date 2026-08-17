import { config } from "../config.js";
import type { Personality } from "../data/personalities.js";
import type { EmotionEstimate } from "../emotion.js";
import type { Memory } from "../memory.js";
import type { ResourceDoc } from "./rag.js";
import type { UserRow } from "../types.js";
import { streamLocal } from "./local.js";
import { streamOpenAI } from "./openai.js";

export interface GenerateReplyInput {
  personality: Personality;
  emotion: EmotionEstimate;
  user: Pick<UserRow, "name" | "nickname" | "pronouns" | "language">;
  memories: Memory[];
  resources: ResourceDoc[];
  history: { role: "user" | "assistant"; content: string }[];
  userMessage: string;
}

/**
 * Provider-agnostic streaming reply. `local` is the zero-dependency demo
 * engine; `openai` requires LLM_PROVIDER=openai + OPENAI_API_KEY.
 */
export function streamReply(input: GenerateReplyInput): AsyncGenerator<string> {
  if (config.llm.provider === "openai" && config.llm.openaiApiKey) {
    return streamOpenAI(input);
  }
  return streamLocal({
    personality: input.personality,
    emotion: input.emotion,
    userMessage: input.userMessage,
    userName: input.user.nickname || input.user.name,
    resources: input.resources,
    context: input.history.map((h) => h.content),
  });
}

export const llmProviderName = (): string =>
  config.llm.provider === "openai" && config.llm.openaiApiKey
    ? `openai (${config.llm.openaiModel})`
    : "local (offline demo engine)";
