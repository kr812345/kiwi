'use client';
import React, { useId } from 'react';

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

const STATE_ALIASES = {
  success: 'done',
  error: 'blocked',
  confused: 'uncertain',
  proactive: 'nudge',
  'happy greeting': 'greeting',
  'happy-greeting': 'greeting',
  'asking for help': 'asking',
  'asking-for-help': 'asking',
  'error / blocked': 'blocked',
  'error/blocked': 'blocked',
};

const STATE_LABEL = {
  idle: 'idle',
  listening: 'listening',
  thinking: 'thinking',
  working: 'working',
  speaking: 'speaking',
  greeting: 'happy greeting',
  done: 'success',
  uncertain: 'confused',
  asking: 'asking for help',
  blocked: 'error',
  nudge: 'proactive',
  approval: 'approval',
};

const PRIMARY = '#84D243';
const BODY = '#F6F7F2';
const SCREEN = '#0F1411';
const ACCENT = '#C6FF6B';
const MUTED = '#A7B1A3';
const CHEEK = '#FFB3A8';
const MOUTH = '#FF8A7A';
const ALERT = '#FF4D4D';

function resolveKiwiState(state, mood) {
  if (PIP_STATES.includes(state)) return state;
  const alias = STATE_ALIASES[String(state || '').trim().toLowerCase()];
  if (alias && PIP_STATES.includes(alias)) return alias;
  const fromMood = MOOD_TO_STATE[String(mood || '').toLowerCase()];
  return fromMood || 'idle';
}

function Pill({ x, y, w, h, color = ACCENT, gloss = false }) {
  return (
    <g>
      <rect x={x - 1.4} y={y - 1.6} width={w + 2.8} height={h + 3.2} rx={(w + 2.8) / 2} fill={PRIMARY} opacity="0.38" />
      <rect x={x} y={y} width={w} height={h} rx={w / 2} fill={color} />
      {gloss && (
        <ellipse cx={x + w * 0.38} cy={y + h * 0.26} rx={Math.max(1.4, w * 0.16)} ry={Math.max(2, h * 0.14)} fill="#FFFFFF" opacity="0.9" />
      )}
    </g>
  );
}

function ArcEye({ cx, cy, color = ACCENT }) {
  const w = 9;
  const y0 = cy + 3;
  const yOuter = cy - 11;
  const yInner = cy - 3.5;
  return (
    <path
      d={`M${cx - w} ${y0} Q${cx} ${yOuter} ${cx + w} ${y0} Q${cx} ${yInner} ${cx - w} ${y0}Z`}
      fill={color}
    />
  );
}

function Bar({ x, y, color }) {
  return <rect x={x} y={y} width="16" height="7" rx="3.5" fill={color} />;
}

function QuestionMark({ x, y }) {
  return (
    <g transform={`translate(${x} ${y})`} fill={ACCENT}>
      <path d="M11.2 0C6.2 0 3.2 3.1 3.2 7.2h4.4c0-2.1 1.4-3.5 3.6-3.5 2 0 3.4 1.2 3.4 3 0 1.9-1.2 2.9-3.6 4.2-2.8 1.5-4.6 3.4-4.6 6.8V19h4.4v-1.1c0-1.8 1-2.8 3.4-4.1 2.8-1.5 5-3.4 5-6.6C19.2 2.8 16.2 0 11.2 0z" />
      <rect x="8.2" y="21.2" width="4.6" height="4.6" rx="2.3" />
    </g>
  );
}

function Bolt({ x, y }) {
  return (
    <path
      transform={`translate(${x} ${y})`}
      d="M11 0 L4 12 H9.2 L2 24 L20 10 H13.2 L18.5 0 Z"
      fill={ACCENT}
    />
  );
}

function Heart({ x, y }) {
  return (
    <path
      transform={`translate(${x} ${y})`}
      d="M12 21 C12 21 1.2 13.6 1.2 7.6 C1.2 3.6 4.4 1.4 7.6 3.4 C9.2 4.6 10.4 6.6 12 8.4 C13.6 6.6 14.8 4.6 16.4 3.4 C19.6 1.4 22.8 3.6 22.8 7.6 C22.8 13.6 12 21 12 21 Z"
      fill="#FF6B81"
    />
  );
}

function leafPath(bx, by, tx, ty, width) {
  const mx = (bx + tx) / 2;
  const my = (by + ty) / 2;
  const dx = tx - bx;
  const dy = ty - by;
  const len = Math.hypot(dx, dy) || 1;
  const px = (-dy / len) * width;
  const py = (dx / len) * width;
  return `M${bx} ${by} Q${mx + px} ${my + py} ${tx} ${ty} Q${mx - px} ${my - py} ${bx} ${by}Z`;
}

