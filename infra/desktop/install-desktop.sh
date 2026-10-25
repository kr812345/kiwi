#!/bin/bash
# Prepare the VPS user, packages, and directories for Pip's desktop.
# Run as root on the machine that will host Pip. It does not touch other app users.
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Run this as root on the VPS." >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y xvfb openbox x11vnc websockify novnc ca-certificates curl
if ! command -v brave-browser >/dev/null 2>&1 && ! command -v google-chrome >/dev/null 2>&1; then
  curl -fsSL https://brave-browser-apt-release.s3.brave.com/brave-browser-archive-keyring.gpg \
    -o /usr/share/keyrings/brave-browser-archive-keyring.gpg
  echo "deb [signed-by=/usr/share/keyrings/brave-browser-archive-keyring.gpg] https://brave-browser-apt-release.s3.brave.com/ stable main" \
    > /etc/apt/sources.list.d/brave-browser-release.list
  apt-get update
  apt-get install -y brave-browser
fi

if ! id pip >/dev/null 2>&1; then
  useradd --create-home --shell /bin/bash pip
fi
install -d -m 0750 -o pip -g pip /home/pip/work
install -d -m 0750 -o pip -g pip /home/pip/.config/pip
install -d -m 0750 -o pip -g pip /var/lib/pip
install -d -m 0755 /opt/kiwi

chmod 755 /opt/kiwi/infra/desktop/pip-desktop.sh
echo "Desktop packages are in place. Enable pip-desktop.service after the repo is at /opt/kiwi."
