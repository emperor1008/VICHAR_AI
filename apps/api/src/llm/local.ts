import type { Personality } from "../data/personalities.js";
import type { EmotionEstimate, EmotionKey, HiddenEmotionKey, IntensityKey, IntentKey, PatternKey } from "../emotion.js";
import { detectOutcome, smallTalkCategory, situationCategory } from "../emotion.js";
import type { SmallTalkCategory, SituationKey } from "../emotion.js";
import type { ResourceDoc } from "./rag.js";

/**
 * LocalMind — the built-in response engine.
 *
 * Runs fully offline (perfect for demos and tests) by composing validated
 * empathy patterns: emotion-aware reflection, phrase mirroring, practical
 * grounding, and one reflective question — all personalised by personality.
 * Deterministic per (personality, emotion, message-hash) so it's testable.
 */

interface GenInput {
  personality: Personality;
  emotion: EmotionEstimate;
  userMessage: string;
  userName: string;
  resources: ResourceDoc[];
  context?: string[]; // recent assistant lines
}

/** Casual chit-chat replies per category, per companion. Short, warm, human. */
const SMALL_TALK_REPLIES: Record<string, Record<SmallTalkCategory, string[]>> = {
  arpita: {
    greeting: [
      "Hi there 💚 It's good to see you. How are you feeling today?",
      "Hello! I'm glad you're here. What's been on your mind?",
      "Hey — I'm right here with you. How has your day been?",
      "Hi! No rush at all. How are you doing right now?",
    ],
    checkin: [
      "I'm here, and I'm doing okay — thanks for asking 💚 More importantly, how are you today?",
      "Things are calm on my side. I'd love to hear how your day has been.",
      "I'm good, thank you. But this is about you — what's been happening?",
      "I'm here and ready to listen. What's new with you?",
    ],
    dontknow: [
      "That's okay — you don't need the perfect words. What's been on your mind, even vaguely?",
      "No pressure at all. Sometimes just starting a sentence helps — I'll follow your lead.",
      "It's okay not to know. How have you been feeling these past few days?",
      "We can sit with 'I don't know' together. What's one small thing you've been thinking about?",
    ],
    status: [
      "I'm glad things feel steady for you right now. What's one thing that's been taking up your attention lately?",
      "Good to hear. What's one thing you're looking forward to, big or small?",
      "Thanks for letting me know how you are. Want to dig into anything, or just chat?",
      "Steady is worth protecting. Is there anything you'd like to talk about?",
    ],
    thanks: [
      "You're welcome — always here for you. 💚",
      "Anytime. That's what I'm here for.",
      "Of course. You don't have to thank me — I'm glad to listen.",
    ],
    bye: [
      "Take care of yourself 💚 I'll be right here whenever you need me.",
      "Goodbye for now — be gentle with yourself today.",
      "See you soon. I'm only a message away.",
    ],
    casual: [
      "😊 What made you smile today?",
      "Nice! What's been going on?",
      "I'm glad you're here. What's on your mind?",
      "That's a good vibe. Tell me more?",
    ],
  },
  biniit: {
    greeting: [
      "Hey! Good to see you 💪 What's happening today?",
      "Hi there! I'm ready when you are — what's on your mind?",
      "Hello! Great to have you here. How's your day going?",
      "Hey! Let's talk — what's been going on?",
    ],
    checkin: [
      "I'm doing great — but this is about you! What's happening?",
      "All good on my end 💪 More importantly — how are you today?",
      "I'm here and ready. What's been going on?",
      "Doing well, thanks for asking! What's new with you?",
    ],
    dontknow: [
      "No worries — we don't need a plan. What's been on your mind lately?",
      "That's totally fine. Say the first thing that comes to you — I'll take it from there.",
      "You don't need to have it figured out. How have you been feeling lately?",
      "Let's just start somewhere — what's one thing that happened today, even a small one?",
    ],
    status: [
      "Good to hear! What's one thing you're looking forward to?",
      "Steady is good 💪 Anything on your mind you want to talk through?",
      "Glad to hear it. What's next for you today?",
      "That works. Want to make a small plan for the day?",
    ],
    thanks: [
      "Anytime! That's what I'm here for. 💪",
      "You got it — happy to help, always.",
      "No problem at all. Now, what's next on your mind?",
    ],
    bye: [
      "Later! Keep your head up 💪 I'm always here when you need me.",
      "See you soon! One step at a time — you've got this.",
      "Take care! I'll be right here when you're back.",
    ],
    casual: [
      "Haha, love it 😄 What's been fun lately?",
      "Nice! Keep that energy going.",
      "Good vibes only 💪 What's happening?",
      "Love that. Tell me more!",
    ],
  },
};

const OPENERS: Record<EmotionKey, string[]> = {
  calm: [
    "It sounds like things feel steady for you right now — and that's worth noticing, too.",
    "There's a quiet kind of steadiness in what you're saying. I can hear it.",
  ],
  anxious: [
    "It sounds like there's a lot of worry sitting in the background. That's a heavy feeling to carry, and it makes sense your mind keeps reaching for the \"what ifs\".",
    "I can hear the anxiety in this — the way your mind is circling. That doesn't mean something's wrong with you; it means something matters to you.",
  ],
  overwhelmed: [
    "That's a lot to be holding all at once. No wonder it feels like too much — your plate is genuinely full.",
    "No wonder this feels like too much — when everything lands at once, overwhelmed is exactly what a person would feel.",
  ],
  hopeful: [
    "There's real hope in what you're saying — I can hear it, and I think it's worth holding onto.",
    "That hopefulness is a beautiful thing to hear. Let's give it a little room.",
  ],
  joyful: [
    "This genuinely made me smile — I can feel the brightness in it. 🌞",
    "I love hearing this. There's a real lift in your words.",
  ],
  frustrated: [
    "I can hear how frustrating this is. It's exhausting when things keep not going the way you hoped.",
    "That sounds deeply frustrating — the kind that builds up slowly and then just sits there.",
  ],
  sad: [
    "That sadness sounds really present right now, and I'm not going to rush you past it.",
    "Thank you for trusting me with this. Sadness this close to the surface deserves to be held gently.",
  ],
  lonely: [
    "That sounds like a lonely place to be — and loneliness aches in its own specific way. I'm really glad you told me.",
    "Feeling alone can make everything heavier. I want you to know I'm here, and this counts as connection.",
  ],
  angry: [
    "It sounds like something crossed a line for you, and you have every right to be angry about that.",
    "I hear the anger in this — and anger often shows up to protect something we care about.",
  ],
  neutral: [
    "I'm here, and I'm listening. What's been on your mind?",
  ],
};

