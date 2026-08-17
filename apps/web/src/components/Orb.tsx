"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type { EmotionKey } from "@/lib/types";

const EMOTION_COLORS: Record<EmotionKey, [string, string]> = {
  calm: ["#A8C49A", "#7FA36B"],
  anxious: ["#F2C48D", "#D99A5B"],
  overwhelmed: ["#9DC0DD", "#5B8DB8"],
  hopeful: ["#F2D9A6", "#E0A458"],
  joyful: ["#C9DFBB", "#A8C49A"],
  frustrated: ["#E8B49B", "#C47B5B"],
  sad: ["#AEBFDD", "#8B9DC3"],
  lonely: ["#CDBCE2", "#A68BC8"],
  angry: ["#E5A08F", "#C05B4D"],
  neutral: ["#C9C4B8", "#9A948A"],
};

// Arousal drives how the orb behaves: high-arousal emotions (anxious,
// overwhelmed, angry) spin and pulse fast and glow hot; calm/neutral settle.
const AROUSAL: Record<EmotionKey, { speed: number; glow: number }> = {
  calm: { speed: 6, glow: 0.55 },
  anxious: { speed: 1.6, glow: 1 },
  overwhelmed: { speed: 1.4, glow: 1 },
  hopeful: { speed: 5, glow: 0.8 },
  joyful: { speed: 3.5, glow: 0.85 },
  frustrated: { speed: 1.8, glow: 0.9 },
  sad: { speed: 4, glow: 0.7 },
  lonely: { speed: 4, glow: 0.7 },
  angry: { speed: 1.4, glow: 1 },
  neutral: { speed: 6, glow: 0.5 },
};

// Dust sparks keep the plasma's own palette: electric blue, violet, magenta, ember.
const DUST_COLORS = ["#5AC8FA", "#8A6CFF", "#C77DFF", "#FF5EA8", "#FF8A50", "#4FC3F7"];

function alpha(glow: number): string {
  return Math.round(70 + glow * 120)
    .toString(16)
    .padStart(2, "0");
}

// One-time black-background removal: draw the webp to a canvas and make the
// near-black backdrop transparent, keeping the plasma's own dark nebulae
// (they're colored, so the desaturation check leaves them intact).
let plasmaSrcPromise: Promise<string> | null = null;
function getPlasmaSrc(): Promise<string> {
  if (!plasmaSrcPromise) {
    plasmaSrcPromise = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        try {
          const c = document.createElement("canvas");
          c.width = img.naturalWidth;
          c.height = img.naturalHeight;
          const ctx = c.getContext("2d");
          if (!ctx) throw new Error("no 2d context");
          ctx.drawImage(img, 0, 0);
          const data = ctx.getImageData(0, 0, c.width, c.height);
          const px = data.data;
          for (let i = 0; i < px.length; i += 4) {
            const r = px[i];
            const g = px[i + 1];
            const b = px[i + 2];
            const max = Math.max(r, g, b);
            const min = Math.min(r, g, b);
            const lum = 0.299 * r + 0.587 * g + 0.114 * b;
            if (lum < 26) {
              px[i + 3] = 0; // solid black backdrop → fully transparent
            } else if (lum < 72 && max > 0 && (max - min) / max < 0.32) {
              px[i + 3] = Math.round(((lum - 26) / 46) * 255); // soft dark-gray edge
            }
          }
          ctx.putImageData(data, 0, 0);
          resolve(c.toDataURL("image/png"));
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = () => reject(new Error("failed to load /orb.webp"));
      img.src = "/orb.webp";
    });
  }
  return plasmaSrcPromise;
}

