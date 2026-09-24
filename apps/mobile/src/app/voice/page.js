'use client';
import Link from 'next/link';
import { useState, useEffect, useCallback } from 'react';
import { useKiwiChat } from '@/hooks/useKiwiChat';
import KiwiMascot from '@/components/KiwiMascot';

export default function Voice() {
  const { sendMessage, mascotMood } = useKiwiChat();
  const [mood, setMood] = useState('listening');
  const [isListening, setIsListening] = useState(true);
  const [statusText, setStatusText] = useState("Talk to Kiwi. I'm here.");

  useEffect(() => {
    // Web Speech API for detecting mood commands
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.log("Speech recognition not supported");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      const transcript = event.results[event.results.length - 1][0].transcript.toLowerCase();
      console.log('Voice recognized:', transcript);
      
      // Stop listening automatically when a message is received (optional behavior)
      setIsListening(false);
      setStatusText(`Sending: "${transcript}"...`);
      sendMessage(transcript);
    };

    recognition.onerror = (e) => {
      console.error('Speech recognition error:', e.error);
    };

    if (isListening) {
      try {
        recognition.start();
      } catch (e) {
        console.error("Could not start recognition:", e);
      }
    }

    return () => {
      try {
        recognition.stop();
      } catch (e) {}
    };
  }, [isListening]);

  return (
    <div className="page-container" style={{ padding: 0, height: '100vh', display: 'flex', flexDirection: 'column' }}>
      
      {/* Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <KiwiMascot variant="icon" mood={mood} size={40} />
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0, lineHeight: 1.2 }}>Kiwi</h2>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>Your AI buddy</p>
          </div>
        </div>
        <Link href="/settings" style={{ width: '36px', height: '36px', background: 'rgba(255,255,255,0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text)' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
        </Link>
      </header>

      {/* Main Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        
        <div style={{ textAlign: 'center', marginBottom: '40px', zIndex: 2 }}>
          <h1 style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '8px', textTransform: 'capitalize' }}>
            {mood === 'listening' || mood === 'speaking' || mood === 'processing' ? mood + '...' : mood}
          </h1>
          <p style={{ fontSize: '16px', color: 'var(--text-muted)' }}>{statusText}</p>
        </div>

        {/* Mascot & Waveforms */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', maxWidth: '300px', margin: '0 auto', flex: 1 }}>
          
          {/* Waveforms (Left) */}
          <div style={{ position: 'absolute', left: '-20px', display: 'flex', gap: '4px', alignItems: 'center', height: '60px' }}>
            <div className="wave-bar" style={{ height: '30%', animationDelay: '0.1s' }}></div>
            <div className="wave-bar" style={{ height: '70%', animationDelay: '0.2s' }}></div>
            <div className="wave-bar" style={{ height: '40%', animationDelay: '0.3s' }}></div>
            <div className="wave-bar" style={{ height: '100%', animationDelay: '0.4s' }}></div>
            <div className="wave-bar" style={{ height: '60%', animationDelay: '0.5s' }}></div>
            <div className="wave-bar" style={{ height: '30%', animationDelay: '0.6s' }}></div>
          </div>
          
          {/* Mascot */}
          <div style={{ position: 'relative', zIndex: 2, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
             {/* Base Glow */}
            <div style={{ position: 'absolute', width: '200px', height: '200px', background: 'radial-gradient(circle, rgba(139,233,66,0.3) 0%, rgba(0,0,0,0) 70%)', zIndex: 1, bottom: '-20px' }}></div>
            
            {/* SVG Mascot Component */}
            <div style={{ position: 'relative', zIndex: 2 }}>
              <KiwiMascot variant="full" mood={mood} size={220} animated={true} />
            </div>
            
            {/* Tooltip Bubble */}
            <div style={{ position: 'absolute', top: '20px', right: '-10px', background: 'rgba(30, 40, 30, 0.9)', border: '1px solid rgba(139, 233, 66, 0.3)', borderRadius: '16px', padding: '8px 12px', fontSize: '14px', color: 'var(--primary)', zIndex: 3, boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>
              I'm {mood}...
              <div style={{ position: 'absolute', bottom: '-6px', left: '20px', width: '12px', height: '12px', background: 'rgba(30, 40, 30, 0.9)', borderBottom: '1px solid rgba(139, 233, 66, 0.3)', borderRight: '1px solid rgba(139, 233, 66, 0.3)', transform: 'rotate(45deg)' }}></div>
            </div>
          </div>
          
          {/* Waveforms (Right) */}
          <div style={{ position: 'absolute', right: '-20px', display: 'flex', gap: '4px', alignItems: 'center', height: '60px' }}>
            <div className="wave-bar" style={{ height: '40%', animationDelay: '0.6s' }}></div>
            <div className="wave-bar" style={{ height: '80%', animationDelay: '0.5s' }}></div>
            <div className="wave-bar" style={{ height: '100%', animationDelay: '0.4s' }}></div>
            <div className="wave-bar" style={{ height: '50%', animationDelay: '0.3s' }}></div>
            <div className="wave-bar" style={{ height: '70%', animationDelay: '0.2s' }}></div>
            <div className="wave-bar" style={{ height: '30%', animationDelay: '0.1s' }}></div>
          </div>
          
        </div>
      </div>

      {/* Bottom Controls */}
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '32px', padding: '32px 24px 100px', zIndex: 10 }}>
        
        {/* Keyboard Button */}
        <button onClick={() => setIsListening(false)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', background: 'none', border: 'none', cursor: 'pointer' }}>
          <div style={{ width: '64px', height: '64px', background: 'rgba(255,255,255,0.05)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2" ry="2"></rect><line x1="6" y1="8" x2="6.01" y2="8"></line><line x1="10" y1="8" x2="10.01" y2="8"></line><line x1="14" y1="8" x2="14.01" y2="8"></line><line x1="18" y1="8" x2="18.01" y2="8"></line><line x1="6" y1="12" x2="6.01" y2="12"></line><line x1="10" y1="12" x2="10.01" y2="12"></line><line x1="14" y1="12" x2="14.01" y2="12"></line><line x1="18" y1="12" x2="18.01" y2="12"></line><line x1="8" y1="16" x2="16" y2="16"></line></svg>
          </div>
          <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Keyboard</span>
        </button>
        
        {/* Mic Button */}
        <button onClick={() => setIsListening(!isListening)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', background: 'transparent', border: 'none', cursor: 'pointer' }}>
          <div style={{ width: '84px', height: '84px', border: isListening ? '2px solid rgba(139, 233, 66, 0.3)' : '2px solid rgba(255, 255, 255, 0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.3s' }}>
            <div style={{ width: '68px', height: '68px', background: isListening ? 'var(--primary)' : 'rgba(255,255,255,0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: isListening ? '#000' : '#fff', transition: 'all 0.3s' }}>
              {isListening ? (
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path><path d="M19 10v2a7 7 0 0 1-14 0v-2"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>
              ) : (
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="1" y1="1" x2="23" y2="23"></line><path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"></path><path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"></path><line x1="12" y1="19" x2="12" y2="23"></line><line x1="8" y1="23" x2="16" y2="23"></line></svg>
              )}
            </div>
          </div>
          <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>{isListening ? 'Tap to stop' : 'Tap to speak'}</span>
        </button>
        
        {/* End Button */}
        <button onClick={() => setIsListening(false)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', background: 'none', border: 'none', cursor: 'pointer' }}>
          <div style={{ width: '64px', height: '64px', background: 'rgba(255,255,255,0.05)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ff4d4d' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </div>
          <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>End</span>
        </button>
        
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        .wave-bar {
          width: 4px;
          background: rgba(139, 233, 66, 0.4);
          border-radius: 2px;
          animation: ${isListening ? 'wave 1.2s ease-in-out infinite' : 'none'};
        }
        @keyframes wave {
          0%, 100% { transform: scaleY(0.3); opacity: 0.5; }
          50% { transform: scaleY(1); opacity: 1; }
        }
      `}} />
    </div>
  );
}