const SUGGESTIONS: Record<EmotionKey, string[]> = {
  calm: [
    "If it feels right, you could keep a tiny note of what's been helping — so on harder days you remember this steadiness is yours.",
  ],
  anxious: [
    "When the worry gets loud, try slowing your breath — in for four, out for six, letting each exhale be longer. Long out-breaths tell your nervous system it's safe.",
    "Here's something small: name five things you can see, four you can touch, three you can hear. It pulls your mind out of the future and back into this room.",
    "Try writing each worry on its own line, then putting a little 'x' on the ones you can't act on today. It helps your brain stop re-running them.",
  ],
  overwhelmed: [
    "Here's what helps when it feels like too much: write *everything* down — every task, every worry — and then choose just one tiny next step. Action is the antidote to overwhelm.",
    "Give yourself permission to drop the smallest thing on the list. Not forever — just for today. Space is part of capacity.",
  ],
  hopeful: [
    "To keep that momentum, pick one small thing you can do tomorrow that moves it forward — and let that be enough. Progress doesn't need to be dramatic.",
  ],
  joyful: [
    "Let's savour it for a second — what was the best single moment? Holding onto the details is how joy becomes a memory you can revisit.",
  ],
  frustrated: [
    "When frustration is this loud, a ten-minute step-away can do more than pushing through. Move your body, get water, let the wave pass — then decide what's next.",
    "Try asking yourself: what part of this is actually within my control? Put your energy only there for today.",
  ],
  sad: [
    "There's no wrong way to feel sad. If you can, give yourself ten minutes of softness — tea, blanket, slow music — and let the feeling be there without needing to fix it.",
    "Sometimes it helps to say the sadness out loud in one sentence, like naming a cloud passing by: \"I am sad, and that is allowed.\"",
  ],
  lonely: [
    "Small connection beats big plans: send one message to one person today — even a voice note that says nothing much. It re-opens the door.",
    "If reaching out feels like too much today, try being around people without needing to talk — a café, a library, a walk in a park. Presence counts.",
  ],
  angry: [
    "Before you do anything with this, give your body a minute to settle — some slow breaths or a walk. Anger is information, but it's easier to read once the alarm stops ringing.",
  ],
  neutral: [],
};

const QUESTIONS: Record<EmotionKey, string[]> = {
  calm: ["What's helped things feel steadier lately?"],
  anxious: ["If we gently set the worry down for a moment — what's one thing that's actually okay right now?"],
  overwhelmed: ["If you only had to do one small thing today, which would you choose?"],
  hopeful: ["What's one small way you could carry this hope into tomorrow?"],
  joyful: ["What's one moment from today you'd want to remember?"],
  frustrated: ["What part of this is within your control right now?"],
  sad: ["What's been making today heavier than the others?"],
  lonely: ["What would connection look like for you this week — even something small?"],
  angry: ["What were you needing in that moment that didn't show up?"],
  neutral: ["What's been taking up the most space in your mind lately?"],
};

const CONNECTORS: Record<string, string[]> = {
  arpita: [
    "If it feels right, we could try something small together:",
    "One gentle idea, if you'd like:",
    "Whenever you're ready, something small that might help:",
  ],
  biniit: [
    "Here's a step worth trying — no pressure, just an option:",
    "Try this one — it's a good one:",
    "If you're up for it, here's a small move:",
  ],
};

/** Expression emoji carried in every reply, matched to the sensed emotion. */
const EMOTION_EXPRESSION: Record<EmotionKey, string> = {
  calm: "🍃",
  anxious: "😟",
  overwhelmed: "😮‍💨",
  hopeful: "🌤️",
  joyful: "🌟",
  frustrated: "😤",
  sad: "😔",
  lonely: "🥀",
  angry: "😠",
  neutral: "🙂",
};

/**
 * Situation-aware replies — what the conversation is ABOUT (vs. how the user
 * feels). Each situation has its own emoji-rich pool per companion: Arpita
 * stays warm, gentle, and reflective; Biniit stays direct, encouraging, and
 * practical. Picks are deterministic per (personality, emotion, message).
 */
interface SituationParts {
  openers: string[];
  advice: string[];
  questions: string[];
}

