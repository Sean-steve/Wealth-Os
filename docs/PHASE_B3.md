# Wealth OS — Phase B3: Provider Proof, Source Evidence & Staging Release

**Status:** Code-delivered / CI-certifiable. **NOT live-staging-activated unless protected staging deployment completes with a real host and provisioned provider accounts.** A repository URL and successful Keycloak CI run are not production identity or financial-source connectivity.

## 1. Authority survey (31 October 2026)

| Source | Verified repository interface | Authority gap | B3 action |
|---|---|---|---|
| Personal Kernel | `Sean-steve/humankernelos` platform ownership and engine life-cycle contracts | No production Kernel-owned issuer/federated verified person binding available | Require issuer-signed subject, active tenant identity binding, MFA ACR with fresh auth, verified email, and consent; no auto-enrollment |
| Finance OS | `Sean-steve/Finance-Os` backend/openapi/finance-os.v1.json; B1 accounts `balanceQuality=MANUAL_RECORD` | No live reconciled verified Finance-to-Wealth snapshot publisher endpoint | Require Finance reconciliation reference for VERIFIED balances, liabilities and classifications; manual totals remain unverified |
| Asset OS | `Sean-steve/Asset-Os` /v1/assets + ownership/valuation contracts; event transport NOT_CONFIGURED | Asset registry value does not prove user economic ownership or approved valuation | Require independent ownership and accepted valuation references before marking VERIFIED |
| Company OS | No verified source publisher/service endpoint in scoped repos | Equity/financial statement authority unresolved | No activation until signed publisher, equity register and reviewed financial statement contract |
| Wealth OS | B2 producer-bound signed snapshot endpoint, RLS, outbox and watermark receipt | No remote external producer credentials, protected staging infrastructure or OIDC MFA assertions provided | Add source-evidence policy, genuine ephemeral Keycloak proof, staging runtime & preflight |

### Meaning of "provider activation" in B3

**Certified in CI:** An *actual* disposable Keycloak 26.8.1 issuer signs a short-lived user JWT and a separate short-lived service JWT. The B3 test validates OIDC discovery, JWKS signature verification by the real Wealth verifier, PKCE-S256 advertised by the issuer, dedicated human and source API audiences, scope checks, rejection of invalid JWTs, wrong audience and cross-audience tokens, plus a required OTP-enrollment user whose password-only login cannot succeed. The CI realm/test credentials are disposable, loopback-only and checked into source **solely for protocol verification**.

**NOT certified:** Real human TOTP/WebAuthn success, a deployed MFA authentication flow, production issuer, production HTTPS routing, user lifecycle/recovery, OIDC credential renewal, production source publishers or cross-OS data transfers. The provider smoke does **not** connect to HumanKernelOS or the Finance OS/Asset OS/Company OS running services.

### Strict MFA assurance for staging

`RUNTIME_MODE=staging` or `production` refuses to start without:
- a real HTTPS pinned OIDC issuer + JWKS + API audience for humans;
- `OIDC_REQUIRED_ACR` **set to a real issuer-proven MFA flow mapping**, `OIDC_REQUIRE_VERIFIED_EMAIL=true`, and `OIDC_MAX_AUTH_AGE_SECONDS` (default 900 seconds);
- a separate HTTPS signed source-service issuer/audience/JWKS, and `WEALTH_INGEST_DATABASE_URL` for a non-superuser restricted role.

Protected user operations validate JWT signature and claims, required ACR, verified email and fresh `auth_time` before active issuer-bound Kernel subject binding and tenant membership. Simply setting an ACR string **does not prove MFA**: the operator must test successful MFA enrollment and challenge, blocked password-only access, auth freshness, revocation, signing-key rotation and account recovery on the actual staging identity provider before declaring it active.

### Strict authoritative evidence

Staging source ingestion (`strictEvidence=true`) now requires:
- **Finance OS:** a reconciliation proof ref for every VERIFIED cash/investment holding and each debt. Finance capital classification requires complete source-attested snapshot and source reference.
- **Asset OS:** both `ownershipProofRef` and `approvedValuationRef` for a VERIFIED asset. Registry value or self-asserted beneficial ownership is not enough.
- **Company OS:** `equityRegisterRef` and `reviewedStatementRef` for a VERIFIED business-equity holding.
- **Income:** `incomeStatementRef` for all sources.

These are references to evidence held by authoritative providers, not copies of customer documents. They must represent real reviewed proof: a fabricated reference is not verified just because it passes a string-pattern check. The actual providers must sign source snapshots using an administrator-provisioned source service identity; the API retains tenant/person/consent/producer binding, event replay, canonical economic-asset conflict and revocation guards.

An insufficiently evidenced VERIFIED label is rejected with 422. Source records with `qualityStatus=UNVERIFIED` can be retained for inspection, but Wealth OS returns **null net-worth** until every required holding is verified and the three source snapshots and consents are current.

## 2. Staging topology and deployment

Staging architecture:

```
Protected GitHub "wealth-staging" workflow (manual)
 -> pinned SSH host verification -> sync reviewed main commit
 -> build staging container
 -> run checksumed forward-only migrations using MIGRATOR role
 -> restart non-root Wealth API using APP and INGEST roles
 -> Caddy TLS reverse proxy :443 -> API port 3009 private bridge
 -> /ready schema and Postgres evidence -> live endpoint preflight/UAT
```

