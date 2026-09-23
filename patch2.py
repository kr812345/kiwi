import re

with open("apps/mobile/public/app.js", "r") as f:
    js = f.read()

avatar_states = """  const EMOTION_MAP = {
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

  function setAvatarState(state) {
    if (!kiwiAvatar || !EMOTION_MAP[state]) return;
    const config = EMOTION_MAP[state];
    kiwiAvatar.textContent = config.face;
    kiwiAvatar.className = 'avatar-face ' + config.className;
  }
  
  function detectEmotion(text) {
    const lower = text.toLowerCase();
    for (const em of Object.keys(EMOTION_MAP)) {
      if (lower.includes(em) && em !== 'idle' && em !== 'error' && em !== 'thinking') {
        return em;
      }
    }
    return null;
  }
"""

# Replace AVATAR_STATES block
js = re.sub(r'const AVATAR_STATES = \{.*?\};\s*function setAvatarState\(state\) \{\s*if \(\!kiwiAvatar.*?\n.*?\n.*?\n.*?\n.*\}', avatar_states, js, flags=re.DOTALL)

# In sendMessage, update the state based on detected emotion
send_msg_replacement = """  function sendMessage(text) {
    const trimmed = (text || '').trim();
    if (!trimmed) return;

    if (!ws || ws.readyState !== WebSocket.OPEN) {
      handleServerError('WebSocket not connected. Please check gateway connection.');
      return;
    }

    const emotion = detectEmotion(trimmed);
    if (emotion) {
      setAvatarState(emotion);
    } else {
      setAvatarState('thinking');
    }
"""

js = re.sub(r'function sendMessage\(text\) \{.*?if \(\!ws \|\| ws\.readyState \!\=\= WebSocket\.OPEN\) \{.*?return;\s*\}', send_msg_replacement, js, flags=re.DOTALL)

with open("apps/mobile/public/app.js", "w") as f:
    f.write(js)
