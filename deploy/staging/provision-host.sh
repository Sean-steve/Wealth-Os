#!/usr/bin/env bash
# B3.1: Run ON A DEDICATED STAGING VM as root, passing an existing non-root deploy username.
# This is a NON-DESTRUCTIVE directory bootstrap, not remote server provisioning.
set -euo pipefail
if (( EUID != 0 )); then echo 'BLOCKED: host bootstrap requires root on the dedicated VM.' >&2; exit 2; fi
user="${1:-}"
if ! [[ "$user" =~ ^[a-z_][a-z0-9_-]{1,31}$ ]] || [[ "$user" == "root" ]]; then
 echo 'Usage: sudo bash deploy/staging/provision-host.sh EXISTING_NONROOT_DEPLOY_USER' >&2; exit 2
fi
if ! id "$user" >/dev/null 2>&1; then echo 'BLOCKED: create/review an unprivileged deploy user first.' >&2; exit 2; fi
if [[ -f /etc/hostname ]] && grep -Eiq 'deetoo|orchidhr' /etc/hostname; then
 echo 'BLOCKED: do not bootstrap Wealth staging on a server identified as another application.' >&2; exit 2
fi
if ! command -v docker >/dev/null 2>&1 || ! docker compose version >/dev/null 2>&1; then
 echo 'BLOCKED: operator must install and harden Docker Engine + Compose first.' >&2; exit 2
fi
if ! command -v curl >/dev/null 2>&1; then
 echo 'BLOCKED: curl is required for HTTPS readiness checks.' >&2; exit 2
fi
if [[ -e /srv/wealth-os/staging/source && -L /srv/wealth-os/staging/source ]] ||
   [[ -e /etc/wealth-os/staging && -L /etc/wealth-os/staging ]]; then
 echo 'BLOCKED: refusing to traverse staging symlinks.' >&2; exit 2
fi
primary_group="$(id -gn "$user")"
install -d -m 0755 -o root -g root /etc/wealth-os
install -d -m 0700 -o "$user" -g "$primary_group" /etc/wealth-os/staging
install -d -m 0755 -o root -g root /srv/wealth-os
install -d -m 0755 -o root -g root /srv/wealth-os/staging
install -d -m 0700 -o "$user" -g "$primary_group" /srv/wealth-os/staging/source
for f in api.env migrator.env deployment.env; do
 if [[ -e "/etc/wealth-os/staging/$f" ]]; then
  echo "PRESERVED existing staging configuration $f (not overwritten)"
 else
  echo "MISSING secret file: /etc/wealth-os/staging/$f (operator must provide with mode 600)"
 fi
done
if ! command -v runuser >/dev/null 2>&1 ||
   ! runuser -u "$user" -- docker info >/dev/null 2>&1; then
 echo 'BLOCKED: deploy user cannot use Docker. Review dedicated-host isolation before granting Docker privileges.' >&2; exit 2
fi
echo 'DIRECTORY_BOOTSTRAP_COMPLETE (NOT DEPLOYED, NOT PROVIDERS_ACTIVATED)'
echo 'Next: protected env files, externally hosted PostgreSQL roles, backup test, DNS/TLS, GitHub protected environment, publisher identities.'
echo 'Do not reuse an unrelated production VPS; Docker socket access is effectively root-level.'
