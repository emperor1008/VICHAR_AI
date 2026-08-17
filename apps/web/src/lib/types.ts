export interface User {
  id: string;
  email: string;
  name: string;
  nickname: string;
  age: number | null;
  gender: string;
  pronouns: string;
  profession: string;
  studentWorking: string;
  phone: string;
  timezone: string;
  language: string;
  voiceId: string;
  avatarId: string;
  personalityId: string;
  onboardedAt: string | null;
  privacyConsentAt: string | null;
  createdAt: string;
}

export type EmotionKey =
  | "calm" | "anxious" | "overwhelmed" | "hopeful" | "joyful"
  | "frustrated" | "sad" | "lonely" | "angry" | "neutral";

export interface EmotionEstimate {
  primary: EmotionKey;
  scores: Record<EmotionKey, number>;
  valence: number;
  energy: number;
  confidence: "low" | "medium" | "high";
  signals: string[];
}

export interface Conversation {
  id: string;
  title: string;
  personalityId: string;
  pinned: boolean;
  favorite: boolean;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string | null;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  emotion?: EmotionEstimate;
  reactions: Record<string, number>;
  createdAt: string;
}

export interface Mood {
  id: string;
  date: string;
  moodKey: string;
  score: number;
  emoji: string;
  energy: number | null;
  notes: string;
  createdAt: string;
}

export interface JournalAppearance {
  fontFamily: string;
  fontSize: number;
  textColor: string;
  paperStyle: string;
  notebookTheme: string;
  decoration: string;
}

export interface JournalEntry {
  id: string;
  date: string;
  title: string;
  content: string;
  moodKey: string;
  tags: string[];
  aiSummary: string;
  isEncrypted?: boolean;
  encryptedPayload?: string;
  appearance?: JournalAppearance;
  gratitude?: string[];
  createdAt: string;
  updatedAt?: string;
}

export interface Goal {
  id: string;
  title: string;
  category: string;
  targetDate: string | null;
  completed: boolean;
  createdAt: string;
  completedAt: string | null;
}

export interface Memory {
  id: string;
  userId: string;
  category: string;
  content: string;
  importance: number;
  source: string;
  createdAt: string;
  updatedAt: string;
}

export interface Personality {
  id: string;
  name: string;
  emoji: string;
  tagline: string;
  description: string;
  style: string;
  system: string;
  openers: string[];
  color: string;
}

export interface Voice {
  id: string;
  name: string;
  description: string;
  pitch: number;
  rate: number;
}

export interface Avatar {
  id: string;
  emoji: string;
  name: string;
}

export interface SessionStats {
  totalSessions: number;
  totalMinutes: number;
  byType: Record<string, number>;
}
