with open("apps/mobile/src/styles.css", "r") as f:
    css = f.read()

# Replace height: 100vh with height: 100dvh and add overscroll behavior
css = css.replace("height: 100vh;", "height: 100dvh;\n  overscroll-behavior-y: none;")
css = css.replace("height: 100%;", "height: 100%;\n  overscroll-behavior-y: none;")

# Add safe areas to header
css = css.replace(".header {", ".header {\n  padding-top: env(safe-area-inset-top);")

# Add safe areas to chat input bar
css = css.replace(".chat-input-bar {", ".chat-input-bar {\n  padding-bottom: calc(16px + env(safe-area-inset-bottom));")

# Modify chat-input textarea to allow resizing
css = css.replace(".chat-input {\n  flex: 1;", ".chat-input {\n  flex: 1;\n  max-height: 120px;\n  min-height: 24px;\n  resize: none;\n  overflow-y: auto;")

with open("apps/mobile/src/styles.css", "w") as f:
    f.write(css)
