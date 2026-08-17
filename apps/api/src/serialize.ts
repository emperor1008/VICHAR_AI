import type { UserRow } from "./types.js";

/**
 * Public user shape — never includes password_hash. Emergency contact is
 * returned separately via /users/emergency (private route).
 */
export function serializeUser(row: UserRow) {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    nickname: row.nickname,
    age: row.age,
    gender: row.gender,
    pronouns: row.pronouns,
    profession: row.profession,
    studentWorking: row.student_working,
    phone: row.phone,
    timezone: row.timezone,
    language: row.language,
    voiceId: row.voice_id,
    avatarId: row.avatar_id,
    personalityId: row.personality_id,
    onboardedAt: row.onboarded_at,
    privacyConsentAt: row.privacy_consent_at,
    createdAt: row.created_at,
  };
}
