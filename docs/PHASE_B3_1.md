# Wealth OS — Phase B3.1: Staging Provisioning & Real Provider Activation

**Outcome required:** A dedicated HTTPS staging API with isolated PostgreSQL, a real externally verified OIDC issuer, independently signed Finance/Asset/Company source snapshots, consent and issuer-bound Personal Kernel identity, and a live signed test-tenant certification. **The repository does not contain real staging DNS, SSH access, IdP administration, or provider service credentials. No server has been provisioned by merely merging this code.**

## Starting evidence
At B3 baseline `9bc91bc40fc4aed52b81f6a0cba093b5c8afd1c4`, 40/40 backend tests, the disposable real-Keycloak protocol job and frontend/Pages workflows passed. This proves application and disposable-provider protocol behavior **only**. A local CI Keycloak realm is not a deployed provider. No verified production/staging Finance OS, Asset OS, Company OS or HumanKernelOS federation endpoint is available in the connected repository context.

## 1. Dedicated staging host bootstrap
**Do not use the Deetoo Rush/OrchidHR VPS.** Provision a dedicated VM or an equivalently isolated production-grade environment with a DNS hostname, Ubuntu LTS, SSH key login, 80/443 public only, Docker Engine + Compose, tested offsite encrypted PostgreSQL backups/restore, managed secrets and monitoring. Use a dedicated deploy user whose Docker socket access has been consciously risk accepted (Docker socket is effectively root).

Run on the *new* VM, after operator-controlled Docker installation and firewall hardening:

```bash
sudo bash deploy/staging/provision-host.sh wealthdeploy
```

The bootstrap creates locked directories `/srv/wealth-os/staging/source` and `/etc/wealth-os/staging`, preserves any existing env files, and does **not** create users, install insecure software, grant Docker access, change firewall policy, or invent DNS/provider credentials. It intentionally **fails** if Docker is missing, the deploy account lacks authority, the machine identifies as an unrelated stack, or a sensitive staging path is a symlink.

Create and protect 3 files as the dedicated deployment user (**not checked into Git**):

- `/etc/wealth-os/staging/api.env` — `RUNTIME_MODE=staging`, `WEALTH_APP_DATABASE_URL`, `WEALTH_INGEST_DATABASE_URL`, `OIDC_ISSUER`, `OIDC_JWKS_URL`, `OIDC_AUDIENCE`, `OIDC_REQUIRED_ACR`, `OIDC_REQUIRE_VERIFIED_EMAIL=true`, `OIDC_MAX_AUTH_AGE_SECONDS=900`, `INTEGRATION_OIDC_ISSUER`, `INTEGRATION_OIDC_JWKS_URL`, `INTEGRATION_OIDC_AUDIENCE`, `CORS_ALLOWED_ORIGINS`.
- `/etc/wealth-os/staging/migrator.env` — `WEALTH_MIGRATOR_DATABASE_URL` only; privileged migrator connection must not be reused by the app.
- `/etc/wealth-os/staging/deployment.env` — `STAGING_DOMAIN`, `STAGING_ACME_EMAIL`. DNS must resolve to the dedicated VM.

Each file must be owned by the deployment account, `chmod 600`, and readable by no other principal. Database roles `wealth_app`, `wealth_ingest`, and migrator **must have distinct strong secrets**. Protect PostgreSQL behind private addressing, mTLS/VPN or provider network policies; never expose it publicly. Do not reuse `apps/api/.env.example` development passwords.

## 2. Protected GitHub staging deployment
Configure repository **Settings → Environments → wealth-staging** with reviewers/restrictions to `main`. Store *only* SSH deployment secrets in this environment: `STAGING_HOST`, `STAGING_USER`, `STAGING_SSH_KEY`, `STAGING_KNOWN_HOSTS`. Establish `STAGING_KNOWN_HOSTS` from a trusted out-of-band verified SSH host fingerprint; do not auto-trust an unsigned network scan.

`.github/workflows/wealth-staging.yml` is `workflow_dispatch` only. B3.1 hardens it to reject non-current-main SHA, and requires three **successful** workflows on the same exact commit: backend PostgreSQL/source evidence, disposable Keycloak protocol, and full Pages/browser checks. It then enforces protected credentials, pinned SSH host verification, migration-first deployment, HTTPS readiness and app-only rollback. Migrations are forward-only.

Actual deployment still requires a person to provision the VM and GitHub environment secrets and manually trigger the action. It cannot succeed if any of those are absent.