function Sprout({ lean = 0, compact = false }) {
  const rightTip = compact ? [76, 24] : [88, 14];
  const rightWidth = compact ? 8 : 11;
  return (
    <g transform={`rotate(${lean} 60 46)`}>
      <path d="M60 50 V42" stroke={PRIMARY} strokeWidth="3.6" strokeLinecap="round" />
      <path d={leafPath(62, 46, rightTip[0], rightTip[1], rightWidth)} fill={PRIMARY} />
      <path d={leafPath(58, 47, 30, 8, 15)} fill={PRIMARY} />
      <path d="M40 18 C48 28 54 36 58 44" fill="none" stroke={ACCENT} strokeWidth="2.4" strokeLinecap="round" />
      <path
        d={compact ? 'M66 36 C70 30 73 27 75 25' : 'M72 34 C78 26 83 20 86 16'}
        fill="none"
        stroke={ACCENT}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </g>
  );
}

function Ear({ cx, cy, tone, pulse }) {
  const ring = tone === 'dim' ? MUTED : tone === 'hot' ? ACCENT : PRIMARY;
  return (
    <g>
      {tone !== 'dim' && (
        <circle
          cx={cx}
          cy={cy}
          r="18"
          fill={PRIMARY}
          opacity={tone === 'hot' ? 0.34 : 0.2}
          className={pulse ? 'kiwi-move' : undefined}
          style={pulse ? { animation: 'kiwi-glow 1.5s ease-in-out infinite' } : undefined}
        />
      )}
      <circle cx={cx} cy={cy} r="13.5" fill={BODY} />
      <circle cx={cx} cy={cy} r="8.6" fill="none" stroke={ring} strokeWidth="4.4" />
      {tone !== 'dim' && <circle cx={cx} cy={cy} r="8.6" fill="none" stroke={ACCENT} strokeWidth="1.5" opacity="0.9" />}
      <circle cx={cx} cy={cy} r="4.6" fill={SCREEN} />
    </g>
  );
}

function Mark({ state }) {
  if (state === 'thinking' || state === 'asking' || state === 'uncertain') {
    return <QuestionMark x={state === 'uncertain' ? 86 : 94} y={0} />;
  }
  if (state === 'nudge') return <Bolt x={94} y={10} />;
  if (state === 'approval') return <Heart x={92} y={18} />;
  if (state === 'blocked') {
    return (
      <g stroke={ALERT} strokeWidth="4.2" strokeLinecap="round" fill="none">
        <path d="M92 48 l8 -8" />
        <path d="M96 58 l9 -7" />
        <path d="M92 68 l7 -6" />
      </g>
    );
  }
  return null;
}

function Face({ state, gloss, talk }) {
  const pills = (specs) => specs.map((spec) => <Pill key={`${spec.x}-${spec.y}`} gloss={gloss} {...spec} />);

  if (state === 'listening') {
    return (
      <>
        <g transform="rotate(-10 50 82)">
          <Pill x={44} y={74} w={10} h={16} gloss={gloss} />
        </g>
        <ArcEye cx={72} cy={80} />
      </>
    );
  }

  if (state === 'thinking') {
    return (
      <>
        {pills([{ x: 43, y: 66, w: 11, h: 26 }])}
        <Pill x={66} y={62} w={8} h={15} gloss={gloss} />
      </>
    );
  }

  if (state === 'working') {
    return (
      <>
        <Bar x={41} y={74} color={ACCENT} />
        <Bar x={63} y={74} color={ACCENT} />
      </>
    );
  }

  if (state === 'done') {
    return (
      <>
        <ArcEye cx={49} cy={78} />
        <ArcEye cx={73} cy={78} />
      </>
    );
  }

  if (state === 'greeting') {
    return (
      <>
        <ArcEye cx={49} cy={72} />
        <ArcEye cx={73} cy={72} />
        <ellipse cx="44" cy="88" rx="5.5" ry="3.3" fill={CHEEK} />
        <ellipse cx="76" cy="88" rx="5.5" ry="3.3" fill={CHEEK} />
        <ellipse cx="60" cy="91" rx="5.2" ry="3.8" fill={MOUTH} />
      </>
    );
  }

  if (state === 'speaking') {
    return (
      <>
        <ArcEye cx={49} cy={70} />
        <ArcEye cx={73} cy={70} />
        <ellipse cx="44" cy="86" rx="4.4" ry="2.6" fill={CHEEK} opacity="0.85" />
        <ellipse cx="76" cy="86" rx="4.4" ry="2.6" fill={CHEEK} opacity="0.85" />
        <g
          className={talk ? 'kiwi-move kiwi-mouth' : 'kiwi-mouth'}
          style={talk ? { animation: 'kiwi-talk 0.42s ease-in-out infinite' } : undefined}
        >
          <ellipse cx="60" cy="90" rx="8" ry="6.4" fill={MOUTH} />
          <ellipse cx="60" cy="88.6" rx="3.6" ry="2.6" fill="#FFD2C8" opacity="0.55" />
        </g>
      </>
    );
  }

  if (state === 'uncertain') {
    return (
      <>
        <Pill x={42} y={68} w={11} h={22} gloss={gloss} />
        <circle cx="72" cy="76" r="3.5" fill={ACCENT} />
      </>
    );
  }

  if (state === 'asking') {
    return (
      <>
        <Pill x={42} y={60} w={11} h={26} gloss={gloss} />
        <Pill x={64} y={62} w={10} h={22} gloss={gloss} />
      </>
    );
  }

  if (state === 'blocked') {
    return (
      <>
        <Bar x={41} y={74} color={ALERT} />
        <Bar x={63} y={74} color={ALERT} />
      </>
    );
  }

  if (state === 'nudge') {
    return (
      <>
        <Pill x={41} y={64} w={13} h={24} gloss={gloss} />
        <Pill x={64} y={64} w={13} h={24} gloss={gloss} />
      </>
    );
  }

  if (state === 'approval') {
    return (
      <>
        <Pill x={44} y={66} w={10} h={18} gloss={gloss} />
        <Pill x={66} y={66} w={10} h={18} gloss={gloss} />
      </>
    );
  }

  return pills([
    { x: 43, y: 64, w: 12, h: 30 },
    { x: 65, y: 64, w: 12, h: 30 },
  ]);
}

