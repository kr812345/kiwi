'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Volume2, Bell, Cpu, Shield, Trash2, ChevronRight, Server, Activity, Check } from 'lucide-react';
import { resolveKiwiConnectionConfig } from '@/hooks/useKiwiChat';

export default function SettingsScreen() {
  const router = useRouter();
  const [voiceOutput, setVoiceOutput] = useState(true);
  const [notifications, setNotifications] = useState(true);
  const [haptics, setHaptics] = useState(true);
  const [serverUrl, setServerUrl] = useState('');
  const [apiToken, setApiToken] = useState('');
  const [savedNotice, setSavedNotice] = useState(false);
  const [pingResult, setPingResult] = useState(null);
  const [isPinging, setIsPinging] = useState(false);

  useEffect(() => {
    const cfg = resolveKiwiConnectionConfig();
    setServerUrl(cfg.serverUrl);
    setApiToken(cfg.token);
  }, []);

  const handleSaveConnection = (customUrl) => {
    const targetUrl = (typeof customUrl === 'string' ? customUrl : serverUrl).trim().replace(/\/+$/, '');
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('kiwi_server_url', targetUrl);
      window.localStorage.setItem('kiwi_api_token', apiToken.trim());
    }
    setServerUrl(targetUrl);
    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 2000);
  };

  const handleCheckTiming = async () => {
    setIsPinging(true);
    setPingResult(null);
    const targetUrl = serverUrl.trim().replace(/\/+$/, '');
    const token = apiToken.trim();
    try {
      const t0 = performance.now();
      const healthRes = await fetch(`${targetUrl}/api/health`);
      const healthMs = Math.round(performance.now() - t0);
      const healthData = await healthRes.json();

      const t1 = performance.now();
      const chatRes = await fetch(`${targetUrl}/api/secure/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: 'ping timing check',
          conversation_id: 'settings-timing-check',
        }),
      });
      const chatMs = Math.round(performance.now() - t1);
      const chatData = chatRes.ok ? await chatRes.json() : null;

      setPingResult({
        ok: healthRes.ok && chatRes.ok,
        healthMs,
        chatMs,
        brainStatus: healthData?.brain || 'unknown',
        replyPreview: chatData?.response ? chatData.response.slice(0, 70) + '...' : `HTTP ${chatRes.status}`,
      });
    } catch (err) {
      setPingResult({
        ok: false,
        error: err.message,
      });
    } finally {
      setIsPinging(false);
    }
  };

  const Toggle = ({ active, onClick }) => (
    <button
      onClick={onClick}
      style={{
        width: 46,
        height: 26,
        borderRadius: 99,
        padding: 3,
        border: 'none',
        background: active ? 'var(--kiwi-green)' : 'var(--bg-elevated)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: active ? 'flex-end' : 'flex-start',
        transition: 'all 0.25s ease',
      }}
    >
      <div
        style={{
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: active ? '#04120B' : 'var(--text-secondary)',
          transition: 'all 0.25s ease',
        }}
      />
    </button>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100dvh', background: 'var(--bg-primary)' }}>
      {/* Header */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          padding: '20px',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <button
          onClick={() => router.back()}
          style={{
            width: 38,
            height: 38,
            borderRadius: '50%',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <ArrowLeft size={18} />
        </button>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' }}>Settings</h1>
      </header>

      <main style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 24 }}>
        {/* Gateway & Timing Section */}
        <section>
          <p
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.6px',
              marginBottom: 10,
            }}
          >
            Gateway Connection & Timing
          </p>
          <div
            style={{
              background: 'var(--bg-card)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-subtle)',
              padding: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Server size={18} color="var(--kiwi-green)" />
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Backend Endpoint</span>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => handleSaveConnection('http://127.0.0.1:8080')}
                style={{
                  flex: 1,
                  padding: '8px 10px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                  background: serverUrl.includes('127.0.0.1') || serverUrl.includes('localhost') ? 'var(--kiwi-green-soft)' : 'var(--bg-elevated)',
                  color: serverUrl.includes('127.0.0.1') || serverUrl.includes('localhost') ? 'var(--kiwi-green)' : 'var(--text-secondary)',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Local (:8080)
              </button>
              <button
                type="button"
                onClick={() => handleSaveConnection('https://api.kiwi.itskrishna.live')}
                style={{
                  flex: 1,
                  padding: '8px 10px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                  background: serverUrl.includes('itskrishna.live') ? 'var(--kiwi-green-soft)' : 'var(--bg-elevated)',
                  color: serverUrl.includes('itskrishna.live') ? 'var(--kiwi-green)' : 'var(--text-secondary)',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Production
              </button>
            </div>

            <input
              type="text"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
              placeholder="http://127.0.0.1:8080"
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
                background: 'var(--bg-elevated)',
                color: 'var(--text-primary)',
                fontSize: 13,
              }}
            />

            <input
              type="password"
              value={apiToken}
              onChange={(e) => setApiToken(e.target.value)}
              placeholder="Bearer API Token"
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
                background: 'var(--bg-elevated)',
                color: 'var(--text-primary)',
                fontSize: 13,
              }}
            />

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => handleSaveConnection()}
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  border: 'none',
                  background: 'var(--kiwi-green)',
                  color: '#04120B',
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                {savedNotice ? <Check size={15} /> : null}
                <span>{savedNotice ? 'Saved!' : 'Save Config'}</span>
              </button>

              <button
                type="button"
                onClick={handleCheckTiming}
                disabled={isPinging}
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-accent)',
                  background: 'var(--kiwi-green-soft)',
                  color: 'var(--kiwi-green)',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                }}
              >
                <Activity size={15} />
                <span>{isPinging ? 'Testing...' : 'Check Timing'}</span>
              </button>
            </div>

            {pingResult && (
              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-elevated)',
                  border: `1px solid ${pingResult.ok ? 'var(--kiwi-green)' : '#EF4444'}`,
                  fontSize: 12,
                  color: 'var(--text-primary)',
                  lineHeight: 1.5,
                }}
              >
                {pingResult.error ? (
                  <span style={{ color: '#EF4444' }}>Connection Error: {pingResult.error}</span>
                ) : (
                  <>
                    <div>
                      <strong>Gateway Health:</strong> {pingResult.healthMs}ms ({pingResult.brainStatus})
                    </div>
                    <div>
                      <strong>Round-Trip Chat:</strong> {pingResult.chatMs}ms
                    </div>
                    <div style={{ color: 'var(--text-secondary)', marginTop: 4 }}>{pingResult.replyPreview}</div>
                  </>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Preferences Section */}
        <section>
          <p
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.6px',
              marginBottom: 10,
            }}
          >
            Preferences
          </p>
          <div
            style={{
              background: 'var(--bg-card)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-subtle)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px',
                borderBottom: '1px solid var(--border-subtle)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Volume2 size={18} color="var(--kiwi-green)" />
                <span style={{ fontSize: 14, fontWeight: 500 }}>Voice Responses (TTS)</span>
              </div>
              <Toggle active={voiceOutput} onClick={() => setVoiceOutput(!voiceOutput)} />
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px',
                borderBottom: '1px solid var(--border-subtle)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Bell size={18} color="var(--kiwi-green)" />
                <span style={{ fontSize: 14, fontWeight: 500 }}>Push Notifications</span>
              </div>
              <Toggle active={notifications} onClick={() => setNotifications(!notifications)} />
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Cpu size={18} color="var(--kiwi-green)" />
                <span style={{ fontSize: 14, fontWeight: 500 }}>Haptic Feedback</span>
              </div>
              <Toggle active={haptics} onClick={() => setHaptics(!haptics)} />
            </div>
          </div>
        </section>

        {/* AI Engine Config */}
        <section>
          <p
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.6px',
              marginBottom: 10,
            }}
          >
            Synapse OS Engine
          </p>
          <div
            style={{
              background: 'var(--bg-card)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-subtle)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px',
                borderBottom: '1px solid var(--border-subtle)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Shield size={18} color="var(--kiwi-green)" />
                <div>
                  <p style={{ fontSize: 14, fontWeight: 500 }}>Primary Brain Model</p>
                  <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Gemini 2.5 Flash (Low Latency)</p>
                </div>
              </div>
              <ChevronRight size={18} color="var(--text-muted)" />
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Trash2 size={18} color="#EF4444" />
                <span style={{ fontSize: 14, fontWeight: 500, color: '#EF4444' }}>Clear Conversation Memory</span>
              </div>
              <ChevronRight size={18} color="var(--text-muted)" />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