## 3. Identity and human authority activation
On the real staging issuer, verify using **actual enrollment and MFA challenge**:
- Authorization Code + PKCE S256 for the public SPA client; exact registered redirect.
- User access JWT `sub`, `iss`, audience `wealth-os-api`, `wealth:read`/`wealth:write`, verified email, fresh `auth_time`, and *provider-proven* MFA `acr`.
- Service access JWT from an independent credentials flow for audience `wealth-os-source-ingest`, `wealth:ingest` scope and a maximum age of five minutes.
- Block password-only bypass, wrong audience, revoked identity/consent, expired tokens, and stale authentication. Test successful OTP/WebAuthn, signing-key rotation and account recovery with the actual staging IdP (CI's simulated OTP-required denial is insufficient).

A trusted Kernel admin must provision `wealth_auth.tenant_memberships` and `wealth_auth.identity_bindings` with audit/proof references. B3/B3.1 deliberately **do not** auto-authorize a user merely because an OIDC JWT verifies. Register source-specific consent grants and `wealth_integration.source_grants` with producer issuer+subject, canonical person reference and proof. Do **not** install a fake HumanKernel integration.

## 4. Provider activation — contract and source proof
Finance OS must publish independently reconciled cash, investment, debt and classification evidence; Asset OS must attest actual beneficial ownership and accepted valuations; Company OS must attest equity register and reviewed statements. Each source publisher must be deployed and hold its own short-lived service credentials. Signed snapshots must be source-authoritative, evidence-complete and KES-only (until governed FX conversion is implemented). Unverified source values must never be upgraded to verified wealth.

The gateway expects a **full source snapshot envelope**, not an arbitrary JSON copy of each source REST response. Source providers must implement and test the mapping, count, source revision, unique canonical economic asset, ownership proof and consent semantics against their actual domains.

### B3.1 live signed staging test
`apps/api/scripts/liveActivation.ts` is an **operator-only, deliberately state-changing** integration proof. It must run solely for a specifically isolated/empty/authorized staging test tenant. It requires fresh short-lived signed human and all three producer JWTs in process environment, exact HTTPS issuer/JWKS/audience for humans and source identities, three source-owned complete JSON snapshots in a restricted local folder **outside the repository**, and two explicit safety flags.

Required environment variables (values must be supplied via a secure runtime mechanism, not GitHub issues, chat or repository files):
```
STAGING_API_URL
STAGING_TEST_TENANT_ID
STAGING_TEST_HUMAN_TOKEN
OIDC_ISSUER
OIDC_JWKS_URL
OIDC_AUDIENCE
OIDC_REQUIRED_ACR
INTEGRATION_OIDC_ISSUER
INTEGRATION_OIDC_JWKS_URL
INTEGRATION_OIDC_AUDIENCE
STAGING_FINANCE_SERVICE_TOKEN
STAGING_ASSET_SERVICE_TOKEN
STAGING_COMPANY_SERVICE_TOKEN
STAGING_FINANCE_SNAPSHOT_FILE
STAGING_ASSET_SNAPSHOT_FILE
STAGING_COMPANY_SNAPSHOT_FILE
WEALTH_TEST_TENANT_ISOLATED=yes
WEALTH_ACTIVATION_APPLY_SNAPSHOTS=yes
```

**Run:** `npm run staging:activation:prove --prefix apps/api` after loading the ephemeral environment. This script:
1. Verifies real JWT signatures against live JWKS, issuer, audience, expiration, token scopes, human MFA ACR/email/auth freshness and separate source token scopes.
2. Requires HTTPS `/ready` at B3 migration version, authorized human API access, and rejects missing human token, producer-as-human, and wrong-tenant requests.
3. Validates *all three* complete signed source-owned snapshot fixtures before any mutation.
4. Posts them to the real staging source gateway using each producer token, tests idempotent exact replay, and demands current consented receipt status for every source.
5. Requires a complete reconciled wealth projection and explicitly disabled financial execution.
6. Prints a sanitized **STAGING_TEST_TENANT_CERTIFIED** report. It does **not** output bearer tokens, user identities, financial amounts or source documents.

The test **does not prove the provider legally owns the underlying assets, that paper evidence is authentic, or that production HumanKernelOS is federated**. Complete that review separately and obtain signoff before using real persons' data.

### Explicit block behavior
With missing issuer/endpoints/tokens or approval flags the script MUST exit nonzero. The backend CI runs this negative gate on every relevant change; missing provider access must never be reclassified as success. Keep live signed token tests **manual** until workload-federated ephemeral token minting is available. Do not store short-lived JWTs as long-term GitHub Secrets.

## 5. Release outcome checklist and unfulfilled dependencies
The B3.1 release can certify *code readiness*, safe host bootstrap and negative activation gates in CI. Declaring external production/staging integration **ACTIVE** requires independent evidence for:
1. Dedicated VM, DNS, TLS, firewall, encrypted PostgreSQL, restore drill, alerting, protected deployment and positive HTTPS readiness.
2. Real staging OIDC / MFA success, account recovery, active kernel person binding and separate signed service JWT issuer.
3. Deployed Finance, Asset and Company producers with versioned signed source payloads, evidence verification, same-source replay and cross-source duplicate protection.
4. Successful **operator-only** signed test-tenant activation proof, cross-tenant rejection, consent revocation and reconciliation audits.
5. Operator approval of source ownership and privacy/data lifecycle; a successful test is not permission to move funds.

**Until those exist: B3.1 is CODE/PIPELINE-READY, but LIVE STAGING & SOURCE ACTIVATION is BLOCKED.** Next delivery after external setup is actual staging run and recorded multi-OS UAT.