const SITUATION_REPLIES: Record<string, Record<SituationKey, SituationParts>> = {
  arpita: {
    moodoff: {
      openers: [
        "I can tell your mood is off today 💭 — that heavy, nothing-quite-right feeling. Thanks for still showing up here.",
        "You sound a little off — like the colour's drained out of the day 🍂. I'm here, no rush.",
        "Some days just sit wrong from the moment they start 🌧️. That's allowed, you know — you don't have to fix it right now.",
      ],
      advice: [
        "Let's shrink the day. Pick one tiny thing that feels doable — a shower, a walk around the block, one song you love — and just do that. On a day like this, that's a real win. 🌤️",
        "Don't push yourself to feel better on command. Moods lift on their own schedule — your only job today is to be kind to yourself while it passes. 🫖",
        "Try changing one small thing about your surroundings — open a window, change your clothes, sit somewhere new. Small shifts can loosen a grey day. 🪟",
      ],
      questions: [
        "If today had a colour, what would it be — and what colour do you wish it was?",
        "What's one thing that usually makes a flat day a little softer for you?",
      ],
    },
    overthinking: {
      openers: [
        "Your mind is spinning right now 🌀 — I can hear the loop. That's exhausting, and you don't have to solve it all at once.",
        "Overthinking has you going round and round 🧠, and every cycle starts to feel more real than the last. Let's press pause together.",
        "That's a lot of thoughts stacked on top of each other 💭. No wonder your head hurts — let's untangle them one at a time.",
      ],
      advice: [
        "Try a brain dump: write every thought down for three minutes, no editing. Once they're on paper, your mind can stop holding all of them at once. 📝",
        "Ask yourself: is this thought something I can act on today? If yes, what's one small step? If no, give yourself permission to shelve it until tomorrow. ⏳",
        "Give worry a window — ten minutes a day when you're allowed to worry. Outside it, when the loop starts, gently tell it: 'not now, I'll save it for the window.' ⏰",
      ],
      questions: [
        "If a friend told you this exact thought, what would you tell them?",
        "What's the kindest way you could talk to yourself about this?",
      ],
    },
    depression: {
      openers: [
        "That heaviness sounds really real 🖤 — like everything takes ten times more energy than it should. I'm really glad you said it out loud.",
        "When everything feels pointless, even small things become mountains 🏔️. That's not weakness — that's how heavy this is.",
        "You're carrying something so heavy today, and you still showed up here. That takes more strength than it looks like. 🌱",
      ],
      advice: [
        "Please remember: this feeling is a visitor, not your whole story — it lies about being permanent. Be extra gentle with yourself: eat something, drink water, and if you can, tell one trusted person. 🤍",
        "If you're able, reach out to someone you trust today — a friend, family, or a professional. You don't have to hold this alone, and asking for help is brave, not weak. 🫂",
        "For today, 'just getting through' is enough. Shrink the world to the next hour — one small thing, then the next. You're allowed to take up time and space. 🕯️",
      ],
      questions: [
        "What's one tiny comfort you could give yourself in the next hour?",
        "Who's one person you could let in, even a little?",
      ],
    },
    breakup: {
      openers: [
        "Oh, my heart goes out to you 💔. A breakup isn't just an ending — it's a whole world that suddenly isn't there anymore.",
        "I'm so sorry. That kind of loss leaves a real ache, and you don't have to pretend you're fine. ❤️‍🩹",
        "Thank you for trusting me with this. Breakups hurt in their own specific way — like the ground is a little less steady under you. 🌧️",
      ],
      advice: [
        "Grief has no timetable. Let yourself feel it — cry, rest, eat what you can. Healing isn't a straight line; it's more like tides, and that's okay. 🌊",
        "Try the no-contact kindness: give yourself space from their world — unfollow, archive, mute. Out of sight genuinely helps the heart reset. 📵",
        "Keep one anchor routine — even a morning tea or a nightly walk. When everything else is chaos, a small constant steadies you. 🕯️",
      ],
      questions: [
        "What's one thing you loved about yourself before the relationship — that's still yours?",
        "If your best friend were going through this, what would you tell them?",
      ],
    },
    patchup: {
      openers: [
        "It takes courage to want to patch things up 💞 — especially when feelings are still raw. That says a lot about how much this matters to you.",
        "Fights leave a funny kind of ache — even when you know you want to make up, the first step feels huge. I'm here to think it through with you. 🤝",
        "You're hurting, and you also still care. Both of those are true, and both are okay. ❤️‍🩹",
      ],
      advice: [
        "Before you reach out, get clear on what you want to say — not to win, but to be understood. 'When X happened, I felt Y' is a bridge; blame is a wall. 🕊️",
        "Timing matters. If you're both still heated, give it a few hours or a day — reaching out from a calmer place gives the patch-up a real chance. ⏳",
        "Start small and sincere: 'I've been thinking about our argument, and I don't like us being at odds.' You don't need the perfect apology — you need the honest one. 💬",
      ],
      questions: [
        "What matters more to you here — being right, or being close again?",
        "What's the kindest thing you could say to them right now?",
      ],
    },
    relationship: {
      openers: [
        "Relationships are beautiful and messy, aren't they 💗? What's going on between you two?",
        "Thanks for trusting me with this — matters of the heart need a safe place to land. 💌",
        "I can hear how much this person matters to you. Let's look at it together, gently. 💞",
      ],
      advice: [
        "Try saying what you need instead of what they're doing wrong: 'I need more time with you' lands differently than 'you never spend time with me.' 🗣️",
        "Trust patterns, not just moments: how do you feel after you're together — lighter or drained? That's useful data. 📊",
        "Boundaries aren't walls; they're the shape of a healthy relationship. It's okay to have needs and to name them gently. 🧱",
      ],
      questions: [
        "What does a healthy version of this relationship look like to you?",
        "If they asked you what you need, what would you say?",
      ],
    },
    exam: {
      openers: [
        "Exams can sit so heavy, can't they 📚 — like your whole future is riding on one paper. That's a real pressure to carry. 🎒",
        "I hear the exam stress in your words — that knot in your stomach is very normal. Let's make it a little smaller together. ✏️",
        "You've prepared so much, and still the fear shows up. That's anxiety talking, not a sign of how you'll do. 🌟",
      ],
      advice: [
        "Split revision into 25-minute focused blocks with 5-minute breaks — your brain consolidates better in short sprints. And finish studying by 10pm; sleep is your best revision tool. 😴",
        "Write down the worst-case question you're afraid of, then plan one line of answer for it. Naming the fear takes away its power. 📝",
        "On the day: slow your breathing — in for four, out for six — and tell yourself, 'I've prepared, and I'll handle whatever comes.' You're allowed to do well. 🍀",
      ],
      questions: [
        "What's one topic you actually feel confident about?",
        "If you had to bet, what's the one thing you've revised most solidly?",
      ],
    },
    interview: {
      openers: [
        "Interviews are nerve-wracking even for the best of us 💼 — being judged in real time is genuinely stressful. I'm glad you're talking about it. 🫂",
        "That pre-interview tension is so common — the racing heart, the mind going blank at the thought. Let's get you grounded first. 🌿",
        "You've got an interview — that already means they see something in you. Let's build on that. ✨",
      ],
      advice: [
        "Prepare your story: two or three moments where you solved something real. Rehearse them out loud once — familiar words calm the nerves. 🎤",
        "Before you walk in, try box breathing: in four, hold four, out four, hold four. It literally lowers your heart rate and sharpens your focus. 🧘",
        "Remember, interviews are two-way — you're also deciding if they fit you. That small shift in mindset takes the edge off. ⚖️",
      ],
      questions: [
        "What's one accomplishment you're genuinely proud of, to lead with?",
        "What kind of work environment would you actually thrive in?",
      ],
    },
    unwell: {
      openers: [
        "I'm sorry to hear you're not feeling well 💚 — that sounds really tough.",
        "Oh no, I'm sorry you're feeling rough right now 💚. Thanks for telling me.",
      ],
      advice: [
        "Whatever it is — body or mind — you don't have to push through it alone. Rest isn't weakness; it's how you recover. 🛌",
        "Don't force yourself to be okay on schedule. Give yourself permission to go slow today — that's care, not failure. 🫖",
      ],
      questions: [
        "Is it something physical today, or has the day been emotionally heavy? Either way, I'm right here with you.",
        "How long have you been feeling this way — and what's been the hardest part of it?",
      ],
    },
  },
  biniit: {
    moodoff: {
      openers: [
        "Mood's off today, huh? Been there 💪. Tell me what's got you feeling flat — we'll work through it.",
        "Not your day, I get it. That doesn't mean the day gets to win 🛡️. What's going on?",
        "Hey — low days happen to the best of us 🙌. What's draining you right now?",
      ],
      advice: [
        "Here's the play: pick ONE small win for today — even 'I got out of bed and made tea' counts. Stack one win and the day starts shifting. ✅",
        "Don't fight the mood head-on. Move your body for five minutes — walk, stretch, anything. Action breaks the slump better than waiting it out. 🚶",
        "Reach out to one person today — even a quick text. Connection is one of the fastest ways out of a flat day. 📱",
      ],
      questions: [
        "What's one thing you used to enjoy that you haven't done in a while?",
        "If we could fast-forward to tomorrow morning, what would a better day look like?",
      ],
    },
    overthinking: {
      openers: [
        "Your brain's on a loop 🌀 — I've been there, and it doesn't mean anything's wrong. It means something matters. Let's untangle it.",
        "That's overthinking doing its thing 🧠 — it loves 'what ifs' more than answers. Let's cut the loop.",
        "Man, that thought is stuck on repeat. Let's break the cycle together 💪.",
      ],
      advice: [
        "Take the thought to court: what's the evidence for it, and what's the evidence against it? Overthinking thrives on assumptions — facts shrink it. ⚖️",
        "Action kills overthinking. Pick the smallest next step and do it — motion breaks the loop. 🚀",
        "Give yourself a hard stop: think about it for ten minutes, then go do something physical — walk, gym, dishes. Your brain resets. 🏃",
      ],
      questions: [
        "What's the worst-case scenario — and honestly, how likely is it?",
        "What would you tell your best friend if they were thinking this?",
      ],
    },
    depression: {
      openers: [
        "This sounds heavy, my friend — heavier than anyone should carry alone 🖤. I'm really glad you told me.",
        "That 'nothing matters' feeling is brutal — and I'm not going anywhere. We'll get through this one step at a time. 💪",
        "You reaching out right now is the strongest thing you've done all day. That's the first step — and you already took it. 🌱",
      ],
      advice: [
        "Rule number one: don't believe every thought you have today. Depression lies. Your worth isn't up for debate just because your mood is down. ✅",
        "Talk to someone real — a friend, family, a professional, a helpline. You don't fight this alone; that's non-negotiable. And be proud of yourself for every small thing you do today. 🫂",
        "Do one physical thing — shower, eat, step outside for two minutes. Your body moving helps your mind follow. Then do one more tiny thing. 🚶",
      ],
      questions: [
        "What's one small thing that used to give you a little light — even if it doesn't feel like it would right now?",
        "Can we make a plan for one small thing you'll do for yourself in the next hour?",
      ],
    },
    breakup: {
      openers: [
        "Ah man, I'm sorry 💔. Breakups hit hard — it's okay to be a mess for a bit. I've got your back here.",
        "That hurts, and I'm not going to pretend it doesn't ❤️‍🩹. Let's take this one day at a time.",
        "Hey — your worth didn't walk out the door with them. I know it doesn't feel like it now, but that's the truth. 💪",
      ],
      advice: [
        "First rule: cut the contact loop. Mute, archive, delete if you have to — you can't heal while you're checking their stories. 📵",
        "Feel it, then move: give yourself real time to grieve, but also schedule things with friends — you need proof that life still has colour. 🎨",
        "Write the letter you'll never send. Get it all out — the anger, the hurt, the questions. Then burn it or delete it. That's closure you gave yourself. ✍️",
      ],
      questions: [
        "What's one thing you want to do for YOU in the next week?",
        "What's one thing you'll miss the most — and one thing you definitely won't?",
      ],
    },
    patchup: {
      openers: [
        "Respect — wanting to fix things after a fight takes guts 💪. Most people just let it rot. Let's do this properly.",
        "Fights happen; it's what you do next that counts 🤝. You're doing the right thing by not letting it slide.",
        "It's rough when you care about someone and you're also annoyed at them — both are real. Let's sort this out. 🔧",
      ],
      advice: [
        "Send them something real and simple: 'Hey, can we talk? I've been thinking about us.' Short and honest beats a long essay. 📱",
        "When you talk, use 'I' statements — 'I felt hurt when…' — not 'you always…'. That's the difference between a fight and a conversation. 🗣️",
        "If it's about something small, don't let it become about everything. Stick to the one issue — solve that first, and the rest follows. 🎯",
      ],
      questions: [
        "What's one thing you'd say if you knew they'd really listen?",
        "What do you actually need from them — an apology, understanding, or just peace?",
      ],
    },
    relationship: {
      openers: [
        "Okay, relationship territory — I'm all ears 💬. What's happening with you two?",
        "Love makes everything complicated, right? 😄 Spill — I'm here to help you think straight.",
        "Alright, let's talk it out. What's going on between you two? 💭",
      ],
      advice: [
        "Talk to them directly — assumptions are relationship killers. One honest conversation clears more than a week of guessing. 🗣️",
        "Watch actions over words. If they say one thing and do another, that's your answer — believe what they do. 👀",
        "Don't lose yourself in the relationship. Keep your friends, hobbies, and goals — the best version of 'us' still includes 'you'. ⚖️",
      ],
      questions: [
        "What's the one thing you wish they understood about you?",
        "If nothing changed, could you live with this for a year?",
      ],
    },
    exam: {
      openers: [
        "Exam time — I remember that pressure 📚. It's normal to feel it, but don't let it convince you you're not ready. 🎯",
        "That exam anxiety is real, but here's the thing — you've put in the work. Now we just manage the nerves. 💪",
        "Feeling tense about the exam? Good news: that energy can become focus. Let's channel it. ⚡",
      ],
      advice: [
        "Plan your revision like a fighter plans a match: short rounds, rest in between, and save the heavy stuff for your best hours. 🥊",
        "Do a mock test — even one — under real conditions. The exam feels way less scary the second time you've 'been there.' 🧪",
        "Night before: no new material. Light review only, eat well, sleep early. A rested brain scores better than a crammed one. 😴",
      ],
      questions: [
        "What's your strongest subject going in?",
        "After the exam is done — what's the first thing you want to do to celebrate?",
      ],
    },
    interview: {
      openers: [
        "Interview day tension — totally normal 💼. Let's turn those nerves into confidence. You've got this. 💪",
        "You got the interview — that means you already beat a pile of other applicants. Now we just close it out. 🏆",
        "Nervous about the interview? Perfectly natural — even pros get it. Here's how we handle it. 🎯",
      ],
      advice: [
        "Prep your answers, but don't script them — bullet points, not paragraphs. You want to sound like a person, not a robot. 📋",
        "Mock interview with a friend or your phone camera. Cringey? Yes. Effective? Very — you'll walk in feeling like you've already done it. 🎥",
        "Power move: arrive early, water in hand, shoulders back. Posture changes how you feel — stand like someone who belongs there. 🕴️",
      ],
      questions: [
        "What's your strongest story to tell them?",
        "What would make you say 'this is where I want to be'?",
      ],
    },
    unwell: {
      openers: [
        "I'm sorry you're not feeling well. Let's not worry about fixing everything right now. 💪",
        "Ah man, that's rough — sorry you're going through that today.",
      ],
      advice: [
        "Don't push through it. Rest, water, and a real break beat soldiering on — we can figure out the rest later. 🛌",
        "Rule for today: lower the bar. Survival counts as a win when you're unwell — everything else is a bonus. ✅",
      ],
      questions: [
        "Tell me what's going on — are you feeling physically unwell, emotionally drained, or a bit of both?",
        "Do you need a plan for today, or just to be heard for a minute?",
      ],
    },
  },
};

