/**
 * Emotion detection engine.
 *
 * A transparent, lexicon + signal based estimator. It produces an *estimated*
 * emotional state with scores and signals — never a certainty claim. The LLM
 * layer uses these scores to adapt tone, pacing, and content.
 *
 * The pipeline:
 *   1. Normalise the text (lowercase, strip emoji, expand common contractions).
 *   2. Score each emotion dimension against a weighted lexicon.
 *   3. Apply signal adjustments: negation, intensifiers, punctuation, casing,
 *      self-reference, question density, and message length (proxy for pace).
 *   4. Blend with recent conversation emotion for continuity.
 *   5. Emit primary emotion, per-dimension scores, valence/energy, confidence.
 */

export type EmotionKey =
  | "calm"
  | "anxious"
  | "overwhelmed"
  | "hopeful"
  | "joyful"
  | "frustrated"
  | "sad"
  | "lonely"
  | "angry"
  | "neutral";

export interface EmotionEstimate {
  primary: EmotionKey;
  scores: Record<EmotionKey, number>;
  valence: number; // -1 (negative) .. +1 (positive)
  energy: number; // 0 (still) .. 1 (high)
  confidence: "low" | "medium" | "high";
  signals: string[];
}

const DIMENSIONS: EmotionKey[] = [
  "calm",
  "anxious",
  "overwhelmed",
  "hopeful",
  "joyful",
  "frustrated",
  "sad",
  "lonely",
  "angry",
  "neutral",
];

interface LexEntry {
  w: number;
  i?: number; // intensifier override for strong words
}

