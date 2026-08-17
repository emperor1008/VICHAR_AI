/**
 * Lightweight Retrieval-Augmented Generation.
 *
 * RAG grounds the LLM in *trusted* content — a curated wellness library —
 * rather than letting it improvise facts about mental health. For the MVP the
 * library is small and keyword-retrieved; in production this swaps to
 * embeddings + pgvector on Supabase with the same interface.
 */

export interface ResourceDoc {
  id: string;
  category: string;
  title: string;
  summary: string;
  body: string;
  source: string;
}

const LIBRARY: ResourceDoc[] = [
  {
    id: "anxiety-101",
    category: "anxiety",
    title: "Understanding anxiety in the moment",
    summary:
      "Anxiety is the body's alarm system overreacting. Grounding techniques help the nervous system settle.",
    body: "Anxiety is the body's alarm system firing when it thinks danger is near — even when the danger is a deadline or an email. Common signs: racing heart, fast breathing, tight chest, spiralling thoughts. Grounding techniques (5-4-3-2-1, slow breathing with a longer exhale) help signal safety to the nervous system. Anxiety is not a character flaw; it's a response, and responses can soften.",
    source: "Curated by Vichar wellness advisors",
  },
  {
    id: "overwhelm-101",
    category: "overwhelm",
    title: "When everything feels like too much",
    summary:
      "Overwhelm shrinks when you externalise it: write it all down, then pick one tiny next step.",
    body: "Overwhelm happens when the load in your head exceeds your sense of capacity. The fastest relief is externalising: write everything down — every task, every worry — then pick just ONE small next step. Action reduces the feeling of drowning. Remember that 'productivity' is not a measure of worth, and rest is part of capacity, not its enemy.",
    source: "Curated by Vichar wellness advisors",
  },
  {
    id: "sleep-101",
    category: "sleep",
    title: "Wind-down basics for better sleep",
    summary:
      "Consistent wind-down rituals, dim light, and screen breaks an hour before bed signal sleep.",
    body: "Sleep follows rhythm, not force. Try: same wake time daily, dim lights an hour before bed, no screens in bed, a short wind-down ritual (warm shower, gentle stretches, journaling worries onto paper so the mind can set them down). If you can't sleep, get up and do something quiet rather than lying there fighting it.",
    source: "Curated by Vichar wellness advisors",
  },
  {
    id: "breakup-101",
    category: "breakup",
    title: "Recovering from a breakup",
    summary:
      "Breakups are a grieving process. Self-compassion, routines, and time — not contact — are the healing tools.",
    body: "A breakup activates the same brain pathways as physical pain — it's a real loss, not an overreaction. Healing tools: allow the grief (it comes in waves), keep routines (sleep, meals, movement), lean on people who make you feel safe, write rather than text, and set boundaries with contact and social media. Self-compassion accelerates recovery; self-blame delays it.",
    source: "Curated by Vichar wellness advisors",
  },
  {
    id: "focus-101",
    category: "focus",
    title: "Study & focus without burning out",
    summary:
      "Short focus blocks (Pomodoro), a defined start, and separating planning from doing beat long grinding sessions.",
    body: "Concentration is built in short blocks: 25 minutes of single-task focus, 5 minutes of rest, repeated. Before you start, write down the one deliverable for the session. Separate planning from doing — plan once, then execute on autopilot. Exam stress drops when preparation is concrete and graded, not vague and looming.",
    source: "Curated by Vichar wellness advisors",
  },
  {
    id: "interview-101",
    category: "interview",
    title: "Calming interview nerves",
    summary:
      "Nerves are normal; structure beats them. Rehearse, prepare a few strong stories, and reframe nerves as energy.",
    body: "Interview anxiety is the body mistaking evaluation for danger. Preparation is the antidote: research the role, prepare 3-4 strong stories (situation → action → result), rehearse out loud, and prepare questions to ask. Reframe nerves as energy — the same arousal that makes you nervous makes you sharp. A 4-7-8 breath before entering calms the nervous system quickly.",
    source: "Curated by Vichar wellness advisors",
  },
  {
    id: "boundaries-101",
    category: "boundaries",
    title: "Setting healthy boundaries",
    summary:
      "Boundaries are how you protect your energy and relationships — said kindly, held firmly.",
    body: "A boundary is a clear statement of what you need, made kindly and held firmly: 'I can't talk right now, but let's catch up tomorrow.' Boundaries are not rejection — they protect the relationship by preventing resentment. Start small: one boundary with one person. Notice the guilt — it's normal — and let it pass without abandoning the boundary.",
    source: "Curated by Vichar wellness advisors",
  },
  {
    id: "loneliness-101",
    category: "loneliness",
    title: "Loneliness is common and survivable",
    summary:
      "Loneliness is a signal, not a verdict. Small daily connections and presence rebuild the feeling of belonging.",
    body: "Loneliness is the body's signal that it wants connection — as real as hunger. It isn't a reflection of your worth. Rebuild slowly: one message to an old friend, a club or class, volunteering, or simply being in a public place with people around. Connection is built from small repeated moments, not grand gestures. If loneliness persists with low mood, that's a good reason to talk to a professional.",
    source: "Curated by Vichar wellness advisors",
  },
];

const INDEX = LIBRARY.map((doc) => ({
  doc,
  terms: new Set(
    (doc.title + " " + doc.summary + " " + doc.body)
      .toLowerCase()
      .split(/[^a-z]+/),
  ),
}));

/**
 * Retrieve the most relevant resource docs for a message.
 * Keyword overlap scoring — drop-in replaceable with embeddings later.
 */
export function retrieveResources(text: string, limit = 2): ResourceDoc[] {
  const query = text.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 3);
  const stop = new Set(["that", "this", "with", "have", "from", "they", "them", "were", "what", "when", "where", "about", "there", "your", "you're", "would", "could", "should", "feeling", "feel", "like", "really", "just"]);
  const scored = INDEX.map(({ doc, terms }) => {
    let score = 0;
    for (const q of query) {
      if (stop.has(q)) continue;
      if (terms.has(q)) score += 1;
      if (terms.has(q + "s") || terms.has(q.replace(/s$/, ""))) score += 0.5;
    }
    // Category boost
    const catWords = doc.category.split(/[^a-z]+/);
    if (catWords.some((c) => query.includes(c))) score += 3;
    return { doc, score };
  });
  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((s) => s.doc);
}

/** Format retrieved docs for inclusion in the LLM context. */
export function formatResources(docs: ResourceDoc[]): string {
  if (!docs.length) return "";
  return (
    "\n\n# Trusted reference material (retrieved — use to ground your advice, don't quote verbatim)\n" +
    docs
      .map(
        (d) => `## ${d.title}\n${d.body}\nSource: ${d.source}`,
      )
      .join("\n\n")
  );
}