/**
 * Validation Gate — positive outcomes. Good news must be CELEBRATED, never
 * met with condolence or the generic greeting ("I got promoted" ≠ neutral).
 */
const CELEBRATION_REPLIES: Record<string, SituationParts> = {
  arpita: {
    openers: [
      "Wait — this is amazing! 🎉 I'm genuinely so happy for you right now.",
      "No way — that's wonderful! 🎊 You absolutely deserve this.",
    ],
    advice: [
      "You earned this — all the effort you put in when no one was watching counts for something. Take a real moment to let yourself enjoy it before the next thing starts. 🌟",
      "Don't rush past it. Soak in the feeling for a full day — good news deserves to land properly, not just be ticked off a list. 🥂",
    ],
    questions: [
      "How does it feel to see all that hard work pay off? Tell me everything!",
      "What's the first thing you're going to do to celebrate?",
    ],
  },
  biniit: {
    openers: [
      "That's brilliant! 🎉 Well done, man — you earned that.",
      "Nice one! 🎊 All that grind finally paying off is the best feeling.",
    ],
    advice: [
      "Now soak it in properly — you don't get many days like this. Enjoy it fully before the next chapter starts. 🏆",
      "Remember this feeling — you'll want it on a hard day later. Good things happened because you showed up and did the work. ✅",
    ],
    questions: [
      "So what does this open up for you next?",
      "How are we celebrating — or is it still sinking in?",
    ],
  },
};

