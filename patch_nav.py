import re

with open("apps/mobile/public/index.html", "r") as f:
    html = f.read()

nav_html = """
    <!-- Bottom Navigation -->
    <nav id="bottom-nav" class="bottom-nav">
      <button class="nav-item active">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
        <span>Chat</span>
      </button>
      <button class="nav-item">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2z"></path></svg>
        <span>Agents</span>
      </button>
      <button class="nav-item">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
        <span>Settings</span>
      </button>
    </nav>
"""

# Insert nav right after chat-input-bar
html = re.sub(r'(</div>\n\s*<!-- Mobile Debug Overlay -->)', nav_html + r'\n\1', html)

with open("apps/mobile/public/index.html", "w") as f:
    f.write(html)


with open("apps/mobile/src/styles.css", "r") as f:
    css = f.read()

nav_css = """
.bottom-nav {
  display: flex;
  justify-content: space-around;
  padding: 8px 0 calc(8px + env(safe-area-inset-bottom)) 0;
  background-color: var(--surface);
  border-top: 1px solid var(--surface-border);
  flex-shrink: 0;
}

.nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
}

.nav-item span {
  font-size: 10px;
}

.nav-item.active {
  color: var(--primary);
}
"""

css += "\n" + nav_css

# Remove safe area from input bar since nav takes it
old_input_bar = """.chat-input-bar {
  padding: 12px 16px;
  padding-bottom: calc(12px + env(safe-area-inset-bottom));"""

new_input_bar = """.chat-input-bar {
  padding: 12px 16px;
  flex-shrink: 0;"""

css = css.replace(old_input_bar, new_input_bar)

with open("apps/mobile/src/styles.css", "w") as f:
    f.write(css)


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

# Insert logic
js = js.replace("  // Re-bind Clear Chat", nav_js + "\n  // Re-bind Clear Chat")

with open("apps/mobile/src/app.js", "w") as f:
    f.write(js)
