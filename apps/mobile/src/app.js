// Kiwi AI Assistant - PWA Client (app.js)
(function () {
  'use strict';

  // Constants & Storage Keys
  const STORAGE_KEY_TOKEN = 'kiwi_api_token';
  const STORAGE_KEY_URL = 'kiwi_server_url';
  const DEFAULT_DEV_TOKEN = 'kiwi_secret_token_dev';

  // DOM Elements
  const chatMessages = document.getElementById('chat-messages');
  const chatForm = document.getElementById('chat-form');
  const chatInput = document.getElementById('chat-input');
  const sendBtn = document.getElementById('send-btn');
  const kiwiAvatar = document.getElementById('kiwi-avatar');
  const statusPill = document.getElementById('status-pill');
  const statusText = document.getElementById('status-text');
  const settingsBtn = document.getElementById('settings-btn');
  const clearChatBtn = document.getElementById('clear-chat-btn');
  const authModal = document.getElementById('auth-modal');
  const closeModalBtn = document.getElementById('close-modal-btn');
  const authForm = document.getElementById('auth-form');
  const serverUrlInput = document.getElementById('server-url-input');
  const apiTokenInput = document.getElementById('api-token-input');
  const testConnectionBtn = document.getElementById('test-connection-btn');
  const modalFeedback = document.getElementById('modal-feedback');
  const suggestionChips = document.querySelectorAll('.suggestion-chip');

  // Application State
  let ws = null;
  let reconnectTimer = null;
  let reconnectAttempts = 0;
  let currentConversationId = null;
  let currentStreamingMsg = null;
  let currentStreamingContentSpan = null;
  let isFirstMessage = true;
  let currentStreamingCursor = null;
  let isIntentionallyClosed = false;

  // Initialize Configuration
  let serverUrl = localStorage.getItem(STORAGE_KEY_URL) || window.location.origin;
  if (!serverUrl || serverUrl === 'null' || serverUrl.startsWith('file:')) {
    serverUrl = 'http://127.0.0.1:8080';
  }
  let apiToken = localStorage.getItem(STORAGE_KEY_TOKEN) || DEFAULT_DEV_TOKEN;

  // 1. Avatar State Management
  const AVATAR_STATES = {
    idle: { face: '^_^', className: 'state-idle' },
    happy: { face: '^ᴗ^', className: 'state-idle' },
    excited: { face: '★ᴗ★', className: 'state-solved' },
    thinking: { face: '•_•', className: 'state-thinking' },
    confused: { face: 'ಠ_ಠ', className: 'state-idle' },
    waiting: { face: '-_-', className: 'state-idle' },
    sad: { face: 'T_T', className: 'state-idle' },
    angry: { face: '>_<', className: 'state-error' },
    shocked: { face: 'O_O', className: 'state-idle' },
    laughing: { face: '^o^', className: 'state-solved' },
    sleepy: { face: '-ᴗ-', className: 'state-idle' },
    error: { face: 'x_x', className: 'state-error' }
  };

  function detectEmotion(text) {
    const lower = text.toLowerCase();
    for (const em of Object.keys(AVATAR_STATES)) {
      if (em === 'idle' || em === 'thinking' || em === 'error' || em === 'waiting') continue;
      if (lower.includes(em)) return em;
    }
    return null;
  }


  function setAvatarState(state) {
    if (!kiwiAvatar || !AVATAR_STATES[state]) return;
    const config = AVATAR_STATES[state];
    kiwiAvatar.textContent = config.face;
    kiwiAvatar.className = 'avatar-face ' + config.className;
  }

  // 2. Status Pill Management
  function setStatus(type, label) {
    if (!statusPill || !statusText) return;
    statusPill.className = 'status-pill ' + type;
    statusText.textContent = label;
  }

  // 3. Modal Feedback Banner
  function showModalFeedback(type, message) {
    if (!modalFeedback) return;
    modalFeedback.className = 'modal-feedback ' + type;
    modalFeedback.textContent = message;
    modalFeedback.style.display = 'block';
  }

  function clearModalFeedback() {
    if (!modalFeedback) return;
    modalFeedback.className = 'modal-feedback';
    modalFeedback.textContent = '';
    modalFeedback.style.display = 'none';
  }

  // 4. Test Server Connection via GET /api/secure/ping
  async function testConnection(url, token) {
    clearModalFeedback();
    const cleanUrl = (url || '').trim().replace(/\/+$/, '');
    try {
      const resp = await fetch(`${cleanUrl}/api/secure/ping`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (resp.status === 200) {
        showModalFeedback('success', '✓ Connection successful! Authenticated with Kiwi Gateway.');
        return true;
      } else if (resp.status === 401) {
        showModalFeedback('error', '✗ Unauthorized (401): Invalid API token.');
        return false;
      } else {
        showModalFeedback('error', `✗ Server responded with HTTP status ${resp.status}`);
        return false;
      }
    } catch (err) {
      showModalFeedback('error', `✗ Connection failed: ${err.message}. Is Kiwi Gateway running?`);
      return false;
    }
  }

  // 5. WebSocket Connection Management
  function getWebSocketUrl() {
    const cleanUrl = serverUrl.trim().replace(/\/+$/, '');
    const wsProtocol = cleanUrl.startsWith('https:') ? 'wss:' : 'ws:';
    const host = cleanUrl.replace(/^https?:\/\//, '');
    return `${wsProtocol}//${host}/api/secure/ws?token=${encodeURIComponent(apiToken)}`;
  }

  function connectWebSocket() {
    if (ws) {
      isIntentionallyClosed = true;
      try { ws.close(); } catch (e) {}
      ws = null;
    }
    isIntentionallyClosed = false;

    if (!apiToken) {
      setStatus('error', 'auth required');
      setAvatarState('error');
      openModal();
      return;
    }

    setStatus('', 'connecting...');
    setAvatarState('idle');

    const wsUrl = getWebSocketUrl();
    console.log('[WebSocket] Connecting to:', wsUrl);

    try {
      ws = new WebSocket(wsUrl);
    } catch (err) {
      console.error('[WebSocket] Init failed:', err);
      handleDisconnect();
      return;
    }

    ws.onopen = function () {
      console.log('[WebSocket] Connected!');
      reconnectAttempts = 0;
      setStatus('connected', 'connected');
      setAvatarState('idle');
      if (sendBtn) sendBtn.disabled = false;

      // Method 3 support: Send immediate auth frame as secondary guarantee
      const authFrame = {
        type: 'auth',
        token: apiToken,
        content: apiToken
      };
      ws.send(JSON.stringify(authFrame));
    };

    ws.onmessage = function (event) {
      try {
        const msg = JSON.parse(event.data);
        handleWSMessage(msg);
      } catch (err) {
        console.warn('[WebSocket] Non-JSON frame received:', event.data);
      }
    };

    ws.onclose = function (event) {
      console.log('[WebSocket] Closed (code:', event.code, 'reason:', event.reason, ')');
      if (sendBtn) sendBtn.disabled = true;
      if (!isIntentionallyClosed) {
        if (event.code === 4401) {
          setStatus('error', 'invalid token');
          setAvatarState('error');
          openModal();
          showModalFeedback('error', 'Gateway rejected token (4401). Please enter a valid API token.');
        } else {
          handleDisconnect();
        }
      }
    };

    ws.onerror = function (err) {
      console.error('[WebSocket] Error occurred:', err);
    };
  }

  function handleDisconnect() {
    setStatus('error', 'disconnected');
    setAvatarState('error');

    // Exponential backoff: 1s, 1.5s, 2.25s, ... capped at 30s
    const delay = Math.min(1000 * Math.pow(1.5, reconnectAttempts), 30000);
    reconnectAttempts++;

    const delaySec = Math.round(delay / 1000);
    setStatus('error', `reconnecting in ${delaySec}s...`);

    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(() => {
      connectWebSocket();
    }, delay);
  }

  // 6. Incoming WebSocket Message Dispatcher
  function handleWSMessage(msg) {
    const type = msg.type;
    if (msg.conversation_id) {
      currentConversationId = msg.conversation_id;
    }

    switch (type) {
      case 'status.thinking':
        setStatus('thinking', 'kiwi is thinking...');
        setAvatarState('thinking');
        break;

      case 'chat.stream':
        appendStreamToken(msg.content || '');
        break;

      case 'chat.complete':
        finalizeStream(msg.content);
        break;

      case 'error':
        handleServerError(msg.content || 'Unknown gateway error');
        break;

      case 'auth':
        console.log('[WebSocket] Server acknowledged auth frame.');
        break;

      default:
        console.log('[WebSocket] Unhandled frame:', type, msg);
    }
  }

  // 7. Streaming Typewriter Animation
  function appendStreamToken(token) {
    setStatus('thinking', 'kiwi is writing...');
    setAvatarState('thinking');

    if (!currentStreamingMsg) {
      // Create new assistant streaming bubble
      const row = document.createElement('div');
      row.className = 'message-row assistant streaming';

      const avatarMini = document.createElement('div');
      avatarMini.className = 'message-avatar-mini';
      avatarMini.style.border='none'; avatarMini.style.background='transparent'; avatarMini.innerHTML = '<img src="/icon.svg" alt="Kiwi" style="width:100%; height:100%;">';

      const contentWrapper = document.createElement('div');

      const bubble = document.createElement('div');
      bubble.className = 'message-bubble';

      currentStreamingContentSpan = document.createElement('span');
      currentStreamingContentSpan.className = 'message-content';

      currentStreamingCursor = document.createElement('span');
      currentStreamingCursor.className = 'typing-cursor';

      bubble.appendChild(currentStreamingContentSpan);
      bubble.appendChild(currentStreamingCursor);

      const meta = document.createElement('div');
      meta.className = 'message-meta';
      meta.innerHTML = 'Kiwi &bull; Synapse OS Stream';

      contentWrapper.appendChild(bubble);
      contentWrapper.appendChild(meta);

      row.appendChild(avatarMini);
      row.appendChild(contentWrapper);

      chatMessages.appendChild(row);
      currentStreamingMsg = row;
    }

    if (currentStreamingContentSpan) {
      currentStreamingContentSpan.textContent += token;
    }
    scrollToBottom();
  }

  function finalizeStream(fullContent) {
    if (currentStreamingMsg) {
      currentStreamingMsg.classList.remove('streaming');
      if (currentStreamingCursor && currentStreamingCursor.parentNode) {
        currentStreamingCursor.parentNode.removeChild(currentStreamingCursor);
      }
      if (fullContent && currentStreamingContentSpan) {
        currentStreamingContentSpan.textContent = fullContent;
      }
    }

    currentStreamingMsg = null;
    currentStreamingContentSpan = null;
    currentStreamingCursor = null;

    setStatus('connected', 'connected');
    setAvatarState('solved');

    // Return avatar to idle after 2.5 seconds
    setTimeout(() => {
      setAvatarState('idle');
    }, 2500);

    scrollToBottom();
  }

  function handleServerError(errorMessage) {
    if (currentStreamingMsg) {
      finalizeStream();
    }
    const row = document.createElement('div');
    row.className = 'message-row system-error';
    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    bubble.textContent = `⚠ ${errorMessage}`;
    row.appendChild(bubble);
    chatMessages.appendChild(row);

    setStatus('error', 'error');
    setAvatarState('error');
    setTimeout(() => setAvatarState('idle'), 3000);
    scrollToBottom();
  }

  // 8. User Sending Messages
  function sendMessage(text) {
    const trimmed = (text || '').trim();
    if (!trimmed) return;

    // Append User Message Bubble
    const row = document.createElement('div');
    row.className = 'message-row user';
    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    bubble.textContent = trimmed;
    row.appendChild(bubble);
    chatMessages.appendChild(row);
    scrollToBottom();
    
    const emotion = detectEmotion(trimmed);
    if (emotion) {
      setAvatarState(emotion);
    } else {
      setAvatarState('thinking');
    }

    if (isFirstMessage) {
      isFirstMessage = false;
      setTimeout(() => {
        setAvatarState('sleepy');
        appendAssistantMessage('i am under development right now, can talk little now. So c u later.');
      }, 1000);
      return;
    }

    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.error("WS NOT OPEN! ReadyState:", ws ? ws.readyState : "null");
      handleServerError('WebSocket not connected! Check Vercel Env Vars: ' + serverUrl);
      return;
    }
    const row = document.createElement('div');
    row.className = 'message-row user';
    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    bubble.textContent = trimmed;
    row.appendChild(bubble);
    chatMessages.appendChild(row);
    scrollToBottom();
    
    const emotion = detectEmotion(trimmed);
    if (emotion) {
      setAvatarState(emotion);
    } else {
      setAvatarState('thinking');
    }

    
    if (isFirstMessage) {
      isFirstMessage = false;
      
      // Simulate typing delay
      setTimeout(() => {
        const replyRow = document.createElement('div');
        replyRow.className = 'message-row assistant';
        replyRow.innerHTML = `
          <div class="message-avatar-mini" style="border:none; background:transparent;">
            <img src="/icon.svg" alt="Kiwi" style="width:100%; height:100%;">
          </div>
          <div>
            <div class="message-bubble">i am under development right now and can talk a little, so see you later! ^_^</div>
          </div>
        `;
        chatMessages.appendChild(replyRow);
        scrollToBottom();
        setAvatarState('idle');
      }, 800);
      return;
    }

    // Send payload over WebSocket
    const payload = {
      type: 'chat.message',
      content: trimmed,
      conversation_id: currentConversationId || undefined
    };
    ws.send(JSON.stringify(payload));

    setStatus('thinking', 'kiwi is thinking...');
    setAvatarState('thinking');
  }

  function scrollToBottom() {
    if (chatMessages) {
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }
  }

  // 9. Modal Management
  function openModal() {
    if (serverUrlInput) serverUrlInput.value = serverUrl || window.location.origin;
    if (apiTokenInput) apiTokenInput.value = apiToken || '';
    clearModalFeedback();
    if (authModal) authModal.classList.add('active');
  }

  function closeModal() {
    if (authModal) authModal.classList.remove('active');
  }

  // 10. Event Listeners
  if (chatForm) {
    chatForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const text = chatInput ? chatInput.value : '';
      if (text.trim()) {
        sendMessage(text);
        if (chatInput) {
          chatInput.value = '';
          chatInput.style.height = 'auto';
        }
      }
    });
  }

  if (chatInput) {
    // Shift+Enter for newline, Enter to send
    chatInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (chatForm) chatForm.dispatchEvent(new Event('submit'));
      }
    });

    // Auto-resize chat textarea
    chatInput.addEventListener('input', () => {
      chatInput.style.height = 'auto';
      chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
    });
  }

  suggestionChips.forEach(chip => {
    chip.addEventListener('click', () => {
      const prompt = chip.getAttribute('data-prompt');
      if (prompt) {
        if (chatInput) chatInput.value = prompt;
        sendMessage(prompt);
        if (chatInput) {
          chatInput.value = '';
          chatInput.style.height = 'auto';
        }
      }
    });
  });

  if (settingsBtn) settingsBtn.addEventListener('click', openModal);
  if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);

  if (clearChatBtn) {
    clearChatBtn.addEventListener('click', () => {
      if (confirm('Clear chat history on screen?')) {
        chatMessages.innerHTML = '';
        currentConversationId = null;
        // Re-insert initial welcome message
        const row = document.createElement('div');
        row.className = 'message-row assistant';
        row.innerHTML = `
          <div class="message-avatar-mini"><img src="/icon.svg" alt="Kiwi" style="width:100%; height:100%;"></div>
          <div>
            <div class="message-bubble">yo! chat cleared. ready for the next problem 🥝</div>
            <div class="message-meta">Kiwi &bull; Fresh Context</div>
          </div>`;
        chatMessages.appendChild(row);
      }
    });
  }

  if (testConnectionBtn) {
    testConnectionBtn.addEventListener('click', async () => {
      const url = (serverUrlInput ? serverUrlInput.value.trim() : '') || window.location.origin;
      const token = apiTokenInput ? apiTokenInput.value.trim() : '';
      if (!token) {
        showModalFeedback('error', 'Please enter an API token to test.');
        return;
      }
      await testConnection(url, token);
    });
  }

  if (authForm) {
    authForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const url = (serverUrlInput ? serverUrlInput.value.trim() : '') || window.location.origin;
      const token = apiTokenInput ? apiTokenInput.value.trim() : '';

      const ok = await testConnection(url, token);
      if (ok) {
        serverUrl = url;
        apiToken = token;
        localStorage.setItem(STORAGE_KEY_URL, serverUrl);
        localStorage.setItem(STORAGE_KEY_TOKEN, apiToken);
        setTimeout(() => {
          closeModal();
          connectWebSocket();
        }, 500);
      }
    });
  }

  // Close modal when clicking outside card
  if (authModal) {
    authModal.addEventListener('click', (e) => {
      if (e.target === authModal) {
        closeModal();
      }
    });
  }

  // 11. Service Worker Registration
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then(reg => console.log('[ServiceWorker] Scope registered:', reg.scope))
        .catch(err => console.warn('[ServiceWorker] Registration failed:', err));
    });
  }

  // 12. Boot App
  connectWebSocket();
})();

