import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Centralised, validated configuration. Every secret comes from the
 * environment (see .env.example) — nothing sensitive is hard-coded.
 */
function env(key: string, fallback = ""): string {
  return process.env[key] ?? fallback;
}

export const config = {
  env: env("NODE_ENV", "development") as "development" | "production" | "test",
  // API_PORT is explicit so ambient shell PORT vars never hijack the port.
  port: Number(env("API_PORT", "4000")),
  isProd: env("NODE_ENV", "development") === "production",

  // JWT — access tokens are short-lived JWTs; refresh tokens are opaque
  // random strings stored hashed in the DB so they can be revoked.
  jwt: {
    accessSecret: env("JWT_ACCESS_SECRET", "dev-access-secret-change-me"),
    refreshSecret: env("JWT_REFRESH_SECRET", "dev-refresh-secret-change-me"),
    accessTtl: env("ACCESS_TOKEN_TTL", "15m"),
    refreshTtlDays: Number(env("REFRESH_TOKEN_TTL_DAYS", "30")),
  },

  corsOrigins: env("CORS_ORIGINS", "http://localhost:3000")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),

  dbPath:
    env("DATABASE_URL") ||
    path.join(__dirname, "..", "data", "vichar.db"),

  llm: {
    provider: env("LLM_PROVIDER", "local") as "local" | "openai",
    openaiApiKey: env("OPENAI_API_KEY", ""),
    openaiModel: env("OPENAI_MODEL", "gpt-4o-mini"),
    openaiBaseUrl: env("OPENAI_BASE_URL", "https://api.openai.com/v1"),
  },

  supabase: {
    url: env("SUPABASE_URL", ""),
    anonKey: env("SUPABASE_ANON_KEY", ""),
    serviceRoleKey: env("SUPABASE_SERVICE_ROLE_KEY", ""),
  },
};

// Fail fast in production if default secrets are still in use.
if (config.isProd && config.jwt.accessSecret.startsWith("dev-")) {
  throw new Error(
    "Refusing to start in production: JWT_ACCESS_SECRET must be set to a strong random value.",
  );
}
