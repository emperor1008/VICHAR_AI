export interface UserRow {
  id: string;
  email: string;
  password_hash: string;
  name: string;
  nickname: string;
  age: number | null;
  gender: string;
  pronouns: string;
  profession: string;
  student_working: string;
  phone: string;
  timezone: string;
  language: string;
  emergency_contact: string;
  voice_id: string;
  avatar_id: string;
  personality_id: string;
  privacy_consent_at: string | null;
  onboarded_at: string | null;
  created_at: string;
  updated_at: string;
  last_seen_at: string | null;
}

export type PublicUser = Omit<UserRow, "password_hash" | "emergency_contact"> & {
  emergencyContact: Record<string, string> | null;
};

export interface ChatMessageRow {
  id: string;
  conversation_id: string;
  user_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  emotion: string;
  reactions: string;
  created_at: string;
}

export interface ConversationRow {
  id: string;
  user_id: string;
  title: string;
  personality_id: string;
  pinned: number;
  favorite: number;
  archived: number;
  created_at: string;
  updated_at: string;
  last_message_at: string | null;
}
