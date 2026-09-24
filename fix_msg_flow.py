with open("apps/mobile/src/app.js", "r") as f:
    js = f.read()

# We need to extract the first message logic and put it above the ws check
# Actually it's easier to just do a string replace
old_send = """  function sendMessage(text) {
    const trimmed = (text || '').trim();
    if (!trimmed) return;

    if (!ws || ws.readyState !== WebSocket.OPEN) {
      handleServerError('WebSocket not connected. Please check gateway connection.');
      return;
    }

    // Append User Message Bubble
"""

new_send = """  function sendMessage(text) {
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
"""

js = js.replace(old_send, new_send)

# Also remove the old isFirstMessage block further down to avoid duplicates
js = js.replace("""    if (isFirstMessage) {
      isFirstMessage = false;
      
      // Simulate typing delay
      setTimeout(() => {
        setAvatarState('sleepy');
        appendAssistantMessage('i am under development right now, can talk little now. So c u later.');
      }, 1000);
      
      return;
    }""", "")

with open("apps/mobile/src/app.js", "w") as f:
    f.write(js)
