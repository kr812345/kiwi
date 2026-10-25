#!/bin/bash
# Create the vault key outside Pip's workspace. The brain never gets this file.
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Run this as root." >&2
  exit 1
fi

if ! id pip >/dev/null 2>&1; then
  useradd --create-home --shell /bin/bash pip
fi

install -d -m 0700 -o root -g root /etc/pip
install -d -m 0750 -o pip -g pip /var/lib/pip
install -d -m 0750 -o pip -g pip /home/pip/work

if [ ! -f /etc/pip/vault.key ]; then
  umask 077
  head -c 32 /dev/urandom > /etc/pip/vault.key
  chown root:root /etc/pip/vault.key
  chmod 600 /etc/pip/vault.key
fi

if [ ! -f /var/lib/pip/vault.json ]; then
  echo '{"entries":{},"audit":[],"approvals":{}}' > /var/lib/pip/vault.json
  chown pip:pip /var/lib/pip/vault.json
  chmod 600 /var/lib/pip/vault.json
fi

echo "Vault key is /etc/pip/vault.key. Start pip-vault.service so Pip talks to the helper socket."
