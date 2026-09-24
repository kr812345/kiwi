with open("apps/mobile/src/app.js", "r") as f:
    js = f.read()

# Add auto-expand logic to chat input
auto_expand_js = """
  if (chatInput) {
    chatInput.addEventListener('input', function() {
      this.style.height = 'auto';
      this.style.height = (this.scrollHeight) + 'px';
    });
  }
"""

js = js.replace("  if (chatInput) {", auto_expand_js + "\n  if (chatInput) {")

# Add Haptic feedback to send message
haptic_js = """
    if (navigator.vibrate) {
      try { navigator.vibrate(50); } catch(e) {}
    }
"""

js = js.replace("    scrollToBottom();\n    \n    const emotion = detectEmotion(trimmed);", "    scrollToBottom();\n" + haptic_js + "\n    const emotion = detectEmotion(trimmed);")

with open("apps/mobile/src/app.js", "w") as f:
    f.write(js)