/**
 * Validation Gate — negative outcomes. A completed failure (failed the exam,
 * didn't get the job) must be ACKNOWLEDGED with empathy — never
 * congratulated, and never given pre-emptive "you'll do great" advice.
 */
const NEGATIVE_OUTCOME_REPLIES: Record<string, SituationParts> = {
  arpita: {
    openers: [
      "I'm really sorry — you put so much into that, and it still didn't go your way. That genuinely hurts, and you don't have to brush past it. 💙",
      "Ouch. I know how much you wanted this — a letdown like that lands hard, and it's okay to feel every bit of it. 💔",
    ],
    advice: [
      "Let's give the sting room before we touch the 'what next'. Disappointment this fresh doesn't need a fix right now — it needs space. 🕊️",
      "When you're ready, we can look at it like data instead of a verdict: one result describes what happened, not how far you can go. 🌱",
    ],
    questions: [
      "What's hitting hardest right now — the outcome itself, or what you're afraid it says about you?",
      "Is there someone you can tell who'll just sit with you for a bit, no fixes required?",
    ],
  },
  biniit: {
    openers: [
      "That's a tough one, and I'm not going to soften it — you showed up, you prepared, and it still didn't land. That hurts. 💪",
      "Man, that stings. You gave it a real shot and it didn't go your way — you're allowed to be properly disappointed about that.",
    ],
    advice: [
      "For tonight, don't relive the whole thing. Give your mind one clear stop: it happened, it's done, we unpack it tomorrow. 🛑",
      "One honest note: failing at something doesn't make you a failure. The result says what happened — not who you are. 🎯",
    ],
    questions: [
      "What's hitting you harder — the disappointment itself, or the story you're telling yourself about what it means?",
      "Do you want to vent it all out first, or talk through what comes next?",
    ],
  },
};

