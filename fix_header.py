import re

with open("apps/mobile/public/index.html", "r") as f:
    html = f.read()

header_right = """      <div class="header-right">
        <button id="clear-chat-btn" class="icon-btn" title="Clear Chat">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
        <button id="settings-btn" class="icon-btn" title="Menu">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="5" r="1.5"></circle>
            <circle cx="12" cy="12" r="1.5"></circle>
            <circle cx="12" cy="19" r="1.5"></circle>
          </svg>
        </button>
      </div>"""

html = re.sub(r'      <div class="header-right">\s*</div>', header_right, html)

# Add a debug overlay div at the end before </div>
debug_overlay = """
    <!-- Mobile Debug Overlay -->
    <div id="debug-overlay" style="display:none; position:absolute; top:0; left:0; width:100%; height:50%; background:rgba(0,0,0,0.8); color:#0f0; font-family:monospace; font-size:10px; z-index:9999; overflow-y:scroll; padding:10px; pointer-events:none;"></div>
"""

html = html.replace('  </div>\n\n  <!-- PWA Logic -->', debug_overlay + '\n  </div>\n\n  <!-- PWA Logic -->')

with open("apps/mobile/public/index.html", "w") as f:
    f.write(html)
