with open("apps/mobile/src/app.js", "r") as f:
    js = f.read()

menu_js = """
  // Dropdown Menu Logic
  const menuBtn = document.getElementById('menu-btn');
  const dropdownMenu = document.getElementById('dropdown-menu');
  const menuClearChat = document.getElementById('menu-clear-chat');
  const menuThemeToggle = document.getElementById('menu-theme-toggle');

  if (menuBtn) {
    menuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdownMenu.style.display = dropdownMenu.style.display === 'none' ? 'block' : 'none';
    });
  }
  
  document.addEventListener('click', () => {
    if (dropdownMenu) dropdownMenu.style.display = 'none';
  });

  if (menuClearChat) {
    menuClearChat.addEventListener('click', () => {
      if (confirm('Clear chat history?')) {
        chatMessages.innerHTML = '';
      }
    });
  }

  let isLightMode = false;
  if (menuThemeToggle) {
    menuThemeToggle.addEventListener('click', () => {
      isLightMode = !isLightMode;
      document.body.style.background = isLightMode ? '#ffffff' : '#0D1117';
      document.body.style.color = isLightMode ? '#000000' : '#c9d1d9';
    });
  }
"""

js = js.replace("  // Re-bind Clear Chat", menu_js + "\n  // Old bind removed")
# also remove the old clear chat binding
js = js.replace("""  const realClearChatBtn = document.getElementById('clear-chat-btn');
  if (realClearChatBtn) {
    realClearChatBtn.addEventListener('click', () => {
      if (confirm('Clear chat history?')) {
        chatMessages.innerHTML = '';
      }
    });
  }""", "")

with open("apps/mobile/src/app.js", "w") as f:
    f.write(js)
