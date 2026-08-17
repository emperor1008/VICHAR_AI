"use client";

import { ThemeProvider } from "@/lib/theme";
import { AuthProvider } from "@/lib/auth";
import { AppWrapper } from "./AppWrapper";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppWrapper>{children}</AppWrapper>
      </AuthProvider>
    </ThemeProvider>
  );
}
