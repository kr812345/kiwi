import re

with open("apps/mobile/public/styles.css", "r") as f:
    css = f.read()

# Update root variables
css = css.replace("--background: #0D1117;", "--background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%);")
css = css.replace("--surface: #161B22;", "--surface: rgba(30, 41, 59, 0.4);")
css = css.replace("--surface-border: #30363D;", "--surface-border: rgba(255, 255, 255, 0.1);")
css = css.replace("--user-bubble: #1F2937;", "--user-bubble: rgba(255, 255, 255, 0.1);")
css = css.replace("--user-bubble-border: #374151;", "--user-bubble-border: rgba(255, 255, 255, 0.1);")

# Update background on body
css = re.sub(r'background-color: var\(--background\);', 'background: var(--background);', css)

# Update app-container
css = re.sub(r'(\#app-container \{[^}]+)\}s*', r'\1\n  backdrop-filter: blur(20px);\n  -webkit-backdrop-filter: blur(20px);\n}\n', css)

# Update header and input bar for glassmorphism
css = css.replace("background-color: var(--surface);", "background: var(--surface);\n  backdrop-filter: blur(15px);\n  -webkit-backdrop-filter: blur(15px);")

# Update header-right to layout status pill correctly
css = css.replace(".header-right {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n}", ".header-right {\n  display: flex;\n  align-items: center;\n  gap: 12px;\n}")

# Update status pill for new header placement
css = css.replace(".status-pill {\n  display: inline-flex;\n  align-items: center;\n  gap: 6px;\n  padding: 4px 10px;", ".status-pill {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  width: 12px;\n  height: 12px;\n  padding: 0;\n  border-radius: 50%;\n  border: none;\n  background: transparent;")
css = css.replace(".status-pill .indicator-dot {\n  width: 7px;\n  height: 7px;", ".status-pill .indicator-dot {\n  width: 10px;\n  height: 10px;")

with open("apps/mobile/public/styles.css", "w") as f:
    f.write(css)
