"use client";

// AI agent logotipi — chastota (audio-wave) ustunlari, rangi tovlanib turadi.
// Butun ilova bo'ylab (chap sidebar, o'ng AI panel) bir xil brend belgisi.
const WAVE_BARS = [
  { x: 8, y: 38, h: 24, delay: 0 },
  { x: 26, y: 22, h: 56, delay: 120 },
  { x: 44, y: 8, h: 84, delay: 240 },
  { x: 62, y: 22, h: 56, delay: 360 },
  { x: 80, y: 38, h: 24, delay: 480 },
];

export function AiWaveLogo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className="ai-wave-shimmer shrink-0" aria-hidden>
      <defs>
        <linearGradient id="aiWaveGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="45%" stopColor="#8b5cf6" />
          <stop offset="100%" stopColor="#ec4899" />
        </linearGradient>
      </defs>
      {WAVE_BARS.map((b) => (
        <rect
          key={b.x}
          className="ai-wave-bar"
          x={b.x}
          y={50 - b.h / 2}
          width={10}
          height={b.h}
          rx={5}
          fill="url(#aiWaveGrad)"
          style={{ animationDelay: `${b.delay}ms` }}
        />
      ))}
    </svg>
  );
}
