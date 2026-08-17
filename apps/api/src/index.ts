import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import { config } from "./config.js";
import { getDb } from "./db.js";
import {
  errorHandler,
  notFoundHandler,
  securityHeaders,
} from "./security.js";
import { apiLimiter } from "./auth.js";
import { llmProviderName } from "./llm/index.js";

import authRoutes from "./routes/auth.routes.js";
import userRoutes from "./routes/users.routes.js";
import chatRoutes from "./routes/chats.routes.js";
import streamRoutes from "./routes/stream.routes.js";
import moodRoutes from "./routes/moods.routes.js";
import goalRoutes from "./routes/goals.routes.js";
import memoryRoutes from "./routes/memories.routes.js";
import metaRoutes from "./routes/meta.routes.js";
import exportRoutes from "./routes/export.routes.js";

const app = express();

app.disable("x-powered-by");
app.use(securityHeaders());

app.use(
  cors({
    origin: config.corsOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  }),
);

app.use(express.json({ limit: "256kb" }));
app.use(cookieParser());

// Health (unauthenticated, no rate limit)
app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "vichar-api", llm: llmProviderName(), time: new Date().toISOString() });
});

app.use("/api", apiLimiter);
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/chats", chatRoutes);
app.use("/api/chats", streamRoutes);
app.use("/api", moodRoutes); // /api/moods, /api/moods/today, /api/moods/insights, /api/journal
app.use("/api", goalRoutes); // /api/goals, /api/sessions
app.use("/api/memories", memoryRoutes);
app.use("/api/meta", metaRoutes);
app.use("/api", exportRoutes); // /api/export, /api/account

app.use(notFoundHandler);
app.use(errorHandler);

// Initialise schema at boot so a fresh checkout just works.
getDb();

app.listen(config.port, () => {
  console.log(`🌸 Vichar API listening on http://localhost:${config.port}`);
  console.log(`   LLM provider: ${llmProviderName()}`);
  console.log(`   Environment: ${config.env}`);
});
