"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cx } from "@/lib/format";

type SoundId = "rain" | "wind" | "forest" | "ocean" | "fireplace" | "brown";

interface SoundHandle {
  gain: GainNode;
  stop: () => void;
}

const SOUND_PREFS_KEY = "vichar:journal:soundscape";
const DEFAULT_VOLUMES: Record<SoundId, number> = {
  rain: 0.5,
  wind: 0.42,
  forest: 0.4,
  ocean: 0.46,
  fireplace: 0.36,
  brown: 0.34,
};
const SOUNDS: { id: SoundId; icon: string; label: string; note: string }[] = [
  { id: "rain", icon: "🌧️", label: "Gentle rain", note: "Soft and steady" },
  { id: "wind", icon: "🍃", label: "Forest wind", note: "Slow leafy breeze" },
  { id: "forest", icon: "🐦", label: "Forest birds", note: "Distant morning song" },
  { id: "ocean", icon: "🌊", label: "Ocean waves", note: "Slow rolling rhythm" },
  { id: "fireplace", icon: "🔥", label: "Cozy fireplace", note: "Warm, gentle crackle" },
  { id: "brown", icon: "🤎", label: "Deep focus noise", note: "Low and softly muffled" },
];

function safeVolume(value: unknown, fallback: number, minimum: number, maximum: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(maximum, Math.max(minimum, value))
    : fallback;
}

function noiseBuffer(ctx: AudioContext): AudioBuffer {
  const length = ctx.sampleRate * 3;
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    last = last * 0.985 + white * 0.015;
    data[i] = last * 3.1;
  }
  return buffer;
}

function makeNoiseSound(ctx: AudioContext, master: AudioNode, kind: "rain" | "wind" | "ocean" | "brown"): SoundHandle {
  const config = {
    rain: { filter: "lowpass" as BiquadFilterType, frequency: 1250, q: 0.45, lfo: 0.09, movement: 0.018 },
    wind: { filter: "bandpass" as BiquadFilterType, frequency: 420, q: 0.8, lfo: 0.055, movement: 0.028 },
    ocean: { filter: "lowpass" as BiquadFilterType, frequency: 560, q: 0.55, lfo: 0.075, movement: 0.08 },
    brown: { filter: "lowpass" as BiquadFilterType, frequency: 260, q: 0.35, lfo: 0.025, movement: 0.008 },
  }[kind];
  const source = ctx.createBufferSource();
  source.buffer = noiseBuffer(ctx);
  source.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = config.filter;
  filter.frequency.value = config.frequency;
  filter.Q.value = config.q;
  const gain = ctx.createGain();
  gain.gain.value = 0;
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  lfo.frequency.value = config.lfo;
  lfoGain.gain.value = config.movement;
  lfo.connect(lfoGain);
  lfoGain.connect(gain.gain);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(master);
  source.start();
  lfo.start();
  return {
    gain,
    stop: () => {
      try { source.stop(); } catch { /* already stopped */ }
      try { lfo.stop(); } catch { /* already stopped */ }
      source.disconnect();
      lfo.disconnect();
      gain.disconnect();
    },
  };
}

function makeFireplaceSound(ctx: AudioContext, master: AudioNode): SoundHandle {
  const gain = ctx.createGain();
  gain.gain.value = 0;
  gain.connect(master);

  const bed = ctx.createBufferSource();
  const bedFilter = ctx.createBiquadFilter();
  const bedGain = ctx.createGain();
  bed.buffer = noiseBuffer(ctx);
  bed.loop = true;
  bedFilter.type = "bandpass";
  bedFilter.frequency.value = 310;
  bedFilter.Q.value = 0.7;
  bedGain.gain.value = 0.36;
  bed.connect(bedFilter);
  bedFilter.connect(bedGain);
  bedGain.connect(gain);
  bed.start();

  let stopped = false;
  const crackle = () => {
    if (stopped || ctx.state === "closed") return;
    const now = ctx.currentTime;
    const duration = 0.035 + Math.random() * 0.055;
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate);
    const samples = buffer.getChannelData(0);
    for (let i = 0; i < samples.length; i++) samples[i] = (Math.random() * 2 - 1) * (1 - i / samples.length);
    const source = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const envelope = ctx.createGain();
    source.buffer = buffer;
    filter.type = "highpass";
    filter.frequency.value = 1200 + Math.random() * 1800;
    envelope.gain.setValueAtTime(0.0001, now);
    envelope.gain.exponentialRampToValueAtTime(0.16 + Math.random() * 0.1, now + 0.006);
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    source.connect(filter);
    filter.connect(envelope);
    envelope.connect(gain);
    source.start(now);
    source.stop(now + duration + 0.01);
  };

  crackle();
  const timer = window.setInterval(() => {
    crackle();
    if (Math.random() > 0.5) window.setTimeout(crackle, 120 + Math.random() * 260);
  }, 920);

  return {
    gain,
    stop: () => {
      stopped = true;
      window.clearInterval(timer);
      try { bed.stop(); } catch { /* already stopped */ }
      bed.disconnect();
      gain.disconnect();
    },
  };
}

