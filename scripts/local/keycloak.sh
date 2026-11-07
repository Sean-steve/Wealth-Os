#!/usr/bin/env bash
# Run the identity-only Keycloak container as the owner of private local files.
# PostgreSQL is deliberately NOT a Docker service.
set -euo pipefail
cd "$(dirname "$0")/../.."
if [ ! -f .local/wealth-os/keycloak/admin.env ] || [ ! -f .local/wealth-os/keycloak/realm.json ]; then
 echo 'LOCAL_IDENTITY_BLOCKED: run python3 scripts/local/setup.py first.' >&2
 exit 2
fi
export WEALTH_LOCAL_UID="$(id -u)"
export WEALTH_LOCAL_GID="$(id -g)"
exec docker compose -f deploy/local/identity.compose.yaml "$@"
