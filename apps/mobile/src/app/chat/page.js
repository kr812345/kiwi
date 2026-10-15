'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import KiwiMascot from '@/components/KiwiMascot';
import BottomNav from '@/components/BottomNav';
import { useKiwiChat } from '@/hooks/useKiwiChat';
import { Send, Mic, Sparkles, Code, FileText, Terminal, Zap } from 'lucide-react';

export default function ChatScreen() {
  const router = useRouter();
  const { messages, isConnected, isTyping, lastTiming, sendMessage } = useKiwiChat();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);

  const suggestions = [
    { icon: Sparkles, text: 'Ping timing check', prompt: 'ping timing check' },
    { icon: Code, text: 'Debug a React hook', prompt: 'help me debug a react hook' },
    { icon: FileText, text: 'System status', prompt: 'how are you feeling today kiwi?' },
    { icon: Terminal, text: 'Write a bash script', prompt: 'write a bash script to check open ports' },
  ];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSend = (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    sendMessage(input);
    setInput('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: 'var(--bg-primary)' }}>
      {/* Top App Bar */}
      <header
        className="glass"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '14px 20px',
          borderBottom: '1px solid var(--border-subtle)',
          zIndex: 20,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 38, height: 38 }}>
            <KiwiMascot size={38} state={isTyping ? 'thinking' : 'idle'} />
          </div>
          <div>
            <h1 style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-0.3px', color: 'var(--text-primary)' }}>
              Kiwi AI
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: isConnected ? 'var(--kiwi-green)' : '#EF4444',
                  boxShadow: isConnected ? '0 0 8px var(--kiwi-green)' : 'none',
                }}
              />
              <span style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 500 }}>
                {isConnected ? 'Synapse OS Online' : 'Reconnecting...'}
              </span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {lastTiming && (
            <div
              title={`TTFT: ${lastTiming.ttftMs}ms | Total: ${lastTiming.totalMs}ms | Tokens: ${lastTiming.tokenCount}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '6px 10px',
                borderRadius: 'var(--radius-full)',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)',
                fontSize: 11,
                color: 'var(--kiwi-green)',
                fontWeight: 600,
              }}
            >
              <Zap size={12} />
              <span>{lastTiming.ttftMs}ms TTFT</span>
            </div>
          )}

          <button
            onClick={() => router.push('/voice')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 14px',
              borderRadius: 'var(--radius-full)',
              background: 'var(--kiwi-green-soft)',
              border: '1px solid var(--border-accent)',
              color: 'var(--kiwi-green)',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <Mic size={14} />
            <span>Voice</span>
          </button>
        </div>
      </header>

      {/* Chat Messages Area */}
      <main
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px 16px 160px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        {/* Quick Suggestion Chips (Shown when conversation is fresh) */}
        {messages.length <= 1 && (
          <div style={{ marginBottom: 8 }}>
            <p
              style={{
                fontSize: 12,
                color: 'var(--text-muted)',
                marginBottom: 10,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
              }}
            >
              Suggested Actions
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {suggestions.map((item, idx) => {
                const Icon = item.icon;
                return (
                  <button
                    key={idx}
                    onClick={() => sendMessage(item.prompt || item.text)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '12px',
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-md)',
                      color: 'var(--text-primary)',
                      fontSize: 12,
                      fontWeight: 500,
                      textAlign: 'left',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <Icon size={15} color="var(--kiwi-green)" style={{ flexShrink: 0 }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.text}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Message Bubbles */}
        {messages.map((msg, idx) => {
          const isUser = msg.role === 'user';
          const isThinkingBubble = !isUser && !msg.content && isTyping;
          return (
            <div
              key={idx}
              className="animate-fade-up"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: isUser ? 'flex-end' : 'flex-start',
                gap: 4,
              }}
            >
              <div
                style={{
                  maxWidth: '82%',
                  padding: '13px 16px',
                  borderRadius: isUser ? '20px 20px 4px 20px' : '20px 20px 20px 4px',
                  background: isUser
                    ? 'linear-gradient(135deg, var(--kiwi-green), var(--kiwi-green-dark))'
                    : 'var(--bg-card)',
                  color: isUser ? '#05150D' : 'var(--text-primary)',
                  fontWeight: isUser ? 600 : 400,
                  fontSize: 14,
                  lineHeight: 1.55,
                  border: isUser ? 'none' : '1px solid var(--border-subtle)',
                  boxShadow: isUser ? '0 4px 16px rgba(16, 185, 129, 0.2)' : 'var(--shadow-card)',
                  wordBreak: 'break-word',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {isThinkingBubble ? (
                  <span style={{ color: 'var(--kiwi-green)', fontSize: 13, fontStyle: 'italic' }}>
                    [ ^ _ ^ ] kiwi is thinking...
                  </span>
                ) : (
                  msg.content
                )}
              </div>
              <span style={{ fontSize: 10, color: 'var(--text-muted)', padding: '0 4px' }}>
                {isUser ? 'You' : 'Kiwi'} • {msg.timestamp || 'now'}
                {!isUser && msg.timing
                  ? ` • TTFT ${msg.timing.ttftMs}ms · ${msg.timing.totalMs}ms (${msg.timing.tokenCount} tok)`
                  : ''}
              </span>
            </div>
          );
        })}

        <div ref={messagesEndRef} />
      </main>

      {/* Input Bar Above Bottom Nav */}
      <form
        onSubmit={handleSend}
        style={{
          position: 'fixed',
          bottom: 84,
          left: '50%',
          transform: 'translateX(-50%)',
          width: 'calc(100% - 32px)',
          maxWidth: 448,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 10px 8px 16px',
          background: 'rgba(20, 29, 25, 0.92)',
          backdropFilter: 'blur(16px)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-full)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.45)',
          zIndex: 30,
        }}
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Message Kiwi..."
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: 'var(--text-primary)',
            fontSize: 14,
          }}
        />
        <button
          type="submit"
          disabled={!input.trim()}
          style={{
            width: 38,
            height: 38,
            borderRadius: '50%',
            border: 'none',
            background: input.trim() ? 'var(--kiwi-green)' : 'var(--bg-elevated)',
            color: input.trim() ? '#04120B' : 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: input.trim() ? 'pointer' : 'default',
            transition: 'all 0.2s ease',
          }}
        >
          <Send size={17} />
        </button>
      </form>

      <BottomNav />
    </div>
  );
}
