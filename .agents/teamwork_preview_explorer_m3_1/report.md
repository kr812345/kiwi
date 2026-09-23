# Frontend Asset & Specification Report: Milestone 3 PWA

**Author**: Explorer 1 (Frontend Asset Explorer)  
**Date**: 2026-09-21  
**Target Milestone**: Milestone 3 (Mobile App MVP / PWA)  
**Output Path**: `/root/kiwi/.agents/teamwork_preview_explorer_m3_1/report.md`  

---

## Executive Summary

The Kiwi AI System requires an installable, mobile-optimized Progressive Web App (PWA) that connects to the Go API Gateway (`http://127.0.0.1:8080`), authenticates using bearer tokens, displays real-time token-by-token streaming chat with animated typewriter effects and dynamic Kiwi avatar states (`[ ^ _ ^ ]`, `[ > _ < ]`, `[ ★ ᴗ ★ ]`, `[ @ _ @ ]`), and functions offline via service worker shell caching.

### Key Investigation Findings
1. **Existing Assets**: 
   - `apps/mobile/public/styles.css`: Fully drafted (644 lines), complete with the Kiwi brand palette (`#4CAF50`, `#0D1117`, `#161B22`, `#E6EDF3`, `#7EE787`), responsive viewport rules, CSS variables, avatar animations (`pulse-thinking`, `shake`, `blink`), chat bubbles, modal styles, and code block formatting.
   - `apps/mobile/public/manifest.json`: Valid Web App Manifest configured for standalone PWA operation with dark theme colors and metadata.
   - `apps/mobile/public/sw.js`: Service worker implementing cache-first shell caching and API bypass for `/api/`, `/health`, and `/internal/`.
   - `apps/mobile/public/icon.svg`, `icon-192.png`, `icon-512.png`: High-resolution icons already generated and present.
2. **Missing Core Assets**:
   - `apps/mobile/public/index.html` is **missing** (404 Not Found).
   - `apps/mobile/public/app.js` is **missing** (404 Not Found).
   - Directory `apps/mobile/src/` is absent (while `PROJECT.md` references `apps/mobile/src/app.js` and `styles.css`).
3. **Critical Service Worker Dependency**:
   - `sw.js` precaches `SHELL_ASSETS = ['/', '/index.html', '/styles.css', '/app.js', '/manifest.json', '/icon.svg', '/icon-192.png', '/icon-512.png']`.
   - In the Service Worker Cache API, `cache.addAll()` is **atomic**. If any single file in `SHELL_ASSETS` (such as `index.html` or `app.js`) returns a 404, the entire service worker installation **fails**. Creating both `index.html` and `app.js` is mandatory for PWA installation.

---

## 1. Existing Assets Audit

| File Path | Status | Size | Inspection Summary |
|-----------|--------|------|--------------------|
| `/root/kiwi/apps/mobile/public/manifest.json` | **Present & Valid** | 785 B | Defines `name: "Kiwi AI Assistant"`, `short_name: "Kiwi"`, `display: "standalone"`, `theme_color: "#0D1117"`, `background_color: "#0D1117"`, and 3 icon definitions (`icon.svg`, `icon-192.png`, `icon-512.png`). |
| `/root/kiwi/apps/mobile/public/sw.js` | **Present** | 2,626 B | Cache-first shell strategy with network revalidation. Correctly ignores non-GET requests and explicitly passes through `/api/*`, `/health*`, and `/internal/*`. Offline navigation fallback returns cached `/`. |
| `/root/kiwi/apps/mobile/public/styles.css` | **Present & Rich** | 12,784 B (644 lines) | Implements the complete Kiwi theme palette, safe area insets (`env(safe-area-inset-top)`), CSS grid/flexbox layouts, typewriter cursor animation, modal overlay, and status pill indicators. |
| `/root/kiwi/apps/mobile/public/icon.svg` | **Present** | 2,059 B | Vector graphic with Kiwi circular body, glow filter, antenna leaf, and `[ ^ _ ^ ]` face. |
| `/root/kiwi/apps/mobile/public/icon-192.png` | **Present** | 2,245 B | 192x192 PNG maskable icon. |
| `/root/kiwi/apps/mobile/public/icon-512.png` | **Present** | 6,543 B | 512x512 PNG maskable icon. |
| `/root/kiwi/apps/mobile/public/index.html` | **MISSING** | 0 B | Must be created. |
| `/root/kiwi/apps/mobile/public/app.js` | **MISSING** | 0 B | Must be created. |
| `/root/kiwi/apps/mobile/src/` | **MISSING** | - | Should be populated or symlinked to satisfy `PROJECT.md` layout. |

