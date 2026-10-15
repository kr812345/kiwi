'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

const DEFAULT_TOKEN =
  process.env.NEXT_PUBLIC_API_TOKEN ||
  'prod_2d1c280ec63bb2d788667661643162b357e86613f68b4fff0baf93549493a867';

function formatNow() {
  try {
    return new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  } catch {
    return 'now';
  }
}

export function resolveKiwiConnectionConfig() {
  if (typeof window !== 'undefined') {
    const savedUrl = window.localStorage.getItem('kiwi_server_url');
    const savedToken = window.localStorage.getItem('kiwi_api_token');
    const host = window.location.hostname;
    const isLocalHost = host === 'localhost' || host === '127.0.0.1';
    const defaultUrl = isLocalHost
      ? 'http://127.0.0.1:8080'
      : process.env.NEXT_PUBLIC_SERVER_URL || 'https://api.kiwi.itskrishna.live';

    return {
      serverUrl: (savedUrl || defaultUrl).replace(/\/+$/, ''),
      token: (savedToken || DEFAULT_TOKEN).trim(),
    };
  }
  return {
    serverUrl: (process.env.NEXT_PUBLIC_SERVER_URL || 'https://api.kiwi.itskrishna.live').replace(/\/+$/, ''),
    token: DEFAULT_TOKEN,
  };
}

export function useKiwiChat() {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: "hey! [ ^ _ ^ ] i'm kiwi. my websocket ears are open — what are we building or debugging today?",
      timestamp: formatNow(),
    },
  ]);
  const [isConnected, setIsConnected] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [lastTiming, setLastTiming] = useState(null);
  const [serverUrl, setServerUrl] = useState('');
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const timingRef = useRef(null);

  const connect = useCallback(() => {
    const { serverUrl: activeUrl, token } = resolveKiwiConnectionConfig();
    setServerUrl(activeUrl);

    if (
      wsRef.current &&
      (wsRef.current.readyState === WebSocket.OPEN ||
        wsRef.current.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }

    const wsProtocol = activeUrl.startsWith('https') ? 'wss' : 'ws';
    const cleanHost = activeUrl.replace(/^https?:\/\//, '');
    const wsUrl = `${wsProtocol}://${cleanHost}/api/secure/ws?token=${encodeURIComponent(token)}`;

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const nowPerf = typeof performance !== 'undefined' ? performance.now() : Date.now();

          if (data.type === 'status.thinking') {
            setIsTyping(true);
            setMessages((prev) => [
              ...prev,
              { role: 'assistant', content: '', timestamp: formatNow(), streaming: true },
            ]);
          } else if (data.type === 'chat.stream') {
            const tokenChunk = data.content ?? data.payload?.token ?? '';
            if (timingRef.current) {
              if (timingRef.current.firstTokenAt === null) {
                timingRef.current.firstTokenAt = nowPerf;
              }
              if (timingRef.current.lastTokenAt !== null) {
                timingRef.current.deltas.push(nowPerf - timingRef.current.lastTokenAt);
              }
              timingRef.current.lastTokenAt = nowPerf;
              timingRef.current.tokenCount += 1;
            }
            setMessages((prev) => {
              const updated = [...prev];
              const lastIndex = updated.length - 1;
              if (lastIndex >= 0 && updated[lastIndex].role === 'assistant') {
                updated[lastIndex] = {
                  ...updated[lastIndex],
                  content: updated[lastIndex].content + tokenChunk,
                };
              }
              return updated;
            });
          } else if (data.type === 'chat.complete') {
            setIsTyping(false);
            const fullText = data.content ?? data.payload?.full_text ?? '';
            let timingSummary = null;
            if (timingRef.current) {
              const t = timingRef.current;
              const ttftMs =
                t.firstTokenAt !== null ? Math.round(t.firstTokenAt - t.sentAt) : Math.round(nowPerf - t.sentAt);
              const totalMs = Math.round(nowPerf - t.sentAt);
              const avgTokenMs =
                t.deltas.length > 0
                  ? Math.round(t.deltas.reduce((a, b) => a + b, 0) / t.deltas.length)
                  : 0;
              timingSummary = {
                ttftMs,
                totalMs,
                tokenCount: t.tokenCount,
                avgTokenMs,
              };
              setLastTiming(timingSummary);
              timingRef.current = null;
            }
            setMessages((prev) => {
              const updated = [...prev];
              const lastIndex = updated.length - 1;
              if (lastIndex >= 0 && updated[lastIndex].role === 'assistant') {
                updated[lastIndex] = {
                  ...updated[lastIndex],
                  content: fullText || updated[lastIndex].content,
                  streaming: false,
                  timestamp: formatNow(),
                  timing: timingSummary,
                };
              }
              return updated;
            });
          } else if (data.type === 'error') {
            setIsTyping(false);
            timingRef.current = null;
            const errMsg = data.content || data.payload?.message || 'Unknown error occurred';
            setMessages((prev) => [
              ...prev,
              { role: 'assistant', content: `error: ${errMsg}`, timestamp: formatNow() },
            ]);
          }
        } catch (err) {
          console.error('[Kiwi WS] Failed to parse message:', err);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        setIsTyping(false);
        wsRef.current = null;
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 3000);
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch (err) {
      console.error('[Kiwi WS] Connection failed:', err);
    }
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [connect]);

  const sendMessage = useCallback(
    async (text) => {
      if (!text.trim()) return;

      const cleanText = text.trim();
      const nowPerf = typeof performance !== 'undefined' ? performance.now() : Date.now();
      timingRef.current = {
        sentAt: nowPerf,
        firstTokenAt: null,
        lastTokenAt: null,
        tokenCount: 0,
        deltas: [],
      };

      setMessages((prev) => [
        ...prev,
        { role: 'user', content: cleanText, timestamp: formatNow() },
      ]);

      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({
            type: 'chat.message',
            conversation_id: 'mobile-pwa-session',
            content: cleanText,
            payload: {
              text: cleanText,
              conversation_id: 'mobile-pwa-session',
            },
          })
        );
        return;
      }

      // HTTP Fallback when WebSocket is reconnecting
      const { serverUrl: activeUrl, token } = resolveKiwiConnectionConfig();
      setIsTyping(true);
      try {
        const res = await fetch(`${activeUrl}/api/secure/chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            message: cleanText,
            conversation_id: 'mobile-pwa-session',
          }),
        });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const data = await res.json();
        const donePerf = typeof performance !== 'undefined' ? performance.now() : Date.now();
        const totalMs = Math.round(donePerf - nowPerf);
        const timingSummary = { ttftMs: totalMs, totalMs, tokenCount: 1, avgTokenMs: 0 };
        setLastTiming(timingSummary);
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: data.response || data.reply || 'no response received.',
            timestamp: formatNow(),
            timing: timingSummary,
          },
        ]);
      } catch (err) {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: `[ ^ _ ^ ] connection hiccup reaching ${activeUrl} (${err.message}). check settings or gateway status!`,
            timestamp: formatNow(),
          },
        ]);
      } finally {
        setIsTyping(false);
        timingRef.current = null;
      }
    },
    []
  );

  return {
    messages,
    isConnected,
    isTyping,
    lastTiming,
    serverUrl,
    sendMessage,
    reconnect: connect,
  };
}