function makeBirdSound(ctx: AudioContext, master: AudioNode): SoundHandle {
  const gain = ctx.createGain();
  gain.gain.value = 0;
  gain.connect(master);
  let stopped = false;

  const chirp = () => {
    if (stopped || ctx.state === "closed") return;
    const now = ctx.currentTime;
    const oscillator = ctx.createOscillator();
    const envelope = ctx.createGain();
    oscillator.type = "sine";
    const base = 1250 + Math.random() * 900;
    oscillator.frequency.setValueAtTime(base, now);
    oscillator.frequency.exponentialRampToValueAtTime(base * 1.45, now + 0.1);
    oscillator.frequency.exponentialRampToValueAtTime(base * 0.92, now + 0.28);
    envelope.gain.setValueAtTime(0.0001, now);
    envelope.gain.exponentialRampToValueAtTime(0.11, now + 0.025);
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + 0.34);
    oscillator.connect(envelope);
    envelope.connect(gain);
    oscillator.start(now);
    oscillator.stop(now + 0.36);
  };

  chirp();
  const timer = window.setInterval(() => {
    chirp();
    if (Math.random() > 0.45) window.setTimeout(chirp, 260 + Math.random() * 300);
  }, 2700);

  return {
    gain,
    stop: () => {
      stopped = true;
      window.clearInterval(timer);
      gain.disconnect();
    },
  };
}