const POSE = {
  idle: { tilt: 0, lean: 0 },
  listening: { tilt: -4, lean: -8 },
  thinking: { tilt: 5, lean: 8 },
  working: { tilt: 0, lean: 0 },
  done: { tilt: 0, lean: -6 },
  greeting: { tilt: -3, lean: -8 },
  speaking: { tilt: 0, lean: -4 },
  uncertain: { tilt: -8, lean: 16 },
  asking: { tilt: 4, lean: 6 },
  blocked: { tilt: 3, lean: 18 },
  nudge: { tilt: -5, lean: -12 },
  approval: { tilt: -2, lean: -4 },
};

export default function KiwiMascot({
  mood = 'neutral',
  state,
  variant = 'icon',
  size = 48,
  animated = true,
  className = '',
}) {
  const resolved = resolveKiwiState(state, mood);
  const pose = POSE[resolved] || POSE.idle;
  const gloss = size >= 72;
  const bob = animated && (resolved === 'idle' || resolved === 'greeting' || resolved === 'done' || resolved === 'nudge');
  const talk = animated && resolved === 'speaking';
  const mark = resolved === 'thinking' || resolved === 'uncertain' || resolved === 'asking' || resolved === 'nudge' || resolved === 'approval';
  const earTone = resolved === 'blocked' ? 'dim' : resolved === 'listening' || resolved === 'nudge' ? 'hot' : 'rest';
  const clipId = `kiwi-body-${useId().replace(/:/g, '')}`;
  const label = STATE_LABEL[resolved] || resolved;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      role="img"
      aria-label={`Kiwi ${label}`}
      data-state={resolved}
      className={className}
      style={{ display: 'block', overflow: 'visible' }}
    >
      <style>{`
        @keyframes kiwi-bob { 50% { transform: translateY(-1.6px); } }
        @keyframes kiwi-talk { 50% { transform: scaleY(0.62); } }
        @keyframes kiwi-glow { 50% { opacity: 0.55; } }
        .kiwi-mouth { transform-box: fill-box; transform-origin: center; }
        @media (prefers-reduced-motion: reduce) {
          .kiwi-move { animation: none !important; }
        }
      `}</style>
      <ellipse
        cx="60"
        cy="114"
        rx={variant === 'full' ? 30 : 24}
        ry={variant === 'full' ? 5.5 : 4}
        fill={PRIMARY}
        opacity={variant === 'full' ? 0.5 : 0.34}
      />
      <g
        className={bob ? 'kiwi-move' : undefined}
        style={bob ? { animation: 'kiwi-bob 3.2s ease-in-out infinite', transformOrigin: '60px 74px' } : undefined}
      >
        <g transform={`rotate(${pose.tilt} 60 74)`}>
          <Ear cx={16} cy={76} tone={earTone} pulse={animated && earTone === 'hot'} />
          <Ear cx={104} cy={76} tone={earTone} pulse={animated && earTone === 'hot'} />
          <g clipPath={`url(#${clipId})`}>
            <circle cx="60" cy="74" r="36" fill={BODY} />
            {gloss && <ellipse cx="46" cy="58" rx="16" ry="10" fill="#FFFFFF" opacity="0.72" />}
            {gloss && <ellipse cx="74" cy="96" rx="22" ry="14" fill={MUTED} opacity="0.32" />}
          </g>
          <clipPath id={clipId}>
            <circle cx="60" cy="74" r="36" />
          </clipPath>
          <circle cx="60" cy="74" r="36" fill="none" stroke={MUTED} strokeWidth="1.25" opacity="0.55" />
          <ellipse cx="60" cy="77" rx="25" ry="21" fill={SCREEN} />
          <Face state={resolved} gloss={gloss} talk={talk} />
          <Sprout lean={pose.lean} compact={mark} />
          <Mark state={resolved} />
        </g>
      </g>
    </svg>
  );
}