---

## 2. Element & Class Name Contract in `styles.css`

To ensure zero CSS mismatch, the worker must construct `index.html` and `app.js` using the exact CSS selectors defined in `public/styles.css`:

### 2.1 CSS Variables & Colors
- `--primary`: `#4CAF50` (Kiwi green)
- `--primary-dark`: `#2E7D32` (Dark kiwi green)
- `--background`: `#0D1117` (Deep GitHub dark)
- `--surface`: `#161B22` (Card surface)
- `--surface-hover`: `#21262D`
- `--surface-border`: `#30363D`
- `--text`: `#E6EDF3` (Crisp text)
- `--text-muted`: `#8B949E`
- `--accent`: `#7EE787` (Bright kiwi accent)
- `--accent-glow`: `rgba(126, 231, 135, 0.25)`
- `--error`: `#F85149`
- `--error-bg`: `rgba(248, 81, 73, 0.15)`
- `--warning`: `#D29922`
- `--user-bubble`: `#1F2937`
- `--user-bubble-border`: `#374151`
- Fonts: `Inter`, `JetBrains Mono`

### 2.2 Header Selectors
- Container: `<header class="app-header">`
- Left section: `<div class="header-left">`
  - Logo badge: `<div class="kiwi-logo-badge"><img src="/icon.svg" alt="Kiwi Logo"></div>`
  - Titles: `<div class="header-titles"><div class="app-title">Kiwi <span class="brand-accent">AI</span></div><div class="header-subtitle">senior dev bird // synapse os</div></div>`
- Right section: `<div class="header-right">`
  - Buttons: `<button class="icon-btn" id="settings-btn" title="Settings">⚙</button>`, `<button class="icon-btn" id="clear-chat-btn" title="Clear Chat">🗑</button>`

### 2.3 Avatar & Status Bar Selectors
- Container: `<div class="status-bar-container">`
- Avatar face element: `<span id="kiwi-avatar" class="avatar-face state-idle">[ ^ _ ^ ]</span>`
  - State Idle: `.avatar-face.state-idle` -> face text `[ ^ _ ^ ]`
  - State Thinking: `.avatar-face.state-thinking` -> face text `[ > _ < ]` (triggers yellow glow + `pulse-thinking` keyframe)
  - State Solved: `.avatar-face.state-solved` -> face text `[ ★ ᴗ ★ ]` (triggers bright green glow)
  - State Error: `.avatar-face.state-error` -> face text `[ @ _ @ ]` (triggers red border + `shake` animation)
- Status pill: `<div id="status-pill" class="status-pill connected">`
  - Dot: `<span class="indicator-dot"></span>`
  - Label: `<span id="status-text">connected</span>`
  - Classes: `.status-pill.connected` (green dot), `.status-pill.thinking` (yellow blinking dot), `.status-pill.error` (red dot)

### 2.4 Chat Messages & Streaming Selectors
- Main container: `<div id="chat-messages" class="chat-messages">`
- Message Rows:
  - User turn: `<div class="message-row user"><div class="message-bubble">...</div></div>`
  - Assistant turn (streaming): 
    ```html
    <div class="message-row assistant streaming">
      <div class="message-avatar-mini">[ ^ ]</div>
      <div>
        <div class="message-bubble">
          <span class="message-content">Streaming tokens here...</span>
          <span class="typing-cursor"></span>
        </div>
        <div class="message-meta">Kiwi &bull; Gemini Flash</div>
      </div>
    </div>
    ```
  - Assistant turn (completed): `.message-row.assistant` (class `streaming` and `<span class="typing-cursor"></span>` removed)
  - System error: `<div class="message-row system-error"><div class="message-bubble">...</div></div>`

