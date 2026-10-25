'use client';
import React from 'react';

export const PIP_STATES = [
  'idle',
  'listening',
  'thinking',
  'working',
  'done',
  'uncertain',
  'asking',
  'blocked',
  'greeting',
  'speaking',
  'nudge',
  'approval',
];

const MOOD_TO_STATE = {
  happy: 'done',
  neutral: 'idle',
  excited: 'greeting',
  thinking: 'thinking',
  curious: 'asking',
  typing: 'working',
  listening: 'listening',
  speaking: 'speaking',
  processing: 'working',
  focused: 'working',
  confused: 'uncertain',
  tired: 'blocked',
  sleepy: 'idle',
  surprised: 'asking',
  annoyed: 'blocked',
};

function tendrilPath(state) {
  switch (state) {
    case 'listening':
    case 'asking':
    case 'approval':
      return 'M60 22 C62 8 66 4 60 2';
    case 'thinking':
    case 'working':
      return 'M60 22 C78 12 82 28 66 30';
    case 'uncertain':
      return 'M60 22 C78 18 70 6 82 8';
    case 'blocked':
      return 'M60 24 C74 28 86 26 90 32';
    case 'done':
    case 'greeting':
      return 'M60 20 C74 2 88 14 76 28';
    case 'nudge':
      return 'M64 20 C78 8 86 18 74 26';
    default:
      return 'M60 22 C74 10 80 20 70 28';
  }
}

function eyes(state) {
  if (state === 'done' || state === 'greeting') {
    return (
      <>
        <path d="M46 62 Q50 56 54 62" />
        <path d="M66 62 Q70 56 74 62" />
      </>
    );
  }
  if (state === 'working') {
    return (
      <>
        <path d="M46 62 H54" />
        <path d="M66 62 H74" />
      </>
    );
  }
  if (state === 'uncertain') {
    return (
      <>
        <ellipse cx="50" cy="62" rx="2.2" ry="3" fill="#231A14" stroke="none" />
        <ellipse cx="70" cy="61" rx="3" ry="5" fill="#231A14" stroke="none" />
      </>
    );
  }
  const tall = state === 'listening' || state === 'asking';
  const ry = tall ? 6 : 5;
  return (
    <>
      <ellipse cx="50" cy="62" rx="3" ry={ry} fill="#231A14" stroke="none" />
      <ellipse cx="70" cy="62" rx="3" ry={ry} fill="#231A14" stroke="none" />
      <circle cx="49" cy="60" r="1" fill="#FFFFFF" stroke="none" />
      <circle cx="69" cy="60" r="1" fill="#FFFFFF" stroke="none" />
    </>
  );
}

function mouth(state) {
  if (state === 'speaking') {
    return <ellipse cx="60" cy="74" rx="3.5" ry="3" fill="#231A14" stroke="none" />;
  }
  if (state === 'blocked') {
    return <path d="M54 76 H66" />;
  }
  if (state === 'uncertain') {
    return <path d="M54 75 Q58 73 62 75 T70 75" />;
  }
  return <path d="M54 74 Q60 78 66 74" />;
}

export default function KiwiMascot({
  mood = 'neutral',
  state,
  variant = 'icon',
  size = 48,
  animated = true,
  className = '',
}) {
  const resolved = PIP_STATES.includes(state) ? state : MOOD_TO_STATE[String(mood || '').toLowerCase()] || 'idle';
  const bob = animated && (resolved === 'idle' || resolved === 'greeting' || resolved === 'done');
  const seeds = Array.from({ length: 12 }, (_, index) => {
    const angle = ((index / 12) * Math.PI * 2) - Math.PI / 2;
    const radius = 22;
    return {
      cx: 60 + Math.cos(angle) * radius,
      cy: 64 + Math.sin(angle) * radius,
      dim: resolved === 'blocked' || (resolved === 'working' && index > 6),
    };
  });

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 140"
      role="img"
      aria-label={`Pip ${resolved}`}
      className={className}
      style={{ display: 'block', overflow: 'visible' }}
    >
      <style>{`
        @keyframes pip-bob { 50% { transform: translateY(-2px); } }
        @media (prefers-reduced-motion: reduce) {
          .pip-move { animation: none !important; }
        }
      `}</style>
      <g className={bob ? 'pip-move' : undefined} style={bob ? { animation: 'pip-bob 3s ease-in-out infinite', transformOrigin: '60px 80px' } : undefined}>
        <ellipse cx="60" cy="128" rx="28" ry="6" fill="#231A14" opacity="0.18" stroke="none" />
        <ellipse cx="60" cy="78" rx="46" ry="50" fill="#8A6239" stroke="#3B2A1C" strokeWidth="3" />
        <ellipse cx="48" cy="96" rx="18" ry="16" fill="#67462A" stroke="none" />
        <circle cx="60" cy="64" r="34" fill="#7CC242" stroke="#3B2A1C" strokeWidth="3" />
        <circle cx="60" cy="64" r="30" fill="#B9DE6A" stroke="none" />
        {seeds.map((seed) => (
          <ellipse
            key={`${seed.cx}-${seed.cy}`}
            cx={seed.cx}
            cy={seed.cy}
            rx="2.1"
            ry="3.2"
            fill="#231A14"
            opacity={seed.dim ? 0.35 : 1}
            stroke="none"
          />
        ))}
        <circle cx="60" cy="64" r="18" fill="#FBF6D9" stroke="none" />
        <ellipse cx="50" cy="70" rx="4" ry="2.4" fill="#F7A196" opacity="0.45" stroke="none" />
        <ellipse cx="70" cy="70" rx="4" ry="2.4" fill="#F7A196" opacity="0.45" stroke="none" />
        <g fill="none" stroke="#231A14" strokeWidth="2" strokeLinecap="round">
          {eyes(resolved)}
          {mouth(resolved)}
        </g>
        <path d={tendrilPath(resolved)} fill="none" stroke="#4F8F2B" strokeWidth="3" strokeLinecap="round" />
        {(resolved === 'greeting' || resolved === 'asking' || resolved === 'nudge') && (
          <ellipse cx={resolved === 'nudge' ? 96 : 92} cy="96" rx="7" ry="5" fill="#8A6239" stroke="#3B2A1C" strokeWidth="2" />
        )}
        {resolved === 'approval' && (
          <rect x="88" y="88" width="16" height="12" rx="2" fill="#FBF6D9" stroke="#3B2A1C" strokeWidth="2" />
        )}
        <ellipse cx="48" cy="124" rx="8" ry="4" fill="#67462A" stroke="none" />
        <ellipse cx="74" cy="124" rx="8" ry="4" fill="#67462A" stroke="none" />
      </g>
      {variant === 'full' ? null : null}
    </svg>
  );
}
