import re

with open("apps/mobile/public/app.js", "r") as f:
    js = f.read()

# Replace the AVATAR_STATES dictionary with the new one
new_states = """const AVATAR_STATES = {
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
  };"""

js = re.sub(r'const AVATAR_STATES = \{.*?^\s*\}\;', new_states, js, flags=re.MULTILINE | re.DOTALL)

# Add emotion detection function right after AVATAR_STATES
detect_func = """

  function detectEmotion(text) {
    const lower = text.toLowerCase();
    for (const em of Object.keys(AVATAR_STATES)) {
      if (em === 'idle' || em === 'thinking' || em === 'error' || em === 'waiting') continue;
      if (lower.includes(em)) return em;
    }
    return null;
  }
"""
js = js.replace(new_states, new_states + detect_func)

# Fix the chat clear avatar (since the user wanted the logo here too, wait, they wanted the chat logo everywhere)
js = js.replace("[ ^ ]", '<img src="/icon.svg" alt="Kiwi" style="width:100%; height:100%;">')
js = js.replace("avatarMini.textContent =", "avatarMini.style.border='none'; avatarMini.style.background='transparent'; avatarMini.innerHTML =")

# In sendMessage(text), find:
# setAvatarState('thinking');
# And replace with:
# const emotion = detectEmotion(trimmed);
# setAvatarState(emotion || 'thinking');

# Specifically inside sendMessage
send_msg_find = """    chatMessages.appendChild(row);
    scrollToBottom();

    // Send payload over WebSocket"""
    
send_msg_repl = """    chatMessages.appendChild(row);
    scrollToBottom();
    
    const emotion = detectEmotion(trimmed);
    if (emotion) {
      setAvatarState(emotion);
    } else {
      setAvatarState('thinking');
    }

    // Send payload over WebSocket"""

js = js.replace(send_msg_find, send_msg_repl)

# We need to remove the setAvatarState('thinking') that was right after sending the payload, or just let it be replaced.
# Wait, let's find where setAvatarState('thinking') actually was in sendMessage.
js = js.replace("setAvatarState('thinking');\n    ws.send", "if (!emotion) setAvatarState('thinking');\n    ws.send")


with open("apps/mobile/public/app.js", "w") as f:
    f.write(js)
