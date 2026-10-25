#!/bin/bash
# One Brave window on a virtual display, with noVNC on localhost:6080.
set -euo pipefail

export DISPLAY="${DISPLAY:-:99}"
BROWSER="${PIP_BROWSER:-}"
if [ -z "$BROWSER" ]; then
  if command -v brave-browser >/dev/null 2>&1; then
    BROWSER=brave-browser
  elif command -v brave >/dev/null 2>&1; then
    BROWSER=brave
  elif command -v google-chrome >/dev/null 2>&1; then
    BROWSER=google-chrome
  else
    echo "Brave or Chrome is not installed" >&2
    exit 1
  fi
fi

Xvfb "$DISPLAY" -screen 0 1280x800x24 >/tmp/pip-xvfb.log 2>&1 &
sleep 0.4
if command -v openbox >/dev/null 2>&1; then
  openbox >/tmp/pip-openbox.log 2>&1 &
fi

"$BROWSER" \
  --no-sandbox \
  --disable-dev-shm-usage \
  --user-data-dir="${HOME}/.config/pip-brave" \
  --remote-debugging-address=127.0.0.1 \
  --remote-debugging-port=9222 \
  --window-size=1280,800 \
  about:blank >/tmp/pip-brave.log 2>&1 &

if command -v x11vnc >/dev/null 2>&1; then
  x11vnc -display "$DISPLAY" -localhost -nopw -forever -shared -rfbport 5900 >/tmp/pip-x11vnc.log 2>&1 &
fi

WEB_ROOT="/usr/share/novnc"
if [ ! -d "$WEB_ROOT" ]; then
  WEB_ROOT="/usr/share/novnc"
fi

exec websockify --web "$WEB_ROOT" 127.0.0.1:6080 localhost:5900
