"use client";

import { useCallback, useState } from "react";
import { SplashScreen } from "./SplashScreen";

export function AppWrapper({ children }: { children: React.ReactNode }) {
  const [showSplash, setShowSplash] = useState(true);
  const finishSplash = useCallback(() => setShowSplash(false), []);

  return (
    <>
      {showSplash && <SplashScreen onComplete={finishSplash} />}
      {children}
    </>
  );
}
