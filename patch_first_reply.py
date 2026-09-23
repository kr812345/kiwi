import re

with open("apps/mobile/public/app.js", "r") as f:
    js = f.read()

# Add a state variable to track if it's the first message
if "let isFirstMessage = true;" not in js:
    js = js.replace("let currentStreamingContentSpan = null;", "let currentStreamingContentSpan = null;\n  let isFirstMessage = true;")

# Inside sendMessage, intercept if it's the first message
interceptor = """
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

    // Send payload over WebSocket"""

js = js.replace("// Send payload over WebSocket", interceptor)

with open("apps/mobile/public/app.js", "w") as f:
    f.write(js)
