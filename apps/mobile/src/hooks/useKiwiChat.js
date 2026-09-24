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

  const connect = useCallback(() => {
    let serverUrl = process.env.NEXT_PUBLIC_SERVER_URL || localStorage.getItem('kiwi_server_url') || '';
    if (!serverUrl || serverUrl === 'null' || serverUrl.startsWith('file:')) {
      serverUrl = 'http://127.0.0.1:8080';
    }
    
    // Convert http/https to ws/wss
    const wsUrl = serverUrl.replace(/^http/, 'ws') + '/api/secure/ws';
    
    try {
      if (wsRef.current) {
        wsRef.current.close();
      }
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        console.log('Connected to Kiwi server');
        // Initial config payload
        const apiToken = localStorage.getItem('kiwi_api_token') || 'kiwi_secret_token_dev';
        ws.send(JSON.stringify({
          type: 'config',
          token: apiToken,
          conversation_id: currentConversationId.current
        }));
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'config_ack') {
            if (data.conversation_id) {
              currentConversationId.current = data.conversation_id;
            }
          } 
          else if (data.type === 'start') {
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
          else if (data.type === 'stream') {
            currentStreamingMsg.current += data.chunk;
            
            // Detect emotion from stream
            const emotion = detectEmotion(currentStreamingMsg.current);
            if (emotion) setMascotMood(emotion);
            else setMascotMood('typing');
            
            setMessages(prev => {
              const newMsgs = [...prev];
              const lastMsgIndex = newMsgs.findIndex(m => m.id === currentStreamingId.current);
              if (lastMsgIndex !== -1) {
                newMsgs[lastMsgIndex].content = currentStreamingMsg.current;
              }
              return newMsgs;
            });
          } 
          else if (data.type === 'end') {
            setIsTyping(false);
            setMascotMood('happy');
            if (onMessageComplete) onMessageComplete(currentStreamingMsg.current);
            setTimeout(() => {
               setMascotMood('neutral'); // Reset after a while
            }, 3000);
          } 
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
          else if (data.type === 'error') {
            setIsTyping(false);
            setMascotMood('sad');
            setMessages(prev => [...prev, { 
              id: Date.now().toString(), 
              role: 'assistant', 
              content: 'Error: ' + data.message 
            }]);
          }
        } catch (e) {
          console.error('Failed to parse message', e);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        setIsTyping(false);
        // Auto reconnect
        setTimeout(connect, 3000);
      };

      ws.onerror = (err) => {
        console.error('WebSocket error:', err);
        ws.close();
      };
    } catch (e) {
      console.error('Failed to connect', e);
      setTimeout(connect, 3000);
    }
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  const sendMessage = useCallback((text) => {
    if (!text.trim()) return;

    // Request notification permissions on user gesture
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission();
    }
    
    // Add user message to UI
    setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', content: text }]);
    
    // Send to WebSocket
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'message',
        content: text
      }));
    } else {
      // Simulate if offline for testing
      setMascotMood('typing');
      setTimeout(() => {
        setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: 'Connection offline. Trying to reconnect...' }]);
        setMascotMood('sad');
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