### 2.5 Quick Suggestions Selectors
- Container: `<div class="chat-suggestions">`
- Chip items: `<button class="suggestion-chip" data-prompt="...">tell me about yourself</button>`

### 2.6 Chat Input Bar Selectors
- Container: `<div class="chat-input-bar">`
- Form: `<form id="chat-form" class="chat-form">`
- Input field: `<textarea id="chat-input" class="chat-input" placeholder="Message Kiwi..." rows="1"></textarea>`
- Submit button: `<button type="submit" id="send-btn" class="send-btn" disabled>➤</button>`

### 2.7 Auth / Settings Modal Selectors
- Overlay: `<div id="auth-modal" class="modal-overlay">` (toggle class `.active` to show/hide)
- Card: `<div class="modal-card">`
- Feedback banner: `<div id="modal-feedback" class="modal-feedback"></div>` (add `.success` or `.error`)
- Form inputs: `<input id="server-url-input">`, `<input id="api-token-input">`
- Buttons: `<button id="test-connection-btn" class="btn btn-test">`, `<button id="save-settings-btn" class="btn btn-primary">`, `<button id="close-modal-btn" class="icon-btn">`

---

## 3. Implementation Blueprint: `apps/mobile/public/index.html`

The worker should implement `/root/kiwi/apps/mobile/public/index.html` with this exact structure:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
  
  <!-- PWA & Theme Meta Tags -->
  <title>Kiwi AI Assistant</title>
  <meta name="description" content="Personal AI Assistant & Senior Full-Stack Engineer powered by Synapse OS">
  <meta name="theme-color" content="#0D1117">
  <meta name="background-color" content="#0D1117">
  
  <!-- iOS Safari PWA Meta Tags -->
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="apple-mobile-web-app-title" content="Kiwi">
  <link rel="apple-touch-icon" href="/icon-192.png">
  
  <!-- Favicon and PWA Manifest -->
  <link rel="icon" type="image/svg+xml" href="/icon.svg">
  <link rel="manifest" href="/manifest.json">
  
  <!-- Stylesheets -->
  <link rel="stylesheet" href="/styles.css">
