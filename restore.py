import re

with open("apps/mobile/public/styles.css", "r") as f:
    css = f.read()

# Restore root variables
css = css.replace("--background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%);", "--background: #0D1117;")
css = css.replace("--surface: rgba(30, 41, 59, 0.4);", "--surface: #161B22;")
css = css.replace("--surface-border: rgba(255, 255, 255, 0.1);", "--surface-border: #30363D;")
css = css.replace("--user-bubble: rgba(255, 255, 255, 0.1);", "--user-bubble: #1F2937;")
css = css.replace("--user-bubble-border: rgba(255, 255, 255, 0.1);", "--user-bubble-border: #374151;")

# Restore background on body
css = re.sub(r'background: var\(--background\);', 'background-color: var(--background);', css)

# Remove backdrop filter from app-container
css = re.sub(r'(\#app-container \{[^\}]+?)\n  backdrop-filter: blur\(20px\);\n  -webkit-backdrop-filter: blur\(20px\);\n\}', r'\1\n}', css)

# Restore header and input bar
css = css.replace("background: var(--surface);\n  backdrop-filter: blur(15px);\n  -webkit-backdrop-filter: blur(15px);", "background-color: var(--surface);")

# Update header-right gap
css = css.replace(".header-right {\n  display: flex;\n  align-items: center;\n  gap: 12px;\n}", ".header-right {\n  display: flex;\n  align-items: center;\n  gap: 8px;\n}")

# Restore status pill (this might be messy if I changed it a lot, let's see)
css = css.replace(".status-pill {\n  display: inline-flex;\n  align-items: center;\n  justify-content: center;\n  width: 12px;\n  height: 12px;\n  padding: 0;\n  border-radius: 50%;\n  border: none;\n  background: transparent;", ".status-pill {\n  display: inline-flex;\n  align-items: center;\n  gap: 6px;\n  padding: 4px 10px;")
css = css.replace(".status-pill .indicator-dot {\n  width: 10px;\n  height: 10px;", ".status-pill .indicator-dot {\n  width: 7px;\n  height: 7px;")

# Remove Liquid Blobs Background
css = css.split("/* Liquid Blobs Background */")[0]

with open("apps/mobile/public/styles.css", "w") as f:
    f.write(css)
