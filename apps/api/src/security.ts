import type { NextFunction, Request, Response } from "express";
import helmet from "helmet";
import { getDb } from "./db.js";

/**
 * Audit log — records security-relevant actions. Never logs message content,
 * passwords, or tokens (no sensitive data in logs).
 */
export function audit(userId: string | null, action: string, req: Request): void {
  try {
    getDb()
      .prepare(
        "INSERT INTO audit_log (user_id, action, ip, user_agent) VALUES (?, ?, ?, ?)",
      )
      .run(
        userId,
        action,
        req.ip ?? "",
        (req.headers["user-agent"] ?? "").toString().slice(0, 200),
      );
  } catch {
    // Auditing must never take the API down.
  }
}

/** HTTP security headers + strict CSP (permissive for dev tooling). */
export function securityHeaders() {
  return helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        "default-src": ["'self'"],
        "script-src": ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        "style-src": ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        "font-src": ["'self'", "https://fonts.gstatic.com", "data:"],
        "img-src": ["'self'", "data:", "blob:"],
        "connect-src": ["'self'", "https://api.openai.com"],
        "worker-src": ["'self'", "blob:"],
      },
    },
    crossOriginEmbedderPolicy: false,
  });
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = "ERROR",
  ) {
    super(message);
  }
}

/** Async route wrapper so thrown errors reach the error handler. */
export function asyncH(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ error: { code: "NOT_FOUND", message: "Route not found" } });
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof ApiError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message } });
  }
  // Zod validation errors
  if (typeof err === "object" && err !== null && "issues" in err && Array.isArray((err as any).issues)) {
    const first = (err as any).issues[0] as { message?: string; path?: (string | number)[] };
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: first?.message ?? "Invalid input",
        path: first?.path ?? [],
      },
    });
  }
  console.error("[error]", req.method, req.path, err);
  res.status(500).json({ error: { code: "INTERNAL", message: "Something went wrong" } });
}
