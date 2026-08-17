/**
 * Thin API client. Calls go through the Next.js rewrite (/api -> API server)
 * so cookies stay same-origin and no CORS config is needed in dev.
 */

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

let accessToken: string | null = null;
// Resolves true when the session was silently refreshed (new token ready).
let onUnauthorized: (() => Promise<boolean>) | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function setUnauthorizedHandler(fn: (() => Promise<boolean>) | null) {
  onUnauthorized = fn;
}

export async function api<T = any>(
  path: string,
  options: RequestInit & { auth?: boolean } = {},
): Promise<T> {
  const run = async (): Promise<Response> => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options.headers as Record<string, string> | undefined),
    };
    if (options.auth !== false && accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }
    return fetch(`/api${path}`, {
      ...options,
      headers,
      credentials: "same-origin",
    });
  };

  let res = await run();
  // Access token expired mid-session: refresh silently and retry once.
  if (res.status === 401 && options.auth !== false) {
    const refreshed = (await onUnauthorized?.()) ?? false;
    if (refreshed) res = await run();
  }

  if (!res.ok) {
    let err: { error?: { code?: string; message?: string } } = {};
    try {
      err = await res.json();
    } catch {
      /* no body */
    }
    throw new ApiError(
      res.status,
      err.error?.code ?? "ERROR",
      err.error?.message ?? `Request failed (${res.status})`,
    );
  }
  return res.json() as Promise<T>;
}

/** POST + parse an SSE stream from the chat endpoint. */
export async function streamChat(
  body: { conversationId?: string; message: string; personalityId?: string; countryCode?: string },
  handlers: {
    onToken: (text: string) => void;
    onEmotion?: (e: { emotion: any; meta: any }) => void;
    onCrisis?: (severity: string, countryCode: string) => void;
    onDone: (data: any) => void;
    onError: (message: string) => void;
  },
  signal?: AbortSignal,
): Promise<void> {
  const stream = async (): Promise<Response> =>
    fetch("/api/chats/stream", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      credentials: "same-origin",
      body: JSON.stringify(body),
      signal,
    });

  let res = await stream();
  // Access token expired mid-chat: refresh silently and retry the stream once
  // so the user's message isn't lost to a 401.
  if (res.status === 401) {
    const refreshed = (await onUnauthorized?.()) ?? false;
    if (refreshed) res = await stream();
  }

  if (!res.ok || !res.body) {
    handlers.onError(
      res.status === 401
        ? "Your session expired — please sign in again."
        : `Request failed (${res.status})`,
    );
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let event = "";

  const dispatch = (ev: string, data: string) => {
    if (ev === "token") {
      handlers.onToken(JSON.parse(data).text ?? "");
    } else if (ev === "emotion") {
      handlers.onEmotion?.(JSON.parse(data));
    } else if (ev === "crisis") {
      const d = JSON.parse(data);
      handlers.onCrisis?.(d.severity, d.countryCode);
    } else if (ev === "done") {
      handlers.onDone(JSON.parse(data));
    } else if (ev === "error") {
      handlers.onError(JSON.parse(data).message ?? "Stream error");
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (line.startsWith("event:")) {
        event = line.slice(6).trim();
      } else if (line.startsWith("data:")) {
        const data = line.slice(5).trim();
        if (data) dispatch(event, data);
        event = "";
      }
    }
  }
}
