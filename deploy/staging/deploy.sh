#!/usr/bin/env bash
# Staging-only controlled deploy; migration is deliberately forward-only.
set -euo pipefail
sha="${1:?A reviewed main commit SHA is required}"
if ! [[ "$sha" =~ ^[a-f0-9]{40}$ ]]; then echo "Invalid commit SHA"; exit 2; fi
cd /srv/wealth-os/staging/source
staging=/etc/wealth-os/staging
for file in "$staging/api.env" "$staging/migrator.env" "$staging/deployment.env"; do
 if [ ! -r "$file" ]; then echo "Missing protected staging configuration: $file"; exit 2; fi
 if [ $((8#$(stat -c %a "$file") & 8#077)) -ne 0 ]; then
  echo "Staging secret file must not be readable by group or other: $file"; exit 2
 fi
done
set -a
# Deployment file holds only STAGING_DOMAIN + STAGING_ACME_EMAIL. No keys.
source "$staging/deployment.env"
set +a
if [[ ! "${STAGING_DOMAIN:-}" =~ ^[a-zA-Z0-9.-]+$ ]] ||
 [[ "$STAGING_DOMAIN" == *".example.test" ]] || [[ "$STAGING_DOMAIN" == *"localhost"* ]]; then
 echo "A real, controlled HTTPS staging domain is required"; exit 2
fi
export RELEASE_SHA="$sha"
compose=(docker compose --env-file "$staging/deployment.env" -f deploy/staging/compose.yaml)
# Before first activation, the operator must have installed and tested
# least-privilege DB roles, encrypted backups, DNS, IdP and firewall.
"${compose[@]}" build api
"${compose[@]}" --profile migration run --rm --no-deps migrate
previous=""
if [ -r "$staging/last_good_sha" ]; then previous="$(cat "$staging/last_good_sha")"; fi
"${compose[@]}" up -d --no-deps api
"${compose[@]}" up -d --no-deps caddy
healthy=0
for attempt in $(seq 1 20); do
 if curl --fail --silent --show-error --max-time 8 "https://$STAGING_DOMAIN/ready" >/dev/null 2>&1; then
  healthy=1; break
 fi
 sleep 3
done
if [ "$healthy" -ne 1 ]; then
 echo "STAGING NOT READY. A forward-only migration may require roll-forward rather than rollback."
 if [[ "$previous" =~ ^[a-f0-9]{40}$ ]] && docker image inspect "wealth-os-api:$previous" >/dev/null 2>&1; then
  echo "Attempting app-image-only rollback to last good image (no DB rollback)."
  RELEASE_SHA="$previous" "${compose[@]}" up -d --no-deps api
 fi
 exit 1
fi
printf "%s\n" "$sha" > "$staging/last_good_sha"
chmod 600 "$staging/last_good_sha"
echo "STAGING HTTPS READINESS PASSED for reviewed commit $sha (provider source integration still requires separate UAT)"