export function AmbientSoundMixer() {
  const [open, setOpen] = useState(false);
  const [playing, setPlaying] = useState<SoundId[]>([]);
  const [masterVolume, setMasterVolume] = useState(0.55);
  const [volumes, setVolumes] = useState<Record<SoundId, number>>({ ...DEFAULT_VOLUMES });
  const [audioError, setAudioError] = useState<string | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const masterRef = useRef<GainNode | null>(null);
  const handlesRef = useRef<Map<SoundId, SoundHandle>>(new Map());

  useEffect(() => {
    try {
      const saved = localStorage.getItem(SOUND_PREFS_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as { masterVolume?: number; volumes?: Partial<Record<SoundId, number>> };
        setMasterVolume(safeVolume(parsed.masterVolume, 0.55, 0, 0.9));
        if (parsed.volumes) {
          setVolumes(Object.fromEntries(
            SOUNDS.map(({ id }) => [id, safeVolume(parsed.volumes?.[id], DEFAULT_VOLUMES[id], 0.05, 0.85)]),
          ) as Record<SoundId, number>);
        }
      }
    } catch { /* ignore corrupt preferences */ }
  }, []);

  useEffect(() => {
    try { localStorage.setItem(SOUND_PREFS_KEY, JSON.stringify({ masterVolume, volumes })); } catch { /* ignore */ }
    if (masterRef.current) masterRef.current.gain.setTargetAtTime(masterVolume, masterRef.current.context.currentTime, 0.08);
  }, [masterVolume, volumes]);

  useEffect(() => {
    const onDuck = (event: Event) => {
      const active = (event as CustomEvent<{ active?: boolean }>).detail?.active;
      const master = masterRef.current;
      if (master) master.gain.setTargetAtTime(active ? masterVolume * 0.18 : masterVolume, master.context.currentTime, 0.12);
    };
    window.addEventListener("vichar:ambient-duck", onDuck);
    return () => window.removeEventListener("vichar:ambient-duck", onDuck);
  }, [masterVolume]);

  useEffect(() => () => {
    handlesRef.current.forEach((handle) => handle.stop());
    handlesRef.current.clear();
    ctxRef.current?.close().catch(() => {});
  }, []);

  const ensureAudio = useCallback(async () => {
    if (!ctxRef.current) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AC();
      const master = ctx.createGain();
      master.gain.value = masterVolume;
      master.connect(ctx.destination);
      ctxRef.current = ctx;
      masterRef.current = master;
    }
    if (ctxRef.current.state === "suspended") await ctxRef.current.resume();
    return { ctx: ctxRef.current, master: masterRef.current! };
  }, [masterVolume]);

  const stopSound = useCallback((id: SoundId) => {
    const handle = handlesRef.current.get(id);
    if (!handle) return;
    const now = handle.gain.context.currentTime;
    handle.gain.gain.cancelScheduledValues(now);
    handle.gain.gain.setValueAtTime(Math.max(handle.gain.gain.value, 0.0001), now);
    handle.gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.7);
    window.setTimeout(() => handle.stop(), 760);
    handlesRef.current.delete(id);
    setPlaying((current) => current.filter((sound) => sound !== id));
  }, []);

  const toggleSound = useCallback(async (id: SoundId) => {
    if (handlesRef.current.has(id)) {
      stopSound(id);
      return;
    }
    setAudioError(null);
    try {
      if (handlesRef.current.size >= 3) {
        const oldest = handlesRef.current.keys().next().value as SoundId | undefined;
        if (oldest) stopSound(oldest);
      }
      const { ctx, master } = await ensureAudio();
      const handle = id === "forest"
        ? makeBirdSound(ctx, master)
        : id === "fireplace"
          ? makeFireplaceSound(ctx, master)
          : makeNoiseSound(ctx, master, id);
      handlesRef.current.set(id, handle);
      const now = ctx.currentTime;
      handle.gain.gain.cancelScheduledValues(now);
      handle.gain.gain.setValueAtTime(0.0001, now);
      handle.gain.gain.exponentialRampToValueAtTime(Math.max(0.01, volumes[id]), now + 1.2);
      setPlaying((current) => [...current.filter((sound) => sound !== id), id]);
    } catch {
      setAudioError("Your browser could not start the soundscape.");
    }
  }, [ensureAudio, stopSound, volumes]);

  const setSoundVolume = (id: SoundId, value: number) => {
    setVolumes((current) => ({ ...current, [id]: value }));
    const handle = handlesRef.current.get(id);
    if (handle) handle.gain.gain.setTargetAtTime(Math.max(0.0001, value), handle.gain.context.currentTime, 0.08);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className={cx(
          "focus-ring rounded-full border border-[var(--border)] bg-white/65 px-3.5 py-2 text-sm font-semibold backdrop-blur transition-colors dark:bg-white/5",
          playing.length > 0 && "border-[#7fa36b]/50 bg-[#edf4e7]/80 text-[#587649]",
        )}
      >
        {playing.length ? "🎧 Sounds on" : "🎧 Soundscape"}
      </button>
      {open && (
        <div className="jrnl-sound-panel absolute right-0 top-full z-50 mt-2 max-h-[min(72vh,620px)] w-[min(92vw,360px)] overflow-y-auto rounded-3xl border border-[var(--border)] bg-[#fffaf1]/95 p-4 shadow-lift backdrop-blur dark:bg-[#2a2118]/95">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-heading font-semibold">Calm soundscape</p>
              <p className="mt-0.5 text-xs text-warmgray">Mix up to three sounds · generated on your device</p>
            </div>
            <button type="button" onClick={() => playing.forEach(stopSound)} className="focus-ring rounded-full px-2 py-1 text-xs font-semibold text-warmgray hover:bg-black/5">
              Stop all
            </button>
          </div>
          <div className="mt-4 space-y-2">
            {SOUNDS.map((sound) => {
              const active = playing.includes(sound.id);
              return (
                <div key={sound.id} className={cx("rounded-2xl border p-3 transition-colors", active ? "border-[#8ab6b0] bg-[#edf6f2] dark:bg-[#284038]" : "border-[var(--border)] bg-white/55 dark:bg-white/5")}>
                  <div className="flex items-center gap-3">
                    <button type="button" onClick={() => void toggleSound(sound.id)} aria-pressed={active} className="focus-ring grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-xl shadow-softer dark:bg-white/10">
                      {sound.icon}
                    </button>
                    <button type="button" onClick={() => void toggleSound(sound.id)} className="focus-ring min-w-0 flex-1 text-left">
                      <span className="block text-sm font-semibold">{sound.label}</span>
                      <span className="block text-xs text-warmgray">{active ? "Playing softly" : sound.note}</span>
                    </button>
                    <span className={cx("h-2.5 w-2.5 rounded-full", active ? "animate-pulse bg-[#6f9f83]" : "bg-black/10 dark:bg-white/10")} aria-hidden />
                  </div>
                  {active && (
                    <input aria-label={`${sound.label} volume`} className="mt-3 w-full accent-[#7fa36b]" type="range" min="0.05" max="0.85" step="0.05" value={volumes[sound.id]} onChange={(event) => setSoundVolume(sound.id, Number(event.target.value))} />
                  )}
                </div>
              );
            })}
          </div>
          <label className="mt-4 block text-xs font-semibold text-warmgray">
            Master volume
            <input className="mt-2 w-full accent-[#7fa36b]" type="range" min="0" max="0.9" step="0.05" value={masterVolume} onChange={(event) => setMasterVolume(Number(event.target.value))} />
          </label>
          {audioError && <p className="mt-3 text-xs text-rose-600">{audioError}</p>}
        </div>
      )}
    </div>
  );
}
