with open("apps/mobile/src/app.js", "r") as f:
    js = f.read()

features_js = """
  // --- MOBILE DEBUG & FEATURES ---
  const debugOverlay = document.getElementById('debug-overlay');
  let tapCount = 0;
  let tapTimer = null;
  const avatarFace = document.querySelector('.avatar-face');
  
  if (avatarFace) {
    avatarFace.addEventListener('click', () => {
      tapCount++;
      clearTimeout(tapTimer);
      tapTimer = setTimeout(() => { tapCount = 0; }, 500);
      if (tapCount >= 5) {
        if (debugOverlay) {
          debugOverlay.style.display = debugOverlay.style.display === 'none' ? 'block' : 'none';
        }
        tapCount = 0;
      }
    });
  }

  const oldLog = console.log;
  const oldErr = console.error;
  function addDebugMsg(msg) {
    if (debugOverlay) {
      const div = document.createElement('div');
      div.textContent = msg;
      debugOverlay.appendChild(div);
      debugOverlay.scrollTop = debugOverlay.scrollHeight;
    }
  }
  console.log = function(...args) {
    oldLog(...args);
    addDebugMsg(args.join(' '));
  };
  console.error = function(...args) {
    oldErr(...args);
    addDebugMsg('[ERROR] ' + args.join(' '));
  };

  let startY = 0;
  document.addEventListener('touchstart', e => {
    if (window.scrollY === 0) {
      startY = e.touches[0].clientY;
    }
  }, {passive: true});
  
  document.addEventListener('touchend', e => {
    if (window.scrollY === 0 && startY > 0) {
      const endY = e.changedTouches[0].clientY;
      if (endY - startY > 150) { 
        console.log("Pull to refresh triggered");
        window.location.reload();
      }
    }
    startY = 0;
  });

  const menuBtn = document.getElementById('menu-btn');
  const dropdownMenu = document.getElementById('dropdown-menu');
  const menuClearChat = document.getElementById('menu-clear-chat');
  const menuThemeToggle = document.getElementById('menu-theme-toggle');

  if (menuBtn) {
    menuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (dropdownMenu) {
        dropdownMenu.style.display = dropdownMenu.style.display === 'none' ? 'block' : 'none';
      }
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

# Insert before the last})();
js = js.replace("})();", features_js + "\n})();")

with open("apps/mobile/src/app.js", "w") as f:
    f.write(js)