/**
 * Pattern-aware gentle reframes (Step 3 of the empathy model). Each line
 * names the behavioural pattern softly — never as a diagnosis — and offers
 * one small way through it. Appended on the generic emotion path.
 */
const PATTERN_ADDS: Record<PatternKey, string> = {
  overthinking: "Your mind is a garden, not a washing machine — one thought at a time, and not every one deserves your attention.",
  catastrophizing: "That thought is reaching for the worst-case ending. Gently ask yourself: what's the most *likely* outcome, not the most frightening one?",
  "black-and-white-thinking": "Watch for 'always' and 'never' — life mostly lives in the in-between. One grey moment doesn't make a black-and-white life.",
  "negative-self-talk": "Notice how you're talking to yourself right now — would you say those exact words to a friend? You deserve the same kindness.",
  "self-blame": "It's human to look for someone to blame, and we usually pick ourselves. But most outcomes are bigger than one person's actions.",
  perfectionism: "Nothing has to be perfect today — done is better than perfect, and 'good enough' is a real win.",
  "fear-of-failure": "Failure is information, not identity. One setback says something about what happened — nothing about who you are.",
  "fear-of-rejection": "Rejection is one person's opinion at one moment. It says far more about them than it does about you.",
  "fear-of-judgment": "Most people are too busy worrying about themselves to judge you — and even if they did, their judgment isn't the truth about you.",
  "fear-of-abandonment": "Fear of being left can make you hold on too tight — but that fear is loud, not a prophecy. You are not doomed to be abandoned.",
  "low-self-esteem": "Your worth isn't measured by what you produce or how you perform — you matter exactly as you are, today.",
  "low-confidence": "Confidence isn't being sure you'll succeed — it's knowing you'll be okay either way. Start with one small risk.",
  impostor: "Feeling like a fraud is common right before you grow. The people you admire felt it too — it's not evidence you don't belong.",
  "people-pleasing": "Saying no to others is sometimes saying yes to yourself. You're allowed to take up space.",
  comparison: "You're comparing your behind-the-scenes to everyone else's highlight reel — that's never a fair fight.",
  avoidance: "Avoiding it is making it bigger than it is. What's the smallest version of this you could face today?",
  "decision-paralysis": "When every option feels equal, pick the one that's easiest to try — you can always adjust. A good decision now beats a perfect one later.",
  rumination: "Rumination replays the past; you live in the present. One small step forward is worth more than a hundred replays.",
  burnout: "This isn't laziness — it's your battery at zero. Rest is part of the work, not a reward for it.",
  "social-anxiety": "Other people are not auditing you — most are inside their own heads. One small interaction is enough today.",
  "relationship-insecurity": "Insecurity shouts while trust whispers. Before you act on the fear, ask what the evidence actually says.",
  attachment: "Wanting closeness isn't weakness — it's human wiring. Your need for connection deserves a voice, not a silence.",
  "emotional-dependence": "You can love someone deeply and still be whole without them. Your worth doesn't live inside another person.",
  "trust-issues": "Protecting yourself after being hurt makes sense — but not everyone is the person who hurt you. Trust can be rebuilt in small, earned steps.",
  "learned-helplessness": "That 'nothing I do works' feeling is learned — and it can be unlearned. Pick one tiny thing that could go right and try it.",
  "low-motivation": "Motivation usually follows action, not the other way around. Do two minutes and see what happens.",
  procrastination: "Procrastination is often perfectionism in disguise. Start small — a tiny first step breaks the spell.",
  "self-criticism": "If you wouldn't say it to someone you love, don't say it to yourself — you're the person you spend every day with.",
  "cognitive-overload": "Your brain is full, not failing. Write it all down, then only the next single step exists.",
  "emotional-suppression": "Feelings that get pushed down don't disappear — they get louder. It's safe to let some of it out here.",
};

/**
 * Hidden-emotion acknowledgements (Step "hidden emotions"): respond to what
 * sits beneath the words — "my friend ditched me" carries rejection, hurt,
 * feeling unimportant. Used as the opener when the lexicon scores neutral
 * (never answer a real problem with a generic greeting), and as an extra
 * validation line on negative-emotion replies.
 */
const HIDDEN_ACKS: Record<HiddenEmotionKey, string[]> = {
  rejection: [
    "I'm really sorry that happened. Being let down like that can feel like a rejection — and that kind of hurt runs deep.",
    "That stings — when someone you trusted turns away, it can leave you questioning yourself. That's a real ache, not an overreaction.",
  ],
  betrayal: [
    "That sounds like a genuine betrayal — when someone you trusted breaks that trust, it shakes more than just the moment.",
    "Ouch. Having someone you trusted act like that hurts in a specific way — like the ground shifted underneath you.",
  ],
  unimportant: [
    "That can make you feel like you don't matter — and nobody should have to feel that way, least of all from someone close.",
    "It stings when someone treats you like you're not a priority. You deserve to feel valued.",
  ],
  loneliness: [
    "That sounds like a lonely place to be — and loneliness aches in its own way. I'm really glad you told me.",
    "Being left to feel it alone makes everything heavier. You're not as alone as it feels right now.",
  ],
  "self-doubt": [
    "It sounds like this is making you question yourself — and that's the cruelest part, because this says more about them than it does about you.",
    "When someone's actions make you doubt your own worth, that's a heavy burden they put on you — not a truth about you.",
  ],
  anger: [
    "It sounds like something crossed a line for you — and you have every right to be angry about that.",
    "I hear the anger here — and anger often shows up to protect something that matters to us.",
  ],
  confusion: [
    "That's genuinely confusing — when something doesn't add up, it's completely normal to keep turning it over.",
    "Not understanding why this happened can be as painful as what happened. You're not silly for feeling unsettled by it.",
  ],
  guilt: [
    "It sounds like you're carrying blame for this — and I wonder if you're being harder on yourself than you need to be.",
    "That kind of 'should have' thinking can weigh on you. Be fair to yourself — you did the best you could with what you knew.",
  ],
  hurt: [
    "That sounds genuinely painful. You don't have to pretend it isn't.",
    "That would hurt anyone — and it's okay to let it hurt without needing to fix it right away.",
  ],
};

