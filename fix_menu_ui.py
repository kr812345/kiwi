import re

with open("apps/mobile/public/index.html", "r") as f:
    html = f.read()

# Replace header right with dropdown
new_header = """      <div class="header-right" style="position:relative;">
        <button id="menu-btn" class="icon-btn" title="Menu">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="5" r="1.5"></circle>
            <circle cx="12" cy="12" r="1.5"></circle>
            <circle cx="12" cy="19" r="1.5"></circle>
          </svg>
        </button>
        <!-- Dropdown Menu -->
        <div id="dropdown-menu" style="display:none; position:absolute; right:0; top:40px; background:#161b22; border:1px solid #30363d; border-radius:8px; padding:8px; z-index:100; min-width:150px; box-shadow:0 4px 12px rgba(0,0,0,0.5);">
          <button id="menu-clear-chat" style="display:block; width:100%; text-align:left; background:none; border:none; color:#c9d1d9; padding:10px; cursor:pointer; font-size:14px; border-bottom:1px solid #30363d;">🗑️ Clear Chat</button>
          <button id="menu-theme-toggle" style="display:block; width:100%; text-align:left; background:none; border:none; color:#c9d1d9; padding:10px; cursor:pointer; font-size:14px;">🎨 Toggle Theme</button>
        </div>
      </div>"""

# Remove old header right
html = re.sub(r'      <div class="header-right">.*?</div>\n', new_header + '\n', html, flags=re.DOTALL)

with open("apps/mobile/public/index.html", "w") as f:
    f.write(html)
