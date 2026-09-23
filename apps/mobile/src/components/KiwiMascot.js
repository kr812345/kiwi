'use client';
import React, from 'react';

export default function KiwiMascot({ mood = 'neutral', variant = 'icon', size = 48, animated = true, className = '' }) {
  // Normalize mood to lowercase
  const currentMood = mood.toLowerCase();

  // Face rendering logic
  const renderFace = () => {
    switch (currentMood) {
      case 'happy':
        return (
          <>
            <path d="M 30,55 Q 35,48 40,55" /> {/* Left Eye ^ */}
            <path d="M 60,55 Q 65,48 70,55" /> {/* Right Eye ^ */}
            <line x1="45" y1="62" x2="55" y2="62" /> {/* Mouth _ */}
          </>
        );
      case 'neutral':
        return (
          <>
            <line x1="35" y1="50" x2="35" y2="58" /> {/* Left Eye | */}
            <line x1="65" y1="50" x2="65" y2="58" /> {/* Right Eye | */}
            <line x1="45" y1="62" x2="55" y2="62" /> {/* Mouth _ */}
          </>
        );
      case 'excited':
        return (
          <>
            <path d="M 30,52 L 35,56 L 30,60" /> {/* Left Eye > */}
            <path d="M 70,52 L 65,56 L 70,60" /> {/* Right Eye < */}
            <line x1="45" y1="62" x2="55" y2="62" /> {/* Mouth _ */}
          </>
        );
      case 'thinking':
        return (
          <>
            <line x1="35" y1="50" x2="35" y2="58" /> {/* Left Eye | */}
            <line x1="60" y1="56" x2="70" y2="56" /> {/* Right Eye - */}
            <line x1="45" y1="62" x2="55" y2="62" /> {/* Mouth _ */}
          </>
        );
      case 'curious':
        return (
          <>
            <circle cx="35" cy="54" r="2.5" fill="currentColor" stroke="none" /> {/* Left Eye . */}
            <circle cx="65" cy="54" r="2.5" fill="currentColor" stroke="none" /> {/* Right Eye . */}
            <line x1="45" y1="62" x2="55" y2="62" /> {/* Mouth _ */}
            <text x="80" y="45" fontSize="16" fill="currentColor" stroke="none" fontWeight="bold">?</text>
          </>
        );
      case 'typing':
        return (
          <>
            <line x1="35" y1="50" x2="35" y2="58" />
            <line x1="65" y1="50" x2="65" y2="58" />
            <line x1="45" y1="62" x2="55" y2="62" />
            <g className={animated ? "animate-pulse" : ""}>
              <circle cx="82" cy="55" r="1.5" fill="currentColor" stroke="none" />
              <circle cx="87" cy="55" r="1.5" fill="currentColor" stroke="none" />
              <circle cx="92" cy="55" r="1.5" fill="currentColor" stroke="none" />
            </g>
          </>
        );
      case 'listening':
        return (
          <>
            <line x1="35" y1="50" x2="35" y2="58" />
            <line x1="65" y1="50" x2="65" y2="58" />
            <line x1="45" y1="62" x2="55" y2="62" />
            {/* Sound waves left */}
            <path d="M 8,50 Q 5,54 8,58 M 4,46 Q 0,54 4,62" stroke="currentColor" strokeWidth="1.5" className={animated ? "animate-ping-slow" : ""} />
            {/* Sound waves right */}
            <path d="M 92,50 Q 95,54 92,58 M 96,46 Q 100,54 96,62" stroke="currentColor" strokeWidth="1.5" className={animated ? "animate-ping-slow" : ""} />
          </>
        );
      case 'speaking':
        return (
          <>
            <path d="M 30,55 Q 35,48 40,55" />
            <path d="M 60,55 Q 65,48 70,55" />
            <circle cx="50" cy="62" r="3" fill="currentColor" stroke="none" className={animated ? "animate-pulse" : ""} />
            {/* Sound waves right only */}
            <path d="M 85,50 Q 88,54 85,58 M 90,46 Q 94,54 90,62" stroke="currentColor" strokeWidth="1.5" className={animated ? "animate-ping-slow" : ""} />
          </>
        );
      case 'processing':
        return (
          <>
            <circle cx="35" cy="54" r="2.5" fill="currentColor" stroke="none" />
            {/* Spinner Eye */}
            <path d="M 65,48 A 6 6 0 1 1 59,54" strokeWidth="2" fill="none" strokeDasharray="4 2" className={animated ? "animate-spin-slow" : ""} style={{ transformOrigin: '65px 54px' }} />
            <line x1="45" y1="62" x2="55" y2="62" />
          </>
        );
      case 'focused':
        return (
          <>
            <line x1="30" y1="54" x2="40" y2="54" />
            <line x1="60" y1="54" x2="70" y2="54" />
            <line x1="45" y1="62" x2="55" y2="62" />
          </>
        );
      case 'confused':
        return (
          <g transform="rotate(10, 50, 55)">
            <circle cx="35" cy="54" r="2.5" fill="currentColor" stroke="none" />
            <circle cx="65" cy="54" r="2.5" fill="currentColor" stroke="none" />
            <line x1="45" y1="62" x2="55" y2="62" />
            <text x="75" y="40" fontSize="16" fill="currentColor" stroke="none" fontWeight="bold">?</text>
          </g>
        );
      case 'tired':
        return (
          <>
            <line x1="30" y1="56" x2="40" y2="56" />
            <line x1="60" y1="56" x2="70" y2="56" />
            <line x1="45" y1="62" x2="55" y2="62" />
          </>
        );
      case 'sleepy':
        return (
          <>
            <path d="M 30,54 Q 35,58 40,54" />
            <path d="M 60,54 Q 65,58 70,54" />
            <line x1="45" y1="62" x2="55" y2="62" />
            <text x="75" y="38" fontSize="10" fill="currentColor" stroke="none" className={animated ? "animate-pulse" : ""}>Z</text>
            <text x="85" y="30" fontSize="14" fill="currentColor" stroke="none" className={animated ? "animate-pulse" : ""} style={{ animationDelay: '0.5s' }}>z</text>
          </>
        );
      case 'surprised':
        return (
          <>
            <line x1="35" y1="50" x2="35" y2="58" />
            <line x1="65" y1="50" x2="65" y2="58" />
            <circle cx="50" cy="62" r="2" fill="none" strokeWidth="2" />
            {/* Action lines */}
            <path d="M 78,40 L 85,35 M 85,45 L 92,42" strokeWidth="1.5" />
          </>
        );
      case 'annoyed':
        return (
          <>
            <path d="M 30,50 L 35,54 L 30,58" />
            <path d="M 70,50 L 65,54 L 70,58" />
            <line x1="45" y1="62" x2="55" y2="62" />
            {/* Anger mark */}
            <path d="M 75,35 L 78,38 L 81,35 M 78,38 L 78,43 M 75,46 L 78,43 L 81,46" strokeWidth="1.5" />
          </>
        );
      case 'sad':
        return (
          <>
            <path d="M 30,56 Q 35,52 40,56" />
            <path d="M 60,56 Q 65,52 70,56" />
            <line x1="45" y1="62" x2="55" y2="62" />
          </>
        );
      case 'motivated':
        return (
          <>
            <path d="M 30,55 Q 35,48 40,55" />
            <path d="M 60,55 Q 65,48 70,55" />
            <line x1="45" y1="62" x2="55" y2="62" />
            {/* Action lines */}
            <path d="M 22,40 L 15,35 M 15,45 L 8,42 M 78,40 L 85,35 M 85,45 L 92,42" strokeWidth="1.5" />
          </>
        );
      case 'cool':
        return (
          <>
            {/* Sunglasses */}
            <path d="M 25,52 L 75,52 L 70,58 L 52,58 L 50,54 L 48,58 L 30,58 Z" fill="currentColor" stroke="none" />
            <line x1="45" y1="62" x2="55" y2="62" />
          </>
        );
      case 'wink':
        return (
          <>
            <path d="M 30,52 L 35,56 L 30,60" />
            <line x1="65" y1="50" x2="65" y2="58" />
            <line x1="45" y1="62" x2="55" y2="62" />
          </>
        );
      case 'success':
        return (
          <>
            <path d="M 30,55 Q 35,48 40,55" />
            <path d="M 60,55 Q 65,48 70,55" />
            <line x1="45" y1="62" x2="55" y2="62" />
            {/* Sparkle */}
            <path d="M 80,30 Q 85,35 85,40 Q 85,35 90,30 Q 85,30 85,25 Q 85,30 80,30" fill="currentColor" stroke="none" className={animated ? "animate-pulse" : ""} />
          </>
        );
      default: // Default to Neutral if unknown mood
        return (
          <>
            <line x1="35" y1="50" x2="35" y2="58" />
            <line x1="65" y1="50" x2="65" y2="58" />
            <line x1="45" y1="62" x2="55" y2="62" />
          </>
        );
    }
  };

  const isFull = variant === 'full';
  // If full mascot, we need a larger viewBox to fit the body
  const viewBox = isFull ? "0 0 100 120" : "0 0 100 100";

  return (
    <div className={`kiwi-mascot-container ${className}`} style={{ width: size, height: isFull ? size * 1.2 : size, display: 'inline-block' }}>
      <svg 
        viewBox={viewBox}
        width="100%" 
        height="100%"
        style={{ 
          color: 'var(--primary, #8be942)', 
          overflow: 'visible' 
        }}
      >
        <defs>
          <linearGradient id="glowG" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.2"/>
            <stop offset="100%" stopColor="#000" stopOpacity="0"/>
          </linearGradient>
          {/* Subtle breathing animation for full body */}
          <style>{`
            @keyframes breathe {
              0%, 100% { transform: translateY(0) scale(1); }
              50% { transform: translateY(-2px) scale(1.02); }
            }
            @keyframes spin-slow {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
            @keyframes ping-slow {
              0% { transform: scale(0.9); opacity: 0.8; }
              50% { transform: scale(1.1); opacity: 0.3; }
              100% { transform: scale(0.9); opacity: 0.8; }
            }
            .animate-breathe { animation: breathe 4s ease-in-out infinite; transform-origin: center bottom; }
            .animate-spin-slow { animation: spin-slow 2s linear infinite; }
            .animate-ping-slow { animation: ping-slow 2s ease-in-out infinite; }
            .animate-pulse { animation: ping-slow 1.5s ease-in-out infinite; }
          `}</style>
        </defs>

        <g className={animated && isFull ? "animate-breathe" : ""}>
          {/* BODY (Hoodie) - Only rendered if variant is 'full' */}
          {isFull && (
            <g transform="translate(0, 10)">
              {/* Shoulders / Torso */}
              <path 
                d="M 25,80 C 20,90 15,105 10,115 L 90,115 C 85,105 80,90 75,80 C 65,75 35,75 25,80 Z" 
                fill="#121a14" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinejoin="round" 
              />
              {/* Hoodie strings */}
              <path d="M 40,82 L 42,95 M 60,82 L 58,95" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              {/* Pocket */}
              <path d="M 25,105 L 35,95 L 65,95 L 75,105" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
              
              {/* Little ^_^ on the hoodie pocket */}
              <g transform="translate(43, 98) scale(0.4)" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M 0,5 Q 5,0 10,5" fill="none" />
                <path d="M 20,5 Q 25,0 30,5" fill="none" />
                <line x1="12" y1="8" x2="18" y2="8" fill="none" />
              </g>
            </g>
          )}

          {/* HEAD */}
          {/* Leaves */}
          <path d="M49,29 C45,15 32,18 32,18 C32,18 40,26 49,29 Z" fill="currentColor" />
          <path d="M51,29 C56,12 72,15 72,15 C72,15 60,26 51,29 Z" fill="currentColor" />
          
          {/* Rounded Box */}
          <rect 
            x="15" 
            y="29" 
            width="70" 
            height="50" 
            rx="12" 
            ry="12" 
            fill={isFull ? '#0f1710' : 'url(#glowG)'} 
            stroke="currentColor" 
            strokeWidth="2.5" 
          />

          {/* Face Container */}
          <g fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            {renderFace()}
          </g>
        </g>
      </svg>
    </div>
  );
}
