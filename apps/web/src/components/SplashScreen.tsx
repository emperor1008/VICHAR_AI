"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { BrandMark } from "./BrandMark";

interface SplashScreenProps {
  onComplete: () => void;
}

export function SplashScreen({ onComplete }: SplashScreenProps) {
  const [startFly, setStartFly] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const flyTimer = window.setTimeout(() => setStartFly(true), 1250);
    const fadeTimer = window.setTimeout(() => setLeaving(true), 2350);
    const completeTimer = window.setTimeout(onComplete, 2750);

    return () => {
      window.clearTimeout(flyTimer);
      window.clearTimeout(fadeTimer);
      window.clearTimeout(completeTimer);
    };
  }, [onComplete]);

  return (
    <motion.div
      className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden bg-[#fff3ea]"
      initial={{ opacity: 1 }}
      animate={{ opacity: leaving ? 0 : 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      aria-label="Opening Vichar AI"
      role="status"
    >
      <motion.div
        aria-hidden
        className="absolute h-72 w-72 rounded-full bg-[#d87991]/20 blur-3xl sm:h-96 sm:w-96"
        initial={{ scale: 0.72, opacity: 0 }}
        animate={{ scale: 1.08, opacity: 0.85 }}
        transition={{ duration: 1.1, ease: "easeOut" }}
      />

      <motion.div
        className="relative z-10"
        initial={{ scale: 0.72, opacity: 0, y: 12 }}
        animate={
          startFly
            ? {
                x: "calc(-50vw + 42px)",
                y: "calc(-50vh + 34px)",
                scale: 0.24,
                opacity: 0.95,
              }
            : { x: 0, y: 0, scale: 1, opacity: 1 }
        }
        transition={{ duration: startFly ? 1.05 : 0.65, ease: [0.25, 0.46, 0.45, 0.94] }}
      >
        <BrandMark size="splash" priority className="shadow-[0_18px_60px_rgba(192,91,116,0.24)]" />
      </motion.div>

      <motion.div
        className="absolute top-1/2 z-10 mt-[105px] text-center sm:mt-[125px]"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: startFly ? 0 : 1, y: startFly ? -4 : 0 }}
        transition={{ duration: 0.5, delay: startFly ? 0 : 0.35 }}
      >
        <p className="font-heading text-xl font-bold tracking-[0.16em] text-[#884558] sm:text-2xl">VICHAR AI</p>
        <p className="mt-2 text-xs font-medium tracking-wide text-[#9b7180] sm:text-sm">
          Every feeling deserves to be heard
        </p>
      </motion.div>
    </motion.div>
  );
}
