import re

with open("apps/mobile/src/app.js", "r") as f:
    js = f.read()

# Add logic for pull to refresh, debugging, and clear chat
additions = """
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
        debugOverlay.style.display = debugOverlay.style.display === 'none' ? 'block' : 'none';
        tapCount = 0;
      }
    });
  }

  // Hijack console
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

  // Pull to refresh
  let startY = 0;
  document.addEventListener('touchstart', e => {
    if (window.scrollY === 0) {
      startY = e.touches[0].clientY;
    }
  }, {passive: true});
  
  document.addEventListener('touchend', e => {
    if (window.scrollY === 0 && startY > 0) {
      const endY = e.changedTouches[0].clientY;
      if (endY - startY > 150) { // swipe down
        console.log("Pull to refresh triggered");
        window.location.reload();
      }
    }
    startY = 0;
  });

  // Re-bind Clear Chat
  const realClearChatBtn = document.getElementById('clear-chat-btn');
  if (realClearChatBtn) {
    realClearChatBtn.addEventListener('click', () => {
      if (confirm('Clear chat history?')) {
        chatMessages.innerHTML = '';
      }
    });
  }
"""

js = js.replace("  // 1. Core Logic & Typing Animation", additions + "\n\n  // 1. Core Logic & Typing Animation")

with open("apps/mobile/src/app.js", "w") as f:
    f.write(js)
