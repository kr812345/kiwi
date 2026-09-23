'use client';
import KiwiMascot from '@/components/KiwiMascot';
import Link from 'next/link';
import { useState, useRef, useEffect } from 'react';
import { useKiwiChat } from '@/hooks/useKiwiChat';

export default function Chat() {
  const { messages, sendMessage, isConnected, isTyping, mascotMood } = useKiwiChat();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    sendMessage(input);
    setInput('');
  };

  return (
    <div className="page-container" style={{ padding: 0, paddingBottom: 'calc(80px + env(safe-area-inset-bottom, 0px))' }}>
      
      {/* Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', borderBottom: '1px solid var(--surface-border)', background: 'var(--background)', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <KiwiMascot variant="icon" mood={mascotMood} size={40} />
          <h2 style={{ fontSize: '18px', fontWeight: 'bold' }}>Kiwi</h2>
          <div style={{ width: '8px', height: '8px', background: isConnected ? 'var(--primary)' : '#ff4d4d', borderRadius: '50%' }}></div>
        </div>
        <Link href="/settings" style={{ color: 'var(--text)' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
        </Link>
      </header>

      {/* Messages */}
      <div style={{ flex: 1, padding: '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {messages.map((msg, idx) => (
          <div key={msg.id} style={{ display: 'flex', gap: '12px', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
            {msg.role === 'assistant' && (
              <KiwiMascot variant="icon" mood={idx === messages.length - 1 ? mascotMood : "neutral"} size={28} className="flex-shrink-0 mt-1" />
            )}
            
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '75%' }}>
              <div style={{ 
                background: msg.role === 'user' ? 'rgba(139, 233, 66, 0.1)' : 'var(--surface)', 
                color: 'var(--text)', 
                padding: '12px 16px', 
                borderRadius: '16px', 
                borderBottomRightRadius: msg.role === 'user' ? '4px' : '16px',
                borderBottomLeftRadius: msg.role === 'assistant' ? '4px' : '16px',
                border: msg.role === 'user' ? '1px solid rgba(139, 233, 66, 0.2)' : '1px solid var(--surface-border)',
                fontSize: '15px',
                lineHeight: '1.4'
              }}>
                {msg.content}
              </div>
              <span style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                9:41 AM {msg.role === 'user' && <span style={{ color: 'var(--primary)' }}>✓✓</span>}
              </span>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={{ padding: '12px 16px', background: 'var(--background)', borderTop: '1px solid var(--surface-border)' }}>
        <form onSubmit={handleSend} style={{ display: 'flex', alignItems: 'center', background: 'var(--surface)', borderRadius: '100px', border: '1px solid var(--surface-border)', padding: '6px' }}>
          <button type="button" style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
          </button>
          
          <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Message Kiwi..." 
            style={{ flex: 1, background: 'transparent', border: 'none', color: 'var(--text)', padding: '8px 4px', fontSize: '15px', outline: 'none' }} 
          />
          
          <button type="submit" style={{ background: 'var(--primary)', color: '#000', border: 'none', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s', opacity: input.trim() ? 1 : 0.5 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
          </button>
        </form>
        <div style={{ textAlign: 'center', marginTop: '12px', fontSize: '10px', color: 'var(--text-muted)' }}>
          
        </div>
      </div>

    </div>
  );
}