</head>
<body>
  <div id="app-container">
    <!-- Header -->
    <header class="app-header">
      <div class="header-left">
        <div class="kiwi-logo-badge">
          <img src="/icon.svg" alt="Kiwi Logo">
        </div>
        <div class="header-titles">
          <div class="app-title">Kiwi <span class="brand-accent">AI</span></div>
          <div class="header-subtitle">senior dev bird // synapse os</div>
        </div>
      </div>
      <div class="header-right">
        <button id="clear-chat-btn" class="icon-btn" title="Clear Chat History">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
        <button id="settings-btn" class="icon-btn" title="API Token & Server Settings">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
          </svg>
        </button>
      </div>
    </header>

    <!-- Avatar & Connection Status Bar -->
    <div class="status-bar-container">
      <div class="avatar-container">
        <span id="kiwi-avatar" class="avatar-face state-idle">[ ^ _ ^ ]</span>
      </div>
      <div id="status-pill" class="status-pill">
        <span class="indicator-dot"></span>
        <span id="status-text">connecting...</span>
      </div>
    </div>

    <!-- Chat Messages Scroll Container -->
    <main id="chat-messages" class="chat-messages">
      <!-- Initial Welcome Message from Kiwi Persona -->
      <div class="message-row assistant">
        <div class="message-avatar-mini">[ ^ ]</div>
        <div>
          <div class="message-bubble">
            yo! i'm kiwi — your personal dev bird. think of me as a senior engineer who lives in your terminal, never sleeps, and actually reads the docs. what are we building today? 🥝
          </div>
          <div class="message-meta">Kiwi &bull; Gemini Flash &bull; Synapse OS</div>
        </div>
      </div>
    </main>

    <!-- Prompt Suggestions -->
    <div class="chat-suggestions">
      <button class="suggestion-chip" data-prompt="hey kiwi! tell me about your architecture.">architecture overview</button>
      <button class="suggestion-chip" data-prompt="how does the go gateway communicate with the python brain?">go ↔ python bridge</button>
      <button class="suggestion-chip" data-prompt="check the status of the synapse kernel and memory engine.">system health check</button>
    </div>

    <!-- Input Bar -->
    <div class="chat-input-bar">
      <form id="chat-form" class="chat-form">
        <textarea id="chat-input" class="chat-input" placeholder="Message Kiwi (Enter to send, Shift+Enter for newline)..." rows="1"></textarea>
        <button type="submit" id="send-btn" class="send-btn" title="Send message" disabled>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
        </button>
      </form>
    </div>

    <!-- Settings & Auth Modal -->
    <div id="auth-modal" class="modal-overlay">
      <div class="modal-card">
        <div class="modal-header">
          <h3 class="modal-title">🥝 Gateway Settings & Auth</h3>
          <button id="close-modal-btn" class="icon-btn" title="Close">&times;</button>
        </div>

        <div id="modal-feedback" class="modal-feedback"></div>

        <form id="auth-form">
          <div class="form-group">
            <label for="server-url-input">GATEWAY SERVER URL</label>
            <input type="text" id="server-url-input" placeholder="http://127.0.0.1:8080" autocomplete="off" spellcheck="false">
            <div class="form-hint">Leave empty to use current host origin.</div>
          </div>

          <div class="form-group">
            <label for="api-token-input">API BEARER TOKEN</label>
            <input type="password" id="api-token-input" placeholder="Enter API Bearer Token" autocomplete="current-password" required>
            <div class="form-hint">Default dev token: <code>kiwi_secret_token_dev</code></div>
          </div>

          <div class="modal-actions">
            <button type="button" id="test-connection-btn" class="btn btn-test">Test Connection</button>
            <button type="submit" id="save-settings-btn" class="btn btn-primary">Save & Connect</button>
          </div>
        </form>
      </div>
    </div>
  </div>

  <!-- PWA Logic -->
  <script src="/app.js"></script>
