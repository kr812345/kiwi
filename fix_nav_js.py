with open("apps/mobile/src/app.js", "r") as f:
    js = f.read()

nav_js = """
  // Bottom Nav Hide on Keyboard
  const bottomNav = document.getElementById('bottom-nav');
  if (chatInput && bottomNav) {
    chatInput.addEventListener('focus', () => {
      bottomNav.style.display = 'none';
      scrollToBottom();
    });
    chatInput.addEventListener('blur', () => {
      setTimeout(() => {
        bottomNav.style.display = 'flex';
        scrollToBottom();
      }, 100);
    });
  }
"""

js = js.replace("})();", nav_js + "\n})();")

with open("apps/mobile/src/app.js", "w") as f:
    f.write(js)