const LEXICON: Record<EmotionKey, Record<string, LexEntry>> = {
  calm: {
    "at peace": { w: 1.2 }, relaxed: { w: 0.9 }, peaceful: { w: 1.0 }, calm: { w: 0.8 },
    "feeling better": { w: 0.8 }, content: { w: 0.8 }, grounded: { w: 1.0 }, "okay now": { w: 0.6 },
    settled: { w: 0.9 }, "in control": { w: 0.7 }, fine: { w: 0.3 },
  },
  anxious: {
    anxious: { w: 1.0 }, anxiety: { w: 1.0 }, worried: { w: 0.9 }, worry: { w: 0.8 },
    nervous: { w: 0.9 }, scared: { w: 0.9 }, afraid: { w: 0.9 }, panic: { w: 1.1 },
    panicking: { w: 1.2 }, "racing thoughts": { w: 1.0 }, uneasy: { w: 0.8 },
    "on edge": { w: 0.9 }, dread: { w: 1.0 }, terrified: { w: 1.2 }, "can't breathe": { w: 1.2 },
    heart: { w: 0.3 }, shaking: { w: 0.5 }, restless: { w: 0.7 }, overthinking: { w: 0.9 },
    "overthink": { w: 0.9 }, "what if": { w: 0.7 }, tense: { w: 0.7 },
  },
  overwhelmed: {
    overwhelmed: { w: 1.2 }, "too much": { w: 1.0 }, "so much": { w: 0.5 }, drowning: { w: 1.1 },
    "can't cope": { w: 1.1 }, "can't handle": { w: 1.0 }, swamped: { w: 1.0 }, "on top of me": { w: 1.0 },
    "falling apart": { w: 1.1 }, "burning out": { w: 1.0 }, burnout: { w: 1.0 }, exhausted: { w: 0.8 },
    tired: { w: 0.4 }, "no energy": { w: 0.7 }, stuck: { w: 0.6 }, "don't know where to start": { w: 1.0 },
    "so many things": { w: 0.9 }, chaos: { w: 0.8 }, "can't focus": { w: 0.7 },
  },
  hopeful: {
    hopeful: { w: 1.0 }, hope: { w: 0.8 }, excited: { w: 0.8 }, "looking forward": { w: 1.0 },
    optimistic: { w: 1.0 }, "will get better": { w: 0.9 }, progress: { w: 0.6 }, "feeling better": { w: 0.7 },
    "worked out": { w: 0.6 }, "new start": { w: 0.9 }, opportunity: { w: 0.6 }, "can do this": { w: 0.8 },
    "trying": { w: 0.3 }, "better today": { w: 0.9 }, "improving": { w: 0.9 },
  },
  joyful: {
    happy: { w: 1.0 }, "so happy": { w: 1.2 }, glad: { w: 0.8 }, great: { w: 0.6 }, amazing: { w: 0.9 },
    wonderful: { w: 1.0 }, excited: { w: 0.8 }, "loving it": { w: 0.9 }, "made my day": { w: 1.0 },
    "feeling good": { w: 0.9 }, "on top of the world": { w: 1.2 }, grateful: { w: 0.9 },
    proud: { w: 0.8 }, awesome: { w: 0.9 }, fantastic: { w: 1.0 }, "love it": { w: 0.7 },
    // Positive outcomes (Validation Gate) — celebrate good news, never
    // let it fall to the generic greeting. "passed" avoids "passed away".
    "got the job": { w: 1.0 }, "got promoted": { w: 1.1 }, "got a promotion": { w: 1.0 },
    "got selected": { w: 0.9 }, "got accepted": { w: 0.9 }, "got admitted": { w: 0.9 },
    "got through": { w: 0.7 }, "got the offer": { w: 1.0 },
    aced: { w: 1.0 }, nailed: { w: 0.8 }, "cracked the": { w: 0.8 },
    "cleared the exam": { w: 0.9 }, "cleared the interview": { w: 0.9 }, "cleared the test": { w: 0.9 },
    "passed my exam": { w: 0.9 }, "passed the exam": { w: 0.9 }, "passed the interview": { w: 0.9 }, "passed the test": { w: 0.9 },
    "i passed": { w: 1.0 }, "i cleared": { w: 0.9 }, "i aced": { w: 1.0 },
    "won the": { w: 0.8 }, "got selected for": { w: 0.9 },
  },
  frustrated: {
    frustrated: { w: 1.1 }, frustrating: { w: 1.0 }, annoyed: { w: 0.8 }, irritating: { w: 0.8 },
    "fed up": { w: 1.0 }, "sick of": { w: 0.9 }, "tired of": { w: 0.8 }, "can't stand": { w: 0.9 },
    "so done": { w: 1.0 }, "why does this always": { w: 0.9 },
    "not fair": { w: 0.7 }, useless: { w: 0.6 }, "keep failing": { w: 0.8 }, "no matter what i do": { w: 0.9 },
    failed: { w: 1.0 }, fail: { w: 0.6 }, rejected: { w: 1.0 }, rejection: { w: 0.9 },
    "didn't get the job": { w: 1.1 }, "blew it": { w: 1.0 }, "messed up": { w: 0.9 },
    "went wrong": { w: 0.7 }, "didn't work out": { w: 0.8 },
  },
  sad: {
    sad: { w: 1.0 }, unhappy: { w: 0.9 }, "feeling down": { w: 1.0 }, down: { w: 0.7 },
    depressed: { w: 0.9 }, "so low": { w: 1.0 }, miserable: { w: 1.1 }, cry: { w: 0.9 },
    crying: { w: 1.0 }, heartbroken: { w: 1.1 }, "in pieces": { w: 1.1 }, empty: { w: 0.9 },
    numb: { w: 0.9 }, "no motivation": { w: 0.8 }, "no point": { w: 0.9 }, hopeless: { w: 1.1 },
    "nothing matters": { w: 1.0 }, "can't stop crying": { w: 1.2 }, hurt: { w: 0.7 }, miss: { w: 0.5 },
    "miss them": { w: 0.9 }, "broke up": { w: 0.9 }, breakup: { w: 0.8 }, "lost": { w: 0.6 },
  },
  lonely: {
    lonely: { w: 1.1 }, alone: { w: 0.9 }, "no one": { w: 0.8 }, "nobody": { w: 0.8 },
    "no friends": { w: 1.1 }, "feel invisible": { w: 1.0 }, isolated: { w: 1.0 }, "left out": { w: 0.9 },
    "can't talk to anyone": { w: 1.0 }, "no one understands": { w: 0.9 }, "by myself": { w: 0.5 },
  },
  angry: {
    angry: { w: 1.0 }, "so angry": { w: 1.2 }, mad: { w: 0.9 }, furious: { w: 1.2 },
    rage: { w: 1.2 }, hate: { w: 0.8 }, "pissed": { w: 1.0 }, annoyed: { w: 0.6 },
    betrayed: { w: 1.0 }, "let down": { w: 0.8 }, unfair: { w: 0.7 },
  },
  neutral: {
    "i'm fine": { w: 0.8 }, okay: { w: 0.4 }, "not sure": { w: 0.4 }, "just checking": { w: 0.6 },
    "nothing much": { w: 0.8 }, "how are you": { w: 0.5 }, "thanks": { w: 0.4 }, ok: { w: 0.4 },
  },
};

const INTENSIFIERS = ["so", "really", "very", "extremely", "super", "incredibly", "totally", "absolutely", "literally", "way too"];
const NEGATIONS = ["not", "don't", "dont", "doesn't", "didn't", "can't", "cant", "won't", "never", "no", "isn't", "aren't", "wasn't", "weren't"];
const HEDGES = ["maybe", "kinda", "sort of", "i guess", "i think", "somewhat", "a little"];

/**
 * Light social chit-chat — never an emotional state.
 * Category detection is shared with the response engine (local.ts) so a
 * casual message gets a conversational reply AND never inherits the
 * previous conversation's emotion.
 */
export type SmallTalkCategory =
  | "greeting"
  | "checkin"
  | "dontknow"
  | "status"
  | "thanks"
  | "bye"
  | "casual";