</body>
</html>
```

---

## 4. Implementation Blueprint: `apps/mobile/public/app.js`

The application logic must handle:
1. Token persistence in `localStorage`.
2. Connection testing against `GET /api/secure/ping`.
3. WebSocket connection to `/api/secure/ws` with query parameter `?token=...` and initial auth frame.
4. Token-by-token streaming typewriter rendering on `chat.stream`.
5. Avatar state management:
   - Idle: `[ ^ _ ^ ]` (`state-idle`)
   - Thinking: `[ > _ < ]` (`state-thinking`)
   - Solved: `[ ★ ᴗ ★ ]` (`state-solved`)
   - Error: `[ @ _ @ ]` (`state-error`)
6. Auto-reconnection with exponential backoff (1s to 30s).
7. Service worker registration for offline PWA shell caching.

### Concrete Blueprint Code for `app.js`

```javascript
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
    idle: { face: '[ ^ _ ^ ]', className: 'state-idle' },
    thinking: { face: '[ > _ < ]', className: 'state-thinking' },
    solved: { face: '[ ★ ᴗ ★ ]', className: 'state-solved' },
    error: { face: '[ @ _ @ ]', className: 'state-error' }
  };

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
    modalFeedback.className = 'modal-feedback ' + type;
    modalFeedback.textContent = message;
    modalFeedback.style.display = 'block';
  }

  function clearModalFeedback() {
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
      sendBtn.disabled = false;

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
      sendBtn.disabled = true;
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
      avatarMini.textContent = '[ ^ ]';

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

    if (!ws || ws.readyState !== WebSocket.OPEN) {
      handleServerError('WebSocket not connected. Please check gateway connection.');
      return;
    }

    // Append User Message Bubble
    const row = document.createElement('div');
    row.className = 'message-row user';
    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    bubble.textContent = trimmed;
    row.appendChild(bubble);
    chatMessages.appendChild(row);
    scrollToBottom();

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
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  // 9. Modal Management
  function openModal() {
    serverUrlInput.value = serverUrl || window.location.origin;
    apiTokenInput.value = apiToken || '';
    clearModalFeedback();
    authModal.classList.add('active');
  }

  function closeModal() {
    authModal.classList.remove('active');
  }

  // 10. Event Listeners
  chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = chatInput.value;
    if (text.trim()) {
      sendMessage(text);
      chatInput.value = '';
      chatInput.style.height = 'auto';
    }
  });

  // Shift+Enter for newline, Enter to send
  chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      chatForm.dispatchEvent(new Event('submit'));
    }
  });

  // Auto-resize chat textarea
  chatInput.addEventListener('input', () => {
    chatInput.style.height = 'auto';
    chatInput.style.height = Math.min(chatInput.scrollHeight, 120) + 'px';
  });

  suggestionChips.forEach(chip => {
    chip.addEventListener('click', () => {
      const prompt = chip.getAttribute('data-prompt');
      if (prompt) {
        chatInput.value = prompt;
        sendMessage(prompt);
        chatInput.value = '';
        chatInput.style.height = 'auto';
      }
    });
  });

  settingsBtn.addEventListener('click', openModal);
  closeModalBtn.addEventListener('click', closeModal);

  clearChatBtn.addEventListener('click', () => {
    if (confirm('Clear chat history on screen?')) {
      chatMessages.innerHTML = '';
      currentConversationId = null;
      // Re-insert initial welcome message
      const row = document.createElement('div');
      row.className = 'message-row assistant';
      row.innerHTML = `
        <div class="message-avatar-mini">[ ^ ]</div>
        <div>
          <div class="message-bubble">yo! chat cleared. ready for the next problem 🥝</div>
          <div class="message-meta">Kiwi &bull; Fresh Context</div>
        </div>`;
      chatMessages.appendChild(row);
    }
  });

  testConnectionBtn.addEventListener('click', async () => {
    const url = serverUrlInput.value.trim() || window.location.origin;
    const token = apiTokenInput.value.trim();
    if (!token) {
      showModalFeedback('error', 'Please enter an API token to test.');
      return;
    }
    await testConnection(url, token);
  });

  authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const url = serverUrlInput.value.trim() || window.location.origin;
    const token = apiTokenInput.value.trim();

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

  // Close modal when clicking outside card
  authModal.addEventListener('click', (e) => {
    if (e.target === authModal) {
      closeModal();
    }
  });

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
```

---

## 5. Layout Alignment: `apps/mobile/public/` vs `apps/mobile/src/`

In `PROJECT.md` line 134-136, the documented layout lists:
```
apps/
└── mobile/
    ├── public/
    │   ├── index.html
    │   ├── manifest.json
    │   └── sw.js
    ├── src/
    │   ├── app.js
    │   └── styles.css
