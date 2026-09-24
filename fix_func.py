with open("apps/mobile/src/app.js", "r") as f:
    js = f.read()

helper = """
  function appendAssistantMessage(msg) {
    const row = document.createElement('div');
    row.className = 'message-row assistant';
    row.innerHTML = `<div class="message-avatar-mini" style="border:none; background:transparent;"><img src="/icon.svg" alt="Kiwi" style="width:100%; height:100%;"></div>
      <div><div class="message-bubble">${msg}</div></div>`;
    chatMessages.appendChild(row);
    scrollToBottom();
  }
"""

js = js.replace("  function sendMessage(text) {", helper + "\n  function sendMessage(text) {")

with open("apps/mobile/src/app.js", "w") as f:
    f.write(js)
