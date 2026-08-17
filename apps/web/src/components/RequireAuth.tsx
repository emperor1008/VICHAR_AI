"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";

/** Route guard: shows a subtle loader while the session restores, then
 *  renders children or redirects to /login. */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-matcha-500 border-t-transparent" />
          <p className="text-sm text-warmgray dark:text-[#b0ab9e]">Waking up…</p>
        </div>
      </div>
    );
  }
  if (!user) return null;
  return <>{children}</>;
}
