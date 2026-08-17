"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface SplashScreenProps {
  onComplete: () => void;
}

export function SplashScreen({ onComplete }: SplashScreenProps) {
  const [showSplash, setShowSplash] = useState(true);
  const [startFly, setStartFly] = useState(false);

  useEffect(() => {
    // Start flying animation after 1.5 seconds
    const timer = setTimeout(() => {
      setStartFly(true);
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  return (
    <AnimatePresence>
      {showSplash && (
        <motion.div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#2a2421]"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          onAnimationComplete={() => {
            setShowSplash(false);
            onComplete();
          }}
        >
          {/* Center logo (scales in) */}
          <motion.div
            className="absolute"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.7, ease: "easeOut" }}
          >
            <div className="relative h-32 w-32">
              <motion.img
                src="/vichar-logo.svg"
                alt="Vichar"
                className="h-full w-full drop-shadow-2xl"
                animate={
                  startFly
                    ? {
                        x: "calc(100vw - 200px)",
                        y: "calc(-100vh + 100px)",
                        scale: 0.35,
                      }
                    : {}
                }
                transition={{
                  duration: 1.2,
                  ease: [0.25, 0.46, 0.45, 0.94],
                }}
              />
            </div>
          </motion.div>

          {/* Decorative glow effect */}
          <motion.div
            className="absolute h-64 w-64 rounded-full bg-gradient-to-r from-[#C4AF8F]/20 to-[#E8A76B]/20 blur-3xl"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 0.6 }}
            transition={{ duration: 0.8 }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
