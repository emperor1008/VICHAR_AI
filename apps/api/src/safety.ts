/**
 * Safety guardrails.
 *
 * Crisis detection is deliberately phrase-based (not single-word) to avoid
 * false alarms on benign usage ("killing time"). When a crisis is detected the
 * response pipeline short-circuits to a structured, compassionate response
 * with local resources — the AI never tries to "talk someone down" alone.
 */

export type CrisisSeverity = "none" | "medium" | "high";

export interface CrisisDetection {
  severity: CrisisSeverity;
  matchedSignals: string[];
}

const HIGH_SIGNALS = [
  /\b(i\s+(am|want|am going|have decided|plan)\s+to\s+(kill|end)\s+(myself|my\s+own\s+life))/i,
  /\b(kill\s+myself|kill\s+me\b|end\s+my\s+life|end\s+it\s+all|take\s+my\s+own\s+life)/i,
  /\b(want\s+to\s+die|wish\s+(i\s+was|i\s+were)\s+dead|hope\s+i\s+die|rather\s+be\s+dead)\b/i,
  /\b(going\s+to\s+kill\s+myself|gonna\s+kill\s+myself|about\s+to\s+end\s+my\s+life)\b/i,
  /\b(swallow(ed)?\s+(all\s+)?(my\s+)?pills|overdose|cut\s+my\s+wrists?|jump\s+off)\b/i,
  /\b(i\s+have\s+(a\s+)?plan\s+to\s+(end\s+my\s+life|kill\s+myself))\b/i,
  /\b(self[- ]?harm|self[- ]?harming|hurt\s+myself|cutting\s+myself)\b/i,
  /\b(nothing\s+left\s+to\s+live\s+for|better\s+off\s+without\s+me|don't\s+want\s+to\s+be\s+alive)\b/i,
  /\b(harm\s+others|hurt\s+someone|kill\s+someone|want\s+to\s+hurt)\b/i,
];

const MEDIUM_SIGNALS = [
  /\b(suicide|suicidal|suicidal\s+thoughts?)\b/i,
  /\b(thinking\s+about\s+death|thought\s+of\s+dying|thought\s+about\s+dying)\b/i,
  /\b(don't\s+see\s+(any\s+)?(reason|point)\s+to\s+(go\s+on|live))\b/i,
  /\b(what's\s+the\s+point\s+of\s+living|why\s+am\s+i\s+here|no\s+reason\s+to\s+live)\b/i,
  /\b(i\s+feel\s+like\s+giving\s+up)\b/i,
];

export function detectCrisis(text: string): CrisisDetection {
  const matchedSignals: string[] = [];
  for (const re of HIGH_SIGNALS) {
    if (re.test(text)) {
      matchedSignals.push(re.source.replace(/\\/g, ""));
      return { severity: "high", matchedSignals };
    }
  }
  for (const re of MEDIUM_SIGNALS) {
    if (re.test(text)) {
      matchedSignals.push(re.source.replace(/\\/g, ""));
    }
  }
  return {
    severity: matchedSignals.length ? "medium" : "none",
    matchedSignals,
  };
}

/**
 * The structured crisis response used instead of a normal reply. Empathy
 * first, then concrete next steps, then local resources. Never isolation.
 */
export function crisisResponse(countryCode: string, name = ""): string {
  const firstName = name.split(" ")[0];
  const greeting = firstName ? `${firstName}, I'm` : "I'm";

  return [
    `Thank you for telling me this — that takes real courage, and I'm glad you did.`,
    `${greeting} really worried about you right now, and you deserve support that's immediate and human. I'm not a crisis service, but there are people who are, and they want to hear from you.`,
    ``,
    `**Please do one of these now:**`,
    `1. Call or text a crisis line in your country (below) — they're free, confidential, and available 24/7.`,
    `2. If you are in immediate danger, call your local emergency number (${countryCode === "GLOBAL" ? "112/911/999 — your local emergency number" : "your local emergency number"}) right away.`,
    `3. Reach out to someone you trust — a family member, friend, or neighbour — and tell them how you're feeling. Please don't stay alone with this.`,
    ``,
    `**Crisis resources for your region:**`,
    `• National helplines and crisis text lines are listed on your **Crisis Help** page — open it and pick one, or tell me your country and I'll share the numbers here.`,
    ``,
    `You are not a burden, and you are not alone in this. Please reach out now — and I'll stay right here with you.`,
  ].join("\n");
}