export function Orb({
  emotion = "calm",
  size = 220,
  breathing = true,
  className = "",
}: {
  emotion?: EmotionKey;
  size?: number;
  breathing?: boolean;
  className?: string;
}) {
  const [c1, c2] = EMOTION_COLORS[emotion] ?? EMOTION_COLORS.calm;
  const { speed, glow } = AROUSAL[emotion] ?? AROUSAL.calm;
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getPlasmaSrc()
      .then((s) => {
        if (alive) setSrc(s);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  // Stable particle geometry so the dust trails don't re-randomize on re-render.
  // Dust is intentionally tiny (1–2.5px) and faint, like floating motes.
  const particles = useMemo(() => {
    const count = size >= 100 ? 14 : 10;
    return Array.from({ length: count }, (_, i) => {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
      const dist = size * (0.5 + Math.random() * 0.5);
      const x = Math.cos(angle) * dist;
      const y = Math.sin(angle) * dist;
      return {
        id: i,
        // Start near the rim, drift outward, fade out at the end of the trail.
        x0: x * 0.25,
        y0: y * 0.25,
        x1: x * 0.6,
        y1: y * 0.6,
        x2: x,
        y2: y,
        s: Math.max(1, size * 0.018 * (0.5 + Math.random() * 0.8)),
        c: DUST_COLORS[i % DUST_COLORS.length],
        d: 2.4 + Math.random() * 2.6,
        delay: Math.random() * 4,
        o: 0.25 + Math.random() * 0.35,
      };
    });
  }, [size]);

  // Size-aware motion: small orbs (e.g. the 40px header avatar) get a gentler
  // float, a shallower 3D tumble, and a slower spin so they read calm and
  // clear; large orbs keep the full dramatic motion. Arousal still speeds
  // everything up for anxious/overwhelmed moments.
  const isSmall = size < 90;
  const fx = isSmall ? 4 : 9; // horizontal float (% of orb width)
  const ry = isSmall ? 10 : 24; // 3D Y-tumble amplitude (deg)
  const rx = isSmall ? 4 : 7; // 3D X-tilt amplitude (deg)
  const rotDuration = (isSmall ? 18 : 13) + (1 - glow) * (isSmall ? 10 : 8);
  const breatheScale = breathing ? 1 + glow * (isSmall ? 0.02 : 0.05) : 1;

  const wrapperVars = {
    "--rot": `${rotDuration}s`,
    "--speed": `${speed}s`,
    "--breathe-scale": breatheScale,
    "--fx0": `-${fx}%`,
    "--fx1": `${fx}%`,
    "--ry": `${ry}deg`,
    "--rx": `${rx}deg`,
  } as CSSProperties;

  return (
    <div
      className={`relative ${className}`}
      style={{ width: size, height: size, perspective: 900 }}
      aria-hidden
    >
      {/* Emotion halo */}
      <div
        className="absolute inset-0 rounded-full blur-3xl transition-colors duration-1000"
        style={{ background: `radial-gradient(circle, ${c1}${alpha(glow)} 0%, transparent 70%)` }}
      />
      {/* Floating 3D plasma core — drifts side to side while tumbling in 3D */}
      <div
        className="orb-move absolute inset-0 overflow-hidden rounded-full"
        style={{ boxShadow: `0 20px 60px ${c2}${alpha(glow)}`, ...wrapperVars }}
      >
        <div className="orb-breathe absolute inset-0" style={wrapperVars}>
          {src ? (
            <img src={src} alt="" draggable={false} className="h-full w-full object-cover" />
          ) : (
            <div
              className="h-full w-full"
              style={{ background: `radial-gradient(circle at 32% 28%, ${c1} 0%, ${c2} 100%)` }}
            />
          )}
          {/* Faint emotion tint so the orb still reads the conversation */}
          <div
            className="pointer-events-none absolute inset-0 mix-blend-screen"
            style={{
              background: `radial-gradient(circle, ${c1}${alpha(glow)} 0%, transparent 62%)`,
              opacity: 0.3 + glow * 0.25,
            }}
          />
        </div>
      </div>

      {/* Drifting dust particles */}
      <div className="pointer-events-none absolute inset-0">
        {particles.map((p) => (
          <span
            key={p.id}
            className="orb-dust absolute rounded-full"
            style={
              {
                width: p.s,
                height: p.s,
                left: "50%",
                top: "50%",
                marginLeft: -p.s / 2,
                marginTop: -p.s / 2,
                background: p.c,
                boxShadow: `0 0 ${p.s * 1.5}px ${p.c}`,
                "--x0": `${p.x0}px`,
                "--y0": `${p.y0}px`,
                "--x1": `${p.x1}px`,
                "--y1": `${p.y1}px`,
                "--x2": `${p.x2}px`,
                "--y2": `${p.y2}px`,
                "--o": p.o,
                "--dur": `${p.d}s`,
                "--delay": `${p.delay}s`,
              } as CSSProperties
            }
          />
        ))}
      </div>
    </div>
  );
}