The repository provides:
- `deploy/staging/Dockerfile`: Node 22 non-root API container, TypeScript compiled to JavaScript with separate build config and only production dependencies in runtime.
- `deploy/staging/compose.yaml`: no exposed Postgres/API port; private Docker bridge; read-only app container, dropped Linux capabilities, limited resources, TLS Caddy. **Requires an existing external PostgreSQL service and strong separate passwords.**
- `deploy/staging/Caddyfile`: HTTPS TLS termination; same host readiness at `/ready` and no direct raw API port exposure.
- `deploy/staging/deploy.sh`: checks protected config file permissions, real domain and SHA; builds image by SHA, migrates before activation, smoke-tests HTTPS and attempts **app-image-only** rollback on failure. Database migrations are *never automatically reversed*.
- `.github/workflows/wealth-staging.yml`: **workflow_dispatch only**, requires environment `wealth-staging`, protected SSH host/user/private key/pinned known_hosts. Does not automatically deploy on `main`.
- `apps/api/scripts/stagingPreflight.ts`: real HTTPS OIDC discovery/JWKS + code/PKCE support and source API readiness probe. Fails closed for missing/placeholder endpoints. Probe success proves only transport/metadata reachability, **not authenticated financial ownership or MFA**.

### Operator-controlled prerequisites

1. Provision a **dedicated** staging host and DNS name (not the unrelated Deetoo Rush or OrchidHR stacks), managed/isolated PostgreSQL with separate limited application/ingest accounts plus a privileged migration account, backup+restore, firewall 80/443 only, hardening and alerting. No actual host was created by this phase.
2. Install Docker/Compose, allow a restricted deployment user to write `/srv/wealth-os/staging/source` and operate only the staging compose project. Ensure `/etc/wealth-os/staging/` exists with owner-controlled `chmod 600` `api.env` and `migrator.env`, and `deployment.env` (mode 600). **Never copy the repository's local development password template to staging.**
3. `api.env` must include `WEALTH_APP_DATABASE_URL`, `WEALTH_INGEST_DATABASE_URL`, `OIDC_ISSUER`, `OIDC_JWKS_URL`, `OIDC_AUDIENCE`, `OIDC_REQUIRED_ACR`, `OIDC_REQUIRE_VERIFIED_EMAIL=true`, `OIDC_MAX_AUTH_AGE_SECONDS`, `INTEGRATION_OIDC_ISSUER`, `INTEGRATION_OIDC_JWKS_URL`, `INTEGRATION_OIDC_AUDIENCE`, `CORS_ALLOWED_ORIGINS`. `migrator.env` must contain only `WEALTH_MIGRATOR_DATABASE_URL`. `deployment.env` contains real `STAGING_DOMAIN` and `STAGING_ACME_EMAIL`.
4. In repository Settings > Environments, protect environment **wealth-staging** using reviewers, deployment restrictions and private secrets `STAGING_HOST`, `STAGING_USER`, `STAGING_SSH_KEY`, `STAGING_KNOWN_HOSTS`. Verify known_hosts via trusted host fingerprints, **not** blind ssh-keyscan in a pipeline.
5. Provision a real identity issuer and public PKCE SPA client with correct redirect URI and scopes; prove the MFA ACR mapping against authentic enrolled challenge. Admin-provision approved Kernel identity bindings, consent grants and source_grants.
6. Configure provider source publishers to generate evidence-complete, source-owned KES snapshots signed by registered service identities. Do **not** treat manually entered Finance OS balances, Asset OS registry prices or a hypothetical Company valuation as verified.
7. Manually trigger **Wealth OS — Protected Staging Deployment** on reviewed `main`. It will reject missing SSH secrets; deploy script rejects missing protected server env files. Check HTTPS `/health`, `/ready`, ingress logs and event/audit receipts.
8. Run real provider preflight with `npm run staging:preflight --prefix apps/api` and set `STAGING_API_URL`, `FINANCE_OS_API_URL`, `ASSET_OS_API_URL`, `COMPANY_OS_API_URL`, `OIDC_ISSUER`/JWKS and integration issuer/JWKS in the **operator terminal only**. Then perform full proof: MFA/enrollment/recovery, signed producer service tokens, cross-tenant rejection, consent revoke, exact replay, incomplete snapshot rejection, ownership conflicts, source freshness and restore testing.

## 3. Development and CI certification gates

| Gate | Evidence |
|---|---|
| PostgreSQL | Migrations through `005_staging_readiness.sql` applied twice; role grants and real B0/B1/B2 tests |
| Authorization | Existing JWT/JWKS verification + new ACR/fresh `auth_time` and verified-email policy unit tests |
| Source evidence | Real source-contract gap matrix and provenance enforcement unit tests |
| Provider protocol | Disposable real Keycloak CI workflow; separate JWT audiences and service scope, PKCE, required OTP action deny |
| Deployment | Compiled non-root container build, migration-only role, manifest, protected SSH staging workflow |
| Preflight | Without real HTTPS endpoints: **BLOCKED**, not fabricated green readiness |
| Frontend | Existing 22-route sample/connected authority switch retained, frontend unit+browser tests and GitHub Pages build |

## 4. Blockers and next phase

**Open external gates:** operator-provisioned stage host, domain, GitHub environment secrets, dedicated HTTPS OIDC issuer + real MFA, real identity enrollment and verified Kernel bindings, signed Finance/Asset/Company publishers, source-side verified ownership/valuations, lifecycle/retention controls, operational observability, backups, DPIA and live E2E UAT.

Do **not** call the API "live," provider "activated," or user wealth "verified" until these actual dependencies and the relevant certification evidence exist. The GitHub Pages frontend is still a secure *unconfigured* Connected mode; sample mode is labeled fictional.

**Next suggested phase:** **B3.1 — Operator Infrastructure Provisioning & Real Cross-OS Staging Acceptance** (requires explicit operator-controlled host/IdP/provider credentials). After that, B4 full intelligence/report read models and financial policy certification.