function mirrorPhrase(userMessage: string, emotionPrimary: EmotionKey): string | null {
  if (emotionPrimary === "neutral" || userMessage.trim().length <= 10) return null;
  const sentences = userMessage
    .split(/[.!?\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 8);
  if (!sentences.length) return null;
  const mirrored = sentences[0].replace(/^(i\s+am\s+|i'm\s+|i\s+feel\s+|i\s+am\s+feeling\s+)/i, "");
  return `You said *“${mirrored.slice(0, 70)}”* — and I really heard it.`;
}

function signOffFor(personalityId: string, key: string, userName: string): string {
  const signOffs: Record<string, string[]> = {
    arpita: [
      "Take your time with that — I'm right here. 💚",
      "No rush at all — I'm here whenever you are. 💌",
      "Be gentle with yourself today. 🌷",
    ],
    biniit: [
      "You've got this — one step at a time. 💪",
      "I'm cheering for you — keep going. 🔥",
      "Proud of you for showing up today. 🙌",
    ],
  };
  const list = signOffs[personalityId];
  if (!list) return "";
  let line = "";
  if (hash(key + "|e") % 2 === 0) {
    line = pick(list, key + "|so");
  }
  if (line && userName && hash(key + "|e") % 3 === 0) {
    line = `${userName}, ${line}`;
  }
  return line;
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function pick<T>(arr: readonly T[], key: string): T {
  return arr[hash(key) % arr.length];
}

/** Read a `name:value` entry surfaced on the emotion estimate's signals. */
function signalOf(emotion: EmotionEstimate, prefix: string): string | undefined {
  return emotion.signals.find((s) => s.startsWith(prefix))?.split(":")[1];
}

function detectContext(text: string): string[] {
  const ctx: string[] = [];
  if (/\b(exam|test|study|assignment|deadline|grades?|syllabus)\b/i.test(text)) ctx.push("study");
  if (/\b(interview|resume|cv|job|offer|career|salary|promotion)\b/i.test(text)) ctx.push("career");
  if (/\b(boyfriend|girlfriend|partner|crush|ex|relationship|breakup|break up)\b/i.test(text)) ctx.push("relationship");
  if (/\b(sleep|insomnia|can't sleep|tired)\b/i.test(text)) ctx.push("sleep");
  return ctx;
}

const CONTEXT_ADDS: Record<string, string> = {
  study: "Since this is about studying — one focused 25-minute block, with your phone in another room, beats three distracted hours. Start smaller than you think you need.",
  career: "When it comes to interviews and career pressure, preparation is the antidote to nerves: rehearse your strongest story out loud once, and it'll feel twice as steady in the moment.",
  relationship: "With relationship stuff, it usually helps to write what you'd say to them without sending it — it gets the thoughts out of the loop in your head.",
  sleep: "For sleep, dim the lights and put the phone down an hour before bed — your brain needs the signal that the day is over.",
};

export function generateLocalResponse(input: GenInput): string {
  const { personality, emotion, userMessage, userName, context } = input;
  const key = `${personality.id}|${emotion.primary}|${userMessage}`;
  const parts: string[] = [];

  // Casual chit-chat: short, warm, human — never a clinical template.
  const smallTalk = smallTalkCategory(userMessage);
  if (smallTalk) {
    const pool = SMALL_TALK_REPLIES[personality.id] ?? SMALL_TALK_REPLIES.arpita;
    const list = pool[smallTalk] ?? pool.greeting;
    let reply = pick(list, key + "|g");
    if (userName && hash(key + "|n") % 2 === 0) {
      reply = reply.replace(/^/, `${userName}, `);
    }
    return reply;
  }

  const situation = situationCategory(userMessage);

  // ── VALIDATION GATE (Steps 1-2): never emotionally contradict the message.
  // Good news is celebrated — never condoled, never the generic greeting.
  const outcome = detectOutcome(userMessage);
  if (outcome === "positive") {
    const pool = CELEBRATION_REPLIES[personality.id] ?? CELEBRATION_REPLIES.arpita;
    parts.push(pick(pool.openers, key + "|co"));
    const mirrored = mirrorPhrase(userMessage, emotion.primary);
    if (mirrored) parts.push(mirrored);
    parts.push(`${pick(CONNECTORS[personality.id] ?? CONNECTORS.arpita, key + "|cc")} ${pick(pool.advice, key + "|ca")}`);
    const question = pick(pool.questions, key + "|cq");
    if (question) parts.push(question);
    const signOff = signOffFor(personality.id, key, userName);
    if (signOff) parts.push(signOff);
    void context;
    return parts.join("\n\n");
  }

  // A completed failure is acknowledged with empathy — never congratulated,
  // and never given pre-emptive exam/interview anxiety advice.
  if (outcome === "negative" && (situation === "exam" || situation === "interview")) {
    const pool = NEGATIVE_OUTCOME_REPLIES[personality.id] ?? NEGATIVE_OUTCOME_REPLIES.arpita;
    parts.push(pick(pool.openers, key + "|no"));
    const mirrored = mirrorPhrase(userMessage, emotion.primary);
    if (mirrored) parts.push(mirrored);
    parts.push(`${pick(CONNECTORS[personality.id] ?? CONNECTORS.arpita, key + "|nc")} ${pick(pool.advice, key + "|na")}`);
    const question = pick(pool.questions, key + "|nq");
    if (question) parts.push(question);
    const signOff = signOffFor(personality.id, key, userName);
    if (signOff) parts.push(signOff);
    void context;
    return parts.join("\n\n");
  }

  // Situation-aware replies: mood off, overthinking, depression, breakup,
  // patch-up, relationship advice, exam anxiety, interview tension, unwell —
  // each with its own emoji-rich, companion-specific reply pool.
  if (situation) {
    const pool = (SITUATION_REPLIES[personality.id] ?? SITUATION_REPLIES.arpita)[situation];
    parts.push(pick(pool.openers, key + "|sso"));
    const mirrored = mirrorPhrase(userMessage, emotion.primary);
    if (mirrored) parts.push(mirrored);
    const advice = pick(pool.advice, key + "|ssa");
    parts.push(`${pick(CONNECTORS[personality.id] ?? CONNECTORS.arpita, key + "|ssc")} ${advice}`);
    if (input.resources.length && emotion.primary !== "neutral") {
      const res = input.resources[0];
      parts.push(`That's actually something a lot of people go through — ${res.summary} I can share more on this if you'd like.`);
    }
    const question = pick(pool.questions, key + "|ssq");
    if (question) parts.push(question);
    const signOff = signOffFor(personality.id, key, userName);
    if (signOff) parts.push(signOff);
    void context;
    return parts.join("\n\n");
  }

  const intensity = (signalOf(emotion, "intensity:") as IntensityKey) ?? "moderate";
  const hidden = emotion.signals
    .filter((s) => s.startsWith("hidden:"))
    .map((s) => s.split(":")[1]) as HiddenEmotionKey[];

  // Hidden emotions: respond to what sits beneath the words. If the lexicon
  // scored neutral ("my friend ditched me" → no keyword hits), acknowledge
  // the situation directly — never answer a real problem with a generic
  // greeting. On negative-emotion replies, add it as a deeper validation line.
  if (emotion.primary === "neutral" && hidden.length) {
    const pool = HIDDEN_ACKS[hidden[0]] ?? HIDDEN_ACKS.hurt;
    parts.push(pick(pool, key + "|ha"));
  } else {
    const opener = pick(OPENERS[emotion.primary], key + "|o");
    parts.push(`${opener} ${EMOTION_EXPRESSION[emotion.primary]}`);
    if (hidden.length && emotion.valence < 0) {
      const pool = HIDDEN_ACKS[hidden[0]] ?? HIDDEN_ACKS.hurt;
      parts.push(pick(pool, key + "|hv"));
    }
  }

  // Intensity (Step 5): when the emotion is high/extreme, slow down and
  // validate before anything else — never rush past a heavy feeling.
  if ((intensity === "high" || intensity === "extreme") && emotion.valence < 0) {
    parts.push(
      personality.id === "biniit"
        ? "Okay — this is clearly heavy right now. Let's slow it down and take it one piece at a time. 💪"
        : "I can hear how much this is weighing on you right now. Let's take it slowly — there's no rush here. 💙",
    );
  }

  // Mirror a concrete phrase — makes it feel heard, not templated.
  const mirrored = mirrorPhrase(userMessage, emotion.primary);
  if (mirrored) parts.push(mirrored);

  // Practical suggestion (emotion + context aware)
  const suggestion = pick(SUGGESTIONS[emotion.primary], key + "|s");
  if (suggestion) {
    parts.push(`${pick(CONNECTORS[personality.id] ?? CONNECTORS.arpita, key + "|c")} ${suggestion}`);
  }
  for (const c of detectContext(userMessage)) {
    if (CONTEXT_ADDS[c] && emotion.primary !== "calm") {
      parts.push(CONTEXT_ADDS[c]);
      break;
    }
  }

  // Patterns (Step 3): gently name the behavioural pattern, never diagnose.
  const negative =
    emotion.primary !== "calm" &&
    emotion.primary !== "joyful" &&
    emotion.primary !== "hopeful" &&
    emotion.primary !== "neutral";
  if (negative) {
    const patterns = emotion.signals
      .filter((s) => s.startsWith("pattern:"))
      .map((s) => s.split(":")[1]) as PatternKey[];
    for (const p of patterns.slice(0, 2)) {
      const line = PATTERN_ADDS[p];
      if (line) parts.push(line);
    }
  }

  // Resource grounding (RAG)
  if (input.resources.length && emotion.primary !== "neutral") {
    const res = input.resources[0];
    parts.push(`That's actually something a lot of people go through — ${res.summary} I can share more on this if you'd like.`);
  }

  // One reflective question — or, when the user just needs to be heard,
  // offer the choice the empathy model recommends instead of assuming.
  const intent = (signalOf(emotion, "intent:") as IntentKey) ?? "casual";
  const useListenQuestion =
    (intent === "venting" || intent === "listen") &&
    emotion.valence < 0 &&
    intensity !== "extreme";
  const question = useListenQuestion
    ? "Would you like me to just listen for now, or would you like us to think through some possible solutions together?"
    : pick(QUESTIONS[emotion.primary], key + "|q");
  if (question) parts.push(question);

  // Warm sign-off varies by personality
  const signOff = signOffFor(personality.id, key, userName);
  if (signOff) parts.push(signOff);
  void context;
  return parts.join("\n\n");
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Stream a response as small chunks with human-like pacing.
 * Higher emotional intensity → slower, calmer pacing (Step 5).
 */
export async function* streamLocal(input: GenInput): AsyncGenerator<string> {
  const text = generateLocalResponse(input);
  const intensity = (signalOf(input.emotion, "intensity:") as IntensityKey) ?? "moderate";
  const pace =
    intensity === "extreme" ? 1.8 : intensity === "high" ? 1.4 : intensity === "low" ? 0.85 : intensity === "verylow" ? 0.7 : 1;
  // Split into 2-6 char chunks on word boundaries for natural pacing.
  const chunks: string[] = [];
  const words = text.split(/(\s+)/);
  let buf = "";
  for (const w of words) {
    buf += w;
    if (buf.length >= 3 + (hash(buf) % 4)) {
      chunks.push(buf);
      buf = "";
    }
  }
  if (buf) chunks.push(buf);
  for (const c of chunks) {
    await sleep(Math.round((12 + (hash(c) % 28)) * pace));
    yield c;
  }
}
