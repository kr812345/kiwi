import { useState, useEffect, useCallback, useRef } from 'react';

const AVATAR_STATES = {
  idle: 'neutral',
  happy: 'happy',
  excited: 'excited',
  thinking: 'thinking',
  confused: 'confused',
  waiting: 'neutral',
  sad: 'sad',
  angry: 'annoyed',
  shocked: 'surprised',
  laughing: 'happy',
  sleepy: 'sleepy',
  error: 'sad'
};

function detectEmotion(text) {
  if (!text) return null;
  const lower = text.toLowerCase();
  for (const em of Object.keys(AVATAR_STATES)) {
    if (em === 'idle' || em === 'thinking' || em === 'error' || em === 'waiting') continue;
    if (lower.includes(em)) return AVATAR_STATES[em];
  }
  return null;
}

function getWebSocketUrl() {
  const rawUrl = (process.env.NEXT_PUBLIC_SERVER_URL || 'https://api.kiwi.itskrishna.live').trim();
  const cleanUrl = rawUrl.replace(/\/+$/, '');
  const wsProtocol = cleanUrl.startsWith('https:') ? 'wss:' : 'ws:';
  const host = cleanUrl.replace(/^https?:\/\//, '');
  const token = (process.env.NEXT_PUBLIC_API_TOKEN || 'kiwi_secret_token_dev').trim();
  const tokenQuery = token ? `?token=${encodeURIComponent(token)}` : '';
  return `${wsProtocol}//${host}/api/secure/ws${tokenQuery}`;
}

export function useKiwiChat(onMessageComplete = null) {
  const [messages, setMessages] = useState([
    { id: '1', role: 'assistant', content: 'Hi Kiwi here, give me some work.. i am feeling bored..' }
  ]);
  const [isConnected, setIsConnected] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [mascotMood, setMascotMood] = useState('neutral');

  const wsRef = useRef(null);
  const currentConversationId = useRef(null);
  const currentStreamingMsg = useRef('');
  const currentStreamingId = useRef(null);
  const reconnectAttempts = useRef(0);
  const reconnectTimer = useRef(null);
  const isMounted = useRef(true);

  const connect = useCallback(() => {
    if (!isMounted.current) return;

    if (wsRef.current) {
      try {
        wsRef.current.close();
      } catch (e) {}
      wsRef.current = null;
    }

    const wsUrl = getWebSocketUrl();
    const token = (process.env.NEXT_PUBLIC_API_TOKEN || 'kiwi_secret_token_dev').trim();

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!isMounted.current) {
          try { ws.close(); } catch (e) {}
          return;
        }
        setIsConnected(true);
        reconnectAttempts.current = 0;
        console.log('[Kiwi] WebSocket connected to gateway');

        // Send auth frame as secondary guarantee for the gateway
        ws.send(JSON.stringify({
          type: 'auth',
          token: token,
          content: token,
          conversation_id: currentConversationId.current || undefined
        }));
      };

      ws.onmessage = (event) => {
        if (!isMounted.current) return;

        try {
          const data = JSON.parse(event.data);

          if (data.conversation_id) {
            currentConversationId.current = data.conversation_id;
          }

          // Handle gateway status and start frames
          if (data.type === 'status.thinking' || data.type === 'start') {
            setIsTyping(true);
            setMascotMood('thinking');
            currentStreamingMsg.current = '';
            currentStreamingId.current = Date.now().toString();

            setMessages(prev => [...prev, {
              id: currentStreamingId.current,
              role: 'assistant',
              content: ''
            }]);
          }
          // Handle streaming tokens (chat.stream or legacy stream)
          else if (data.type === 'chat.stream' || data.type === 'stream') {
            const tokenChunk = data.content ?? data.chunk ?? '';
            currentStreamingMsg.current += tokenChunk;

            // If assistant message hasn't been initialized yet, initialize it
            if (!currentStreamingId.current) {
              currentStreamingId.current = Date.now().toString();
              setMessages(prev => [...prev, {
                id: currentStreamingId.current,
                role: 'assistant',
                content: currentStreamingMsg.current
              }]);
            } else {
              setMessages(prev => {
                const newMsgs = [...prev];
                const lastIndex = newMsgs.findIndex(m => m.id === currentStreamingId.current);
                if (lastIndex !== -1) {
                  newMsgs[lastIndex].content = currentStreamingMsg.current;
                }
                return newMsgs;
              });
            }

            const emotion = detectEmotion(currentStreamingMsg.current);
            if (emotion) {
              setMascotMood(emotion);
            } else {
              setMascotMood('typing');
            }
          }
          // Handle completion (chat.complete or legacy end)
          else if (data.type === 'chat.complete' || data.type === 'end') {
            setIsTyping(false);
            setMascotMood('happy');

            const finalContent = data.content || currentStreamingMsg.current;
            if (currentStreamingId.current) {
              setMessages(prev => {
                const newMsgs = [...prev];
                const lastIndex = newMsgs.findIndex(m => m.id === currentStreamingId.current);
                if (lastIndex !== -1) {
                  newMsgs[lastIndex].content = finalContent;
                }
                return newMsgs;
              });
            }

            if (onMessageComplete) {
              onMessageComplete(finalContent);
            }

            currentStreamingId.current = null;
            currentStreamingMsg.current = '';

            setTimeout(() => {
              if (isMounted.current) {
                setMascotMood('neutral');
              }
            }, 3000);
          }
          // Handle errors
          else if (data.type === 'error') {
            setIsTyping(false);
            setMascotMood('sad');
            setMessages(prev => [...prev, {
              id: Date.now().toString(),
              role: 'assistant',
              content: 'Error: ' + (data.content || data.message || 'Unknown error occurred')
            }]);
          }
          // Handle interactive actions
          else if (data.type === 'action') {
            if (data.action === 'execute_link' && data.url) {
              window.location.href = data.url;
            } else if (data.action === 'notify' && data.message) {
              if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
                new Notification('Kiwi', { body: data.message, icon: '/icon-192.png' });
              } else {
                alert("Kiwi says: " + data.message);
              }
            }
          }
          // Handle auth confirmation / ack
          else if (data.type === 'auth' || data.type === 'config_ack') {
            console.log('[Kiwi] Auth frame acknowledged by gateway');
          }
        } catch (e) {
          console.error('[Kiwi] Failed to parse WebSocket message:', e);
        }
      };

      ws.onclose = (event) => {
        if (!isMounted.current) return;
        setIsConnected(false);
        setIsTyping(false);

        // Exponential backoff capped at 15s
        const delay = Math.min(1000 * Math.pow(1.5, reconnectAttempts.current), 15000);
        reconnectAttempts.current += 1;

        if (event.code === 4401) {
          console.error('[Kiwi] Gateway rejected auth token (4401)');
          setMascotMood('sad');
          return;
        }

        clearTimeout(reconnectTimer.current);
        reconnectTimer.current = setTimeout(() => {
          if (isMounted.current) {
            connect();
          }
        }, delay);
      };

      ws.onerror = (err) => {
        console.error('[Kiwi] WebSocket error:', err);
        try {
          ws.close();
        } catch (e) {}
      };
    } catch (e) {
      console.error('[Kiwi] Failed to establish WebSocket connection:', e);
      const delay = Math.min(1000 * Math.pow(1.5, reconnectAttempts.current), 15000);
      reconnectAttempts.current += 1;
      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = setTimeout(() => {
        if (isMounted.current) {
          connect();
        }
      }, delay);
    }
  }, [onMessageComplete]);

  useEffect(() => {
    isMounted.current = true;
    connect();

    return () => {
      isMounted.current = false;
      clearTimeout(reconnectTimer.current);
      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch (e) {}
        wsRef.current = null;
      }
    };
  }, [connect]);

  const sendMessage = useCallback((text) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    // Request notification permissions on user gesture if not determined
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    // Add user message to state
    setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', content: trimmed }]);

    // Send payload using Gateway protocol
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const payload = {
        type: 'chat.message',
        content: trimmed,
        conversation_id: currentConversationId.current || undefined
      };
      wsRef.current.send(JSON.stringify(payload));
    } else {
      // Offline fallback handling
      setMascotMood('typing');
      setTimeout(() => {
        if (isMounted.current) {
          setMessages(prev => [...prev, {
            id: Date.now().toString(),
            role: 'assistant',
            content: 'Connection offline. Trying to reconnect...'
          }]);
          setMascotMood('sad');
        }
      }, 1000);
    }
  }, []);

  return {
    messages,
    sendMessage,
    isConnected,
    isTyping,
    mascotMood,
    setMascotMood
  };
}
