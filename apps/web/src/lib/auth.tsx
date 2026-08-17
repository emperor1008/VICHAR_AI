"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { api, setAccessToken, setUnauthorizedHandler } from "./api";
import type { User } from "./types";
import { useRouter } from "next/navigation";

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string, rememberMe: boolean) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (u: User) => void;
  refreshSession: () => Promise<boolean>;
}

const AuthContext = createContext<AuthState>({
  user: null,
  loading: true,
  login: async () => {},
  logout: async () => {},
  setUser: () => {},
  refreshSession: async () => false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const refreshPromise = useRef<Promise<boolean> | null>(null);
  const router = useRouter();

  const setUser = useCallback((u: User) => {
    setUserState(u);
  }, []);

  const refreshSession = useCallback((): Promise<boolean> => {
    // Journal startup makes several requests together. If their access token
    // expires at the same time, all callers must await the same refresh rather
    // than treating the second request as a failed login.
    if (refreshPromise.current) return refreshPromise.current;

    const pending = (async () => {
      try {
        // Refresh uses the HttpOnly cookie, not the access token — and a failed
        // boot refresh is normal for logged-out visitors, so it must never
        // trigger the redirect-to-login unauthorized handler.
        const data = await api<{ accessToken: string; user: User }>("/auth/refresh", {
          method: "POST",
          body: JSON.stringify({}),
          auth: false,
        });
        setAccessToken(data.accessToken);
        setUserState(data.user);
        return true;
      } catch {
        setAccessToken(null);
        setUserState(null);
        return false;
      }
    })();

    refreshPromise.current = pending;
    void pending.finally(() => {
      if (refreshPromise.current === pending) refreshPromise.current = null;
    });
    return pending;
  }, []);

  useEffect(() => {
    // Restore session from the HttpOnly refresh cookie on boot.
    refreshSession().finally(() => setLoading(false));
    setUnauthorizedHandler(() => {
      // Token expired — try a silent refresh once; callers await this so they
      // can retry the failed request with the fresh token.
      return refreshSession().then((ok) => {
        if (!ok) router.push("/login");
        return ok;
      });
    });
    return () => setUnauthorizedHandler(null);
  }, [refreshSession, router]);

  const login = useCallback(
    async (email: string, password: string, rememberMe: boolean) => {
      const data = await api<{ accessToken: string; user: User }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password, rememberMe }),
      });
      setAccessToken(data.accessToken);
      setUserState(data.user);
    },
    [],
  );

  const logout = useCallback(async () => {
    try {
      await api("/auth/logout", { method: "POST", body: JSON.stringify({}) });
    } catch {
      /* ignore */
    }
    setAccessToken(null);
    setUserState(null);
    router.push("/");
  }, [router]);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, setUser, refreshSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