```
However, in `apps/mobile/public/sw.js` (lines 3-12), the service worker caches:
```javascript
const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/manifest.json',
  '/icon.svg',
  '/icon-192.png',
  '/icon-512.png'
];
```
Notice that:
1. `styles.css` is currently located in `apps/mobile/public/styles.css`.
2. When the Go Gateway serves `apps/mobile/public` at `/`, both `/styles.css` and `/app.js` are expected by the browser and service worker at the web root (`/styles.css` and `/app.js`).
3. **Recommendation for Worker**:
   - Write the authoritative implementation files into `apps/mobile/public/index.html` and `apps/mobile/public/app.js`.
   - Create `apps/mobile/src/` and create symlinks or file copies:
     - `apps/mobile/src/app.js` -> `../public/app.js`
     - `apps/mobile/src/styles.css` -> `../public/styles.css`
   This ensures 100% compliance with both runtime static serving requirements and `PROJECT.md` repository layout expectations.

---

## 6. Gateway Static Serving Coordination

Explorer 2 is investigating the Go Gateway changes. For frontend compatibility, the worker must ensure:
1. **Root Mounting**:
   The Go gateway in `services/gateway/main.go` should mount `http.FileServer(http.Dir("./apps/mobile/public"))` at `/`.
2. **Endpoint Priority**:
   Static file serving at `/` must NOT conflict with:
   - `/health` (Health check)
   - `/api/health`
   - `/api/secure/ping`
   - `/api/secure/chat`
   - `/api/secure/ws` (WebSocket)
3. **MIME Types**:
   Go standard library `http.FileServer` automatically detects:
   - `.html` -> `text/html; charset=utf-8`
   - `.css` -> `text/css; charset=utf-8`
   - `.js` -> `application/javascript` (or `text/javascript`)
   - `.json` -> `application/json`
   - `.svg` -> `image/svg+xml`
   - `.png` -> `image/png`

---

## 7. Verification & Acceptance Testing Plan

Once the worker implements `index.html` and `app.js` and mounts static serving:

### 7.1 Static Asset HTTP Verification
```bash
# Verify root serves index.html
curl -s http://127.0.0.1:8080/ | grep "<title>Kiwi AI Assistant</title>"

# Verify manifest.json
curl -s http://127.0.0.1:8080/manifest.json | grep '"short_name": "Kiwi"'

# Verify sw.js
curl -s http://127.0.0.1:8080/sw.js | grep 'kiwi-shell-v1'

# Verify styles.css
curl -s http://127.0.0.1:8080/styles.css | grep '\-\-primary: #4CAF50;'

# Verify app.js
curl -s http://127.0.0.1:8080/app.js | grep 'WebSocket'

# Verify icons
curl -I http://127.0.0.1:8080/icon.svg | grep "image/svg+xml"
curl -I http://127.0.0.1:8080/icon-192.png | grep "image/png"
```

### 7.2 Frontend Authentication & Ping Verification
```bash
curl -s -H "Authorization: Bearer kiwi_secret_token_dev" http://127.0.0.1:8080/api/secure/ping
# Expected: {"message":"pong - authenticated successfully!"}
```

### 7.3 Automated Integration Test Script (`scripts/test_pwa_verification.py`)
The worker should provide `scripts/test_pwa_verification.py` that validates:
1. All static assets return HTTP 200 with non-empty content and correct MIME types.
2. Authenticated frontend ping to `/api/secure/ping` succeeds.
3. WebSocket streaming turn simulating the frontend client:
   - Connects to `/api/secure/ws?token=kiwi_secret_token_dev`.
   - Sends `{"type": "chat.message", "content": "hello kiwi from pwa"}`.
   - Asserts arrival of `status.thinking`.
   - Asserts arrival of `chat.stream` token chunks.
   - Asserts arrival of `chat.complete` containing the full message.
   - Verifies Kiwi persona (`kiwi` in lowercase dev style).

---

## 8. Summary Checklist for Worker M3

- [ ] Create `/root/kiwi/apps/mobile/public/index.html` following Blueprint §3.
- [ ] Create `/root/kiwi/apps/mobile/public/app.js` following Blueprint §4.
- [ ] Create `/root/kiwi/apps/mobile/src/` with symlinks or copies of `app.js` and `styles.css` for layout compliance (§5).
- [ ] Coordinate with Explorer 2's report to update `services/gateway/main.go` for static serving at `/`.
- [ ] Recompile gateway: `go build -o services/gateway/kiwi-gateway ./services/gateway`.
- [ ] Restart PM2: `pm2 restart kiwi-gateway`.
- [ ] Run `scripts/test_pwa_verification.py` to confirm 100% passing tests.