const SMALL_TALK_CATEGORIES: { cat: SmallTalkCategory; re: RegExp }[] = [
  {
    cat: "greeting",
    re: /^\s*(hi+|hello+|hey+|heya|hiya|yo+|howdy|hola|namaste|sup|hey there|hi there|hello there|good (morning|afternoon|evening|day)|good day)(\s*[!.,?]?\s*)?$/i,
  },
  {
    cat: "checkin",
    re: /^\s*(how are you|how r u|how's it going|hows it going|how are you doing|how have you been|how's everything|hows everything|what's up|wassup|whats up|what's happening|whats happening|what's going on|whats going on|what's new|whats new|how's your day|hows your day)(\s*[!.,?]?\s*)?$/i,
  },
  {
    cat: "dontknow",
    re: /^\s*(idk|i don'?t know|i dont know|don'?t know|dunno|not sure|no idea|no clue|i have no idea|idk what to say|i don'?t know what to say|whatever)(\s*[!.,?]?\s*)?$/i,
  },
  {
    cat: "status",
    re: /^\s*((i'?m|im|i am)\s+(doing\s+)?(fine|ok|okay|good|alright|all right|great|not bad|pretty good|so so|meh|chilling|just chilling|relaxing|vibing)|(nothing much|not much|nothing|same old|same as usual|just here|i'?m here|im here|just checking in|ok|okay|fine|alright|meh|so so|just chilling|just relaxing|just vibing|chilling|relaxing|vibing))(\s*[!.,?]?\s*)?$/i,
  },
  {
    cat: "thanks",
    re: /^\s*(thanks|thank you|thank u|thx|ty|thanks a lot|thank you so much|thank you very much|appreciate it|appreciated)(\s*[!.,?]?\s*)?$/i,
  },
  {
    cat: "bye",
    re: /^\s*(bye|goodbye|good bye|see you|see ya|see u|later|gotta go|gtg|good night|gn|talk to you later|ttyl|bye bye|cya|peace|peace out)(\s*[!.,?]?\s*)?$/i,
  },
  {
    cat: "casual",
    re: /^\s*(haha|lol|lmao|lmfao|hmm|mhm|yeah|yea|yep|yup|yes|yess|sure|nice|cool|awesome|wow|woah|oh|ohh|ok cool|lol ok|sounds good|that's cool|thats cool|ok ok|okay okay|hmm ok|alright then)(\s*[!.,?]?\s*)?$/i,
  },
];

/** Classify a casual/small-talk message, or null if it has real substance. */
export function smallTalkCategory(text: string): SmallTalkCategory | null {
  const t = text
    .toLowerCase()
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!t || t.length > 60) return null;
  for (const { cat, re } of SMALL_TALK_CATEGORIES) {
    if (re.test(t)) return cat;
  }
  return null;
}

export function isSmallTalk(text: string): boolean {
  return smallTalkCategory(text) !== null;
}

/**
 * Situational categories — what the conversation is ABOUT (vs. how the user
 * feels). Shared with the response engine (local.ts) so each situation gets
 * its own emoji-rich, companion-specific reply pool. Order matters: the most
 * specific/urgent situations are checked first.
 */
export type SituationKey =
  | "moodoff"
  | "overthinking"
  | "depression"
  | "breakup"
  | "patchup"
  | "relationship"
  | "exam"
  | "interview"
  | "unwell";

const SITUATIONS: { key: SituationKey; re: RegExp }[] = [
  {
    key: "depression",
    re: /(depress|hopeless|no point|can'?t get out of bed|don'?t want to do anything|nothing matters|worthless|feel(ing)? numb|empty inside|tired of everything|feel like giving up|want to give up)/i,
  },
  {
    key: "unwell",
    re: /(not (feeling )?well|not doing well|unwell|under the weather|feeling sick|feel sick|got sick|been sick|i'?m sick(?! of)|don'?t feel (good|well)|dont feel (good|well)|feel(ing)? ill|i'?m not ok(ay)?\b|feel(ing)? (really )?(terrible|awful|rough|drained)|feel(ing)? unwell|sick today)/i,
  },
  {
    key: "breakup",
    re: /(broke ?up|break ?up|breakup|ended things|dumped|left me|cheated|cheating on me|walked out|it'?s over between us|we'?re done|\bmy ex\b|\bex (boyfriend|girlfriend|husband|wife|partner))/i,
  },
  {
    key: "patchup",
    re: /(patch ?(things?|it)? ?up|make up (with|after)|reconcile|after our (fight|argument)|we (had|got into) a (fight|argument)|we'?re not talking|said sorry|apologiz|want to fix (this|things|us))/i,
  },
  {
    key: "overthinking",
    re: /(overthink|over ?thinking|can'?t stop thinking|keep thinking|racing thoughts|spiral(ing)?|mind won'?t stop|thinking too much|can'?t switch off|cant switch off)/i,
  },
  {
    key: "exam",
    re: /(exam|exams|test tomorrow|boards|semester|syllabus|revision|revising|studying|study stress|exam anxiety|assignment deadline|marks|grades|scored|preparation)/i,
  },
  {
    key: "interview",
    re: /(interview|resume|résumé|hr round|placement|hiring|screening call|interview (tension|anxiety|nerves)|career fair|job offer)/i,
  },
  {
    key: "relationship",
    re: /(boyfriend|girlfriend|partner|crush|dating|married|husband|wife|relationship|should i (text|call)|is (he|she) (interested|into me)|my (bf|gf)|long distance|in a relationship)/i,
  },
  {
    key: "moodoff",
    re: /(mood (is|has been|feels) ?off|moodoff|not in the mood|feeling off|feel(ing)? off|having a bad day|bad day|down today|feeling down|so low|not myself|feeling blue|in a slump|off day|low mood|having an off day)/i,
  },
];

/**
 * Outcome detection (Validation Gate, Step 1-2): did something already
 * HAPPEN? Positive ("got the job", "I passed") must be celebrated — never
 * condoled; negative ("failed", "didn't get it") must be acknowledged —
 * never congratulated. Returns null when no clear outcome is present (fears
 * like "what if I fail" are NOT outcomes).
 */
export type OutcomeKey = "positive" | "negative";

export function detectOutcome(text: string): OutcomeKey | null {
  const t = text.toLowerCase();
  const positive =
    /\b(got (the |my )?(job|offer|promotion|selected|admission)|got (in|through|selected)|got promoted|got a (promotion|raise)|got (selected|accepted|admitted)( for| into| at| to)?|passed(?! (away|on))( the | my )?(exam|test|interview|boards|papers)?|cleared (the |my )?(exam|interview|test|boards)|selected (for|in)|ranked (first|second|top)|secured (the |my )?(job|offer|rank|seat)|topped (the |my )?(class|exam|school)|admitted to|accepted (into|at)|promoted( at| to|!)|achieved (my |the )?|qualified (for|in)|cracked (the |my )?|succeeded|graduated|awarded (the |a )?|shortlisted( for)?|won(?!'?t)( the | my | a |!)|aced (the |my )?|nailed (the |my )?|made it (into|to|through)|i passed|i cleared|i aced|i won|got the job|got the offer)\b/i.test(t);
  if (positive) return "positive";
  const negative =
    /\b(failed (the |my |our |to |it )?|didn'?t (pass|get|clear|make|qualify|secure|select)|did not (pass|get|clear|make|qualify)|wasn'?t selected|was not selected|got rejected|got (fired|laid off)|got cut|rejected (me|my)|broke ?up( with (me|my))?|left me|ditched me|dumped me|cheated on me|walked out|blew (it|the |my )|messed (up|it)|screwed (up|it)|flunked|bombed|missed (the |my |out)|cancelled my|canceled my|not selected|didn'?t make (it|the)|couldn'?t (clear|pass|crack)|no offer|rejected me)\b/i.test(t);
  if (negative) return "negative";
  return null;
}

/** Detect what this message is about (situation), or null for general venting. */
export function situationCategory(text: string): SituationKey | null {
  const t = text
    .toLowerCase()
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!t) return null;
  for (const { key, re } of SITUATIONS) {
    if (re.test(t)) return key;
  }
  return null;
}

/* ============ Emotional & psychological pattern framework ============
 * Steps 2-5 of the Vichar empathy model. These are pattern-recognition
 * helpers — never diagnoses. They are surfaced on the emotion estimate's
 * `signals` so every consumer (local engine, LLM prompt, future UI) can
 * adapt tone, pacing, and content to what the user actually needs.
 */

/** Behavioural patterns (Step 3) — used only to improve communication. */
export type PatternKey =
  | "overthinking"
  | "catastrophizing"
  | "black-and-white-thinking"
  | "negative-self-talk"
  | "self-blame"
  | "perfectionism"
  | "fear-of-failure"
  | "fear-of-rejection"
  | "fear-of-judgment"
  | "fear-of-abandonment"
  | "low-self-esteem"
  | "low-confidence"
  | "impostor"
  | "people-pleasing"
  | "comparison"
  | "avoidance"
  | "decision-paralysis"
  | "rumination"
  | "burnout"
  | "social-anxiety"
  | "relationship-insecurity"
  | "attachment"
  | "emotional-dependence"
  | "trust-issues"
  | "learned-helplessness"
  | "low-motivation"
  | "procrastination"
  | "self-criticism"
  | "cognitive-overload"
  | "emotional-suppression";

const PATTERN_RE: { key: PatternKey; re: RegExp }[] = [
  { key: "overthinking", re: /(overthink|can'?t stop thinking|keep thinking|mind won'?t stop|thinking too much|spiral)/ },
  { key: "catastrophizing", re: /(worst case|everything (will|is going to) go wrong|i'?ll never (make it|pass|get|find)|everyone (will|is going to)|it'?s all over|disaster|ruin(ed|s)? everything|gonna (fail|mess up)|what if (it|everything) (goes|turns|ends) (wrong|badly|terribly)|end of the world)/ },
  { key: "black-and-white-thinking", re: /(black.?and.?white|no in.?between|i see things in extremes|either (it works|i succeed|it'?s perfect) or|everything is (always|never)|it'?s (perfect|ruined) or (nothing|useless))/ },
  { key: "negative-self-talk", re: /(i'?m (so )?(useless|stupid|dumb|worthless|a failure|an idiot|a loser)|i hate myself|i always ruin (things|everything)|i'?m the problem)/ },
  { key: "self-blame", re: /(it'?s (all )?my fault|i blame myself|i caused (this|it)|i ruined (it|everything)|i should have known better|my fault)/ },
  { key: "perfectionism", re: /(perfection|perfectionist|can'?t make (a|any) mistake|has to be perfect|needs? to be (perfect|flawless)|not good enough (unless|if)|all or nothing|flawless)/ },
  { key: "fear-of-failure", re: /(afraid of failing|scared of failing|fear of failure|what if i fail|i can'?t fail|must not fail|failure would|if i fail)/ },
  { key: "fear-of-rejection", re: /(afraid of (being )?rejected|fear of rejection|scared (they|she|he)'?ll reject|reject me|won'?t like me back|afraid to confess|scared to ask (them )?out)/ },
  { key: "fear-of-judgment", re: /(what will (they|people|others) think|people will (judge|think)|judg(ed|ing) me|scared to be judged|afraid of (their )?judgment|everyone is (watching|looking at) me)/ },
  { key: "fear-of-abandonment", re: /((afraid|scared) (of being abandoned|everyone will leave|that (they|he|she|everyone) (will|might) leave|they'?ll (leave|go))|fear of abandonment|scared of being left|abandoned again|always afraid (of losing|they'?ll (go|leave)))/ },
  { key: "low-self-esteem", re: /(i'?m (not good enough|unlovable|not enough|nothing|worthless)|i don'?t like myself|i hate who i am|low self.?esteem|i'?m not worthy)/ },
  { key: "low-confidence", re: /(no confidence|lost (all )?my confidence|low confidence|don'?t believe in myself|not confident (enough|at all)|i doubt myself|i'?m not capable)/ },
  { key: "impostor", re: /(impostor|imposter|fraud|i don'?t belong (here)?|everyone will find out|i'?m just (lucky|faking it)|i don'?t deserve this|feel like a fake)/ },
  { key: "people-pleasing", re: /(can'?t say no|always saying yes|people pleaser|please everyone|can'?t disappoint (anyone|them|people)|need everyone to like me|putting everyone (else )?first|scared of upsetting)/ },
  { key: "comparison", re: /(comparing myself|everyone (else|around me) is|they'?re all (doing better|ahead)|i'?m behind everyone|looks like (he|she|they|everyone) has it|why can'?t i be like|social media makes me)/ },
  { key: "avoidance", re: /(keep avoid|avoiding it|can'?t face (it|him|her|them)|don'?t want to deal with|putting it off|dreading it)/ },
  { key: "decision-paralysis", re: /(can'?t decide|decision paralysis|stuck (choosing|between)|every option (seems|feels)|don'?t know which (one|to pick|to choose)|can'?t choose|too many options)/ },
  { key: "rumination", re: /(can'?t let (it|that|this) go|keep replaying|can'?t stop thinking about (what|that)|going over it again|can'?t move past (it|this|that)|why did i (say|do) that)/ },
  { key: "burnout", re: /(burn(ed|t)? ?out|completely drained|running on empty|no energy left|burnt out|exhausted all the time|soul tired)/ },
  { key: "social-anxiety", re: /(social anx|anxious around people|scared of (social|groups|parties)|don'?t know what to say (in|around)|dread(ing)? (social|meetups)|people exhaust me)/ },
  { key: "relationship-insecurity", re: /(does (he|she) (still )?love me|afraid (he|she) (will|might) leave|insecure in (my|the) relationship|always anxious (about|in) my relationship|jealous of|why (isn'?t|is not) (he|she) (texting|calling|replying))/ },
  { key: "attachment", re: /(afraid of being abandoned|abandonment (issues|fear)|clingy|need constant reassurance|scared of losing (them|him|her)|attached (too|so) fast|fear of being left)/ },
  { key: "emotional-dependence", re: /(i need (them|him|her|someone) (to be|to feel)|can'?t be happy without|i'?m nothing without|need (them|him|her) to feel (okay|complete)|don'?t know who i am without)/ },
  { key: "trust-issues", re: /(can'?t trust (anyone|people)|trust issues|everyone (lies|leaves|abandons)|don'?t trust anyone|hard to trust)/ },
  { key: "learned-helplessness", re: /(nothing i do (works|helps|matters)|why even try|i can'?t change (anything|it|this)|no matter what i do|what'?s the point of trying)/ },
  { key: "low-motivation", re: /(no motivation|lost all motivation|don'?t feel like (doing|trying) anything|can'?t get started|nothing feels worth doing|zero motivation)/ },
  { key: "procrastination", re: /(procrastinat|keep putting (it|things) off|leave(ing)? everything (to|for) the last minute|can'?t (start|begin)|stalling)/ },
  { key: "self-criticism", re: /(i'?m too (hard|harsh) on myself|i (always|keep) criticize myself|nothing i do is good enough|i beat myself up|self.?critic)/ },
  { key: "cognitive-overload", re: /(too many things (at once|to do)|can'?t think straight|cognitive overload|my brain is (full|fried|overloaded)|information overload|so much going on)/ },
  { key: "emotional-suppression", re: /(i don'?t (show|feel) emotions|i bottle (things|everything) up|i push (my )?(feelings|emotions) away|can'?t cry|never let (it|my feelings) show|i suppress)/ },
];

/** Detect behavioural patterns in the message (never a diagnosis). */
export function detectPattern(text: string): PatternKey[] {
  const t = normalise(text);
  const found: PatternKey[] = [];
  for (const { key, re } of PATTERN_RE) {
    if (re.test(t)) found.push(key);
  }
  return found;
}

/**
 * Hidden emotions beneath the words (e.g. "my friend ditched me" often
 * carries rejection, hurt, and feeling unimportant). The engine responds
 * to these, not just the surface event.
 */
export type HiddenEmotionKey =
  | "rejection"
  | "betrayal"
  | "unimportant"
  | "loneliness"
  | "self-doubt"
  | "anger"
  | "confusion"
  | "guilt"
  | "hurt";

const HIDDEN_EMOTION_RE: { key: HiddenEmotionKey; re: RegExp }[] = [
  { key: "rejection", re: /(ditched|left me out|excluded|not invited|stood me up|rejected|turned me down|doesn'?t want me|ignored me|ghosted|blown off)/ },
  { key: "betrayal", re: /(betray|backstabbed|lied to me|behind my back|talked about me|shared my secret|went behind|cheated on me|broke (their|his|her) word)/ },
  { key: "unimportant", re: /(didn'?t even (text|call|reply|show)|forgot (about me|my)|never (asks|cares|listens|shows up)|not (even )?a priority|i don'?t matter|treated like (nothing|i don'?t matter)|always last)/ },
  { key: "loneliness", re: /(no one (cares|shows|comes|notices)|all by myself|nobody|alone again|don'?t have anyone|everyone'?s busy)/ },
  { key: "self-doubt", re: /(what'?s wrong with me|maybe i'?m the problem|did i do something (wrong)|why don'?t they like me|i must have done)/ },
  { key: "anger", re: /(so (mad|angry|furious) at|can'?t believe they|how dare|i'?m (mad|angry) at)/ },
  { key: "confusion", re: /(don'?t understand why|why would they|confused about|didn'?t see it coming|makes no sense to me)/ },
  { key: "guilt", re: /(it'?s my fault|i should have (known|done|said)|if only i)/ },
  { key: "hurt", re: /(hurt (me|my feelings)|heartbroken|crushed|devastated|broken by|in pieces)/ },
];

/** Detect emotions hiding beneath the surface of the words. */
export function detectHiddenEmotion(text: string): HiddenEmotionKey[] {
  const t = normalise(text);
  const found: HiddenEmotionKey[] = [];
  for (const { key, re } of HIDDEN_EMOTION_RE) {
    if (re.test(t)) found.push(key);
  }
  return found;
}

/** What the user wants from this exchange (Step 4). */
export type IntentKey =
  | "listen"
  | "comfort"
  | "advice"
  | "coaching"
  | "motivation"
  | "brainstorm"
  | "information"
  | "problem-solving"
  | "decision"
  | "casual"
  | "celebration"
  | "venting";

export function detectIntent(
  text: string,
  emotion: Pick<EmotionEstimate, "primary" | "valence">,
): IntentKey {
  const t = normalise(text);
  if (
    emotion.primary === "joyful" &&
    /(got|passed|won|accepted|cleared|promotion|achieved|selected|ranked|secured|topped|offer|admitted)/.test(t)
  ) {
    return "celebration";
  }
  if (/\bshould i\b|which (one|option) should i|help me decide|can'?t decide|what do you think i should/.test(t)) return "decision";
  if (/(advice|what (should|can) i do about|how do i (handle|deal|fix|cope)|what do you suggest|your (thoughts|opinion))/.test(t)) return "advice";
  if (/(how (do|can|should) i (get|fix|solve|stop|start|make)|what'?s the best way|i need a plan|help me plan)/.test(t)) return "problem-solving";
  if (/(explain|what is|what are|how does|why do|tell me about|meaning of|difference between)/.test(t)) return "information";
  if (/(motivat|don'?t feel like (doing|trying)|no motivation|i can'?t do it|i want to give up|lazy|can'?t be bothered)/.test(t)) return "motivation";
  if (/(ideas?|options?|brainstorm|what if i (tried|did|started)|alternatives|can'?t think of)/.test(t)) return "brainstorm";
  const q = (t.match(/\?/g) || []).length;
  if (emotion.primary !== "neutral" && emotion.valence < 0) {
    if (q === 0 && t.length > 60) return "venting";
    return "listen";
  }
  // A long, self-referential story with no question is usually venting,
  // even when the lexicon scores it neutral.
  if (t.length > 60 && q === 0 && /\b(i|my|me)\b/.test(t)) return "venting";
  return "casual";
}

/** Emotional intensity (Step 5) — the higher it is, the slower and more validating we respond. */
export type IntensityKey = "verylow" | "low" | "moderate" | "high" | "extreme";

export function estimateIntensity(e: EmotionEstimate): IntensityKey {
  const strong = e.scores[e.primary] ?? 0;
  if (e.signals.includes("panic-intent") || strong >= 4) return "extreme";
  if (strong >= 2.4) return "high";
  if (strong >= 1.4) return "moderate";
  if (strong >= 0.7) return "low";
  return "verylow";
}

/** Unmet emotional need the user is expressing (Step 2). */
export type NeedKey =
  | "heard"
  | "validation"
  | "encouragement"
  | "advice"
  | "motivation"
  | "planning"
  | "reassurance"
  | "honest-feedback"
  | "accountability"
  | "comfort"
  | "problem-solving"
  | "celebration"
  | "reflection"
  | "perspective"
  | "hope"
  | "boundaries"
  | "decision"
  | "confidence";

export function detectNeed(
  e: EmotionEstimate,
  intent: IntentKey,
  patterns: PatternKey[],
  intensity: IntensityKey,
): NeedKey {
  if (intent === "celebration") return "celebration";
  if (intent === "decision" || patterns.includes("decision-paralysis")) return "decision";
  if (intent === "advice" || intent === "problem-solving" || intent === "brainstorm") return "problem-solving";
  if (intent === "information") return "reflection";
  if (intent === "motivation" || patterns.includes("low-motivation")) return "motivation";
  if (intensity === "high" || intensity === "extreme") return "comfort";
  if (patterns.includes("learned-helplessness")) return "hope";
  if (patterns.includes("emotional-dependence")) return "boundaries";
  if (patterns.includes("trust-issues") || patterns.includes("fear-of-abandonment")) return "reassurance";
  if (
    patterns.includes("low-self-esteem") ||
    patterns.includes("low-confidence") ||
    patterns.includes("impostor") ||
    patterns.includes("fear-of-failure") ||
    patterns.includes("fear-of-rejection") ||
    patterns.includes("self-criticism")
  ) {
    return "confidence";
  }
  if (e.primary === "anxious" || e.primary === "overwhelmed") return "reassurance";
  if (e.primary === "sad" || e.primary === "lonely") return "hope";
  if (intent === "venting" || intent === "listen") return "heard";
  if (e.primary === "calm" || e.primary === "neutral") return "reflection";
  return "validation";
}

function normalise(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, " ")
    .replace(/[^a-z0-9'\s.,!?]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function detectSignals(text: string, norm: string): string[] {
  const signals: string[] = [];
  const words = norm.split(/\s+/);
  if (norm === text.toLowerCase()) {
    // lowercase message => low arousal unless keywords say otherwise
  }
  if (/[A-Z]/.test(text) && text.length > 12) signals.push("all-caps");
  if ((text.match(/!/g) || []).length >= 2) signals.push("multiple-exclamations");
  const q = (text.match(/\?/g) || []).length;
  if (q >= 1) signals.push(`questions-${q}`);
  if (words.length < 8) signals.push("short-message");
  if (words.length >= 60) signals.push("long-message");
  if (words.some((w) => INTENSIFIERS.includes(w))) signals.push("intensified");
  if (words.some((w) => NEGATIONS.includes(w))) signals.push("negation");
  if (HEDGES.some((h) => norm.includes(h))) signals.push("hedged");
  if (/(i am|i'm|i feel|i've been|im)\b/.test(norm)) signals.push("self-referential");
  if (/\b(mom|dad|mother|father|sister|brother|family|friend|boyfriend|girlfriend|partner|ex)\b/.test(norm)) signals.push("relationship-context");
  if (/\b(exam|test|interview|deadline|assignment|grade|job|work|career)\b/.test(norm)) signals.push("achievement-context");
  if (/(\d{1,2}:\d{2}|am\b|pm\b|tonight|tomorrow|next week)/.test(norm)) signals.push("time-pressure");
  if (/(\bpanic|panicking|terrified|can'?t breathe|cant breathe|scared to death)/.test(norm)) signals.push("panic-intent");
  return signals;
}

/**
 * Score a single dimension, handling negations (e.g. "not okay" weakens
 * positive dimensions) and intensifiers.
 */
function scoreDimension(norm: string, lex: Record<string, LexEntry>, signals: string[]): number {
  let score = 0;
  const negated = signals.includes("negation");
  const intensified = signals.includes("intensified");

  for (const [phrase, entry] of Object.entries(lex)) {
    if (norm.includes(phrase)) {
      let s = entry.w * (entry.i ?? 1);
      if (intensified && !phrase.startsWith("so")) s *= 1.25;
      if (negated) s *= 0.35;
      score += s;
    }
  }
  return Math.min(score, 5);
}

export function detectEmotion(
  text: string,
  historyPrimary?: EmotionKey,
): EmotionEstimate {
  const norm = normalise(text);
  const signals = detectSignals(text, norm);

  const scores = {} as Record<EmotionKey, number>;
  let total = 0;
  for (const dim of DIMENSIONS) {
    const raw = scoreDimension(norm, LEXICON[dim], signals);
    scores[dim] = raw;
    total += raw;
  }

  // Signal-driven boosts for the most useful distinctions.
  if (signals.includes("multiple-exclamations")) {
    scores.joyful *= 1.2;
    scores.frustrated *= 1.2;
  }
  if (signals.includes("all-caps")) {
    scores.frustrated *= 1.3;
    scores.angry *= 1.3;
    scores.anxious *= 1.1;
  }
  if (signals.includes("short-message")) scores.anxious *= 1.15;
  if (signals.includes("time-pressure")) scores.anxious *= 1.3;
  if (signals.includes("questions-1") || signals.includes("questions-2")) scores.anxious *= 1.1;
  if (signals.includes("long-message")) scores.overwhelmed *= 1.3;

  // Negation dampens positive dimensions: "not happy" is not joy.
  if (signals.includes("negation")) {
    scores.joyful *= 0.5;
    scores.hopeful *= 0.7;
    scores.calm *= 0.6;
  }

  const maxScore = Math.max(...Object.values(scores), 0.0001);
  let primary = (Object.keys(scores) as EmotionKey[]).find(
    (k) => scores[k] === maxScore && scores[k] > 0,
  );

  // Small talk is never an emotional state: "thank you so much" is not
  // overwhelm, "ok" after a hard day is just "ok".
  if (isSmallTalk(text)) {
    primary = "neutral";
    scores.neutral = Math.max(scores.neutral, 0.5);
    signals.push("small-talk");
  }

  // Continuity: a neutral, keyword-free message in an emotional thread
  // probably continues the previous emotion ("still feeling it").
  // Greetings and small talk are exempt — "hi" after a hard day is just "hi".
  if (
    !isSmallTalk(text) &&
    norm.length > 2 &&
    (!primary || primary === "neutral") &&
    historyPrimary &&
    historyPrimary !== "neutral"
  ) {
    primary = historyPrimary;
    scores[historyPrimary] = Math.max(scores[historyPrimary], 0.35);
    signals.push("history-continuity");
  }
  if (!primary) primary = "neutral";

  // Confidence & derived scales.
  const strong = scores[primary];
  const second = Object.values(scores).sort((a, b) => b - a)[1] ?? 0;
  const confidence: EmotionEstimate["confidence"] =
    strong >= 2.2 && strong - second >= 0.5 ? "high" : strong >= 1.1 ? "medium" : "low";

  const positiveDims = scores.joyful + scores.hopeful + scores.calm;
  const negativeDims = scores.anxious + scores.overwhelmed + scores.frustrated + scores.sad + scores.lonely + scores.angry;
  const valence = Math.max(-1, Math.min(1, (positiveDims - negativeDims) / (positiveDims + negativeDims + 0.5)));

  const arousalDims = scores.anxious + scores.frustrated + scores.angry + scores.joyful;
  const stillDims = scores.calm + scores.sad + scores.overwhelmed;
  const energy = Math.max(0, Math.min(1, (arousalDims - stillDims) / (arousalDims + stillDims + 0.5) / 2 + 0.5));

  // Surface the psychological-pattern framework (Steps 2-5) on the estimate
  // so every consumer can adapt: pattern:*, intent:*, need:*, intensity:*.
  const est: EmotionEstimate = { primary, scores, valence, energy, confidence, signals };
  const outcome = detectOutcome(text);
  if (outcome) signals.push(`outcome:${outcome}`);
  const intensity = estimateIntensity(est);
  const patterns = detectPattern(text);
  const intent = detectIntent(text, { primary, valence });
  const need = detectNeed(est, intent, patterns, intensity);
  const hidden = detectHiddenEmotion(text);
  signals.push(
    `intensity:${intensity}`,
    `intent:${intent}`,
    `need:${need}`,
    ...patterns.map((p) => `pattern:${p}`),
    ...hidden.map((h) => `hidden:${h}`),
  );
  return est;
}

/** Human-readable summary of the estimate (used in the UI). */
export function describeEmotion(e: EmotionEstimate): string {
  const map: Record<EmotionKey, string> = {
    calm: "calm",
    anxious: "anxious",
    overwhelmed: "overwhelmed",
    hopeful: "hopeful",
    joyful: "joyful",
    frustrated: "frustrated",
    sad: "sad",
    lonely: "lonely",
    angry: "angry",
    neutral: "neutral",
  };
  return map[e.primary];
}

export function emotionMeta(e: EmotionEstimate): { emoji: string; label: string; color: string } {
  const meta: Record<EmotionKey, { emoji: string; label: string; color: string }> = {
    calm: { emoji: "😌", label: "Calm", color: "#7FA36B" },
    anxious: { emoji: "😰", label: "Anxious", color: "#D99A5B" },
    overwhelmed: { emoji: "🌊", label: "Overwhelmed", color: "#5B8DB8" },
    hopeful: { emoji: "🌅", label: "Hopeful", color: "#E0A458" },
    joyful: { emoji: "😊", label: "Joyful", color: "#A8C49A" },
    frustrated: { emoji: "😤", label: "Frustrated", color: "#C47B5B" },
    sad: { emoji: "😢", label: "Sad", color: "#8B9DC3" },
    lonely: { emoji: "🌙", label: "Lonely", color: "#A68BC8" },
    angry: { emoji: "😠", label: "Angry", color: "#C05B4D" },
    neutral: { emoji: "🙂", label: "Neutral", color: "#6B6B6B" },
  };
  return meta[e.primary];
}
