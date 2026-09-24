import re
with open("apps/mobile/src/styles.css", "r") as f:
    css = f.read()

# Fix app-container
css = css.replace("  height: 100dvh; /* fallback */\n", "")

# Fix chat-input-bar padding
old_input_bar = """.chat-input-bar {
  padding-bottom: calc(16px + env(safe-area-inset-bottom));
  padding: 12px 16px calc(12px + var(--safe-bottom)) 16px;
  background-color: var(--surface);
  border-top: 1px solid var(--surface-border);
}"""

new_input_bar = """.chat-input-bar {
  padding: 12px 16px;
  padding-bottom: calc(12px + env(safe-area-inset-bottom));
  background-color: var(--surface);
  border-top: 1px solid var(--surface-border);
}"""

css = css.replace(old_input_bar, new_input_bar)

# Fix header padding
old_header = """.header {
  padding-top: env(safe-area-inset-top);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: calc(12px + var(--safe-top)) 16px 12px 16px;"""

new_header = """.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  padding-top: calc(12px + env(safe-area-inset-top));"""

css = css.replace(old_header, new_header)

# Wait, what about header.app-header?
css = css.replace("""header.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: calc(12px + var(--safe-top)) 16px 12px 16px;""", """header.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  padding-top: calc(12px + env(safe-area-inset-top));""")

with open("apps/mobile/src/styles.css", "w") as f:
    f.write(css)
