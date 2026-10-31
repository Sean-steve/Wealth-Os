# Wealth OS — Phase B2: Identity, Authoritative Integrations & Unified Frontend

**Release scope:** Signed-source gateway, auditable issuer-bound tenant identity, consent enforcement, transactional source read-model reconciliation, and unified UI authority mode. **No production identity issuer, Finance/Asset/Company running endpoints, source snapshot publisher, or real cross-OS delivery has been deployed or verified.** Development/compliance certification is not real financial certification.

## Cross-repository reconciliation (31 October 2026)
- Personal Kernel `Sean-steve/humankernelos`: `docs/PHASE_2_PLATFORM_FOUNDATION.md` and `docs/DOMAIN_OWNERSHIP.md` require persisted engine lifecycle, consent, permission and canonical user identity. Its runtime does not expose an available production OIDC issuer or verified Wealth OS external-engine installation.
- Finance OS `Sean-steve/Finance-Os`: `backend/openapi/finance-os.v1.json` documents read-only financial contracts, `docs/backend/OIDC_KEYCLOAK_ACTIVATION.md` explicitly reports provider smoke tests but **no production issuer/API/credentials**. Finance OS owns ledger, bank account balances and debt truth; Wealth OS does not directly query Finance OS tables.
- Asset OS `Sean-steve/Asset-Os`: `apps/api/openapi/events.json` declares `asset.valuation.accepted.v1`, `asset.updated.v1` and authoritative asset events with transport `NOT_CONFIGURED`. Asset OS confirms no connected production OIDC/API. Wealth OS must not interpret an asset record as personally owned wealth without ownership evidence.
- Company OS: no deployed verified producer contract was established during reconciliation. An abstract signed Company OS source contract is available, but not a live integration.

## B2 implementation

### Human identity (fail closed)
`wealth_auth.identity_bindings` stores a human identity mapping (tenant, trusted OIDC issuer, signed OIDC subject, canonical Personal Kernel person ref, administrative proof reference, active/revoked). Every user request verifies **all** of: JWT signature + issuer/audience/lifetime, scopes, active tenant membership, and active issuer-specific Kernel identity binding. Even a valid token and tenant UUID without verified binding receives `403 KERNEL_IDENTITY_UNBOUND`. Identity records are not auto-created from a login.

**Existing B0/B1 accounts need operator verification before they can access B2 APIs.** Migration 004 deliberately does not mark previously known subjects verified. Real Personal Kernel issuance/consent synchronization is a separate external launch gate.

### Source producer identity & access
The isolated `wealth_ingest` PostgreSQL role is never a superuser, cannot touch human-goal/strategy records, and is separate from `wealth_app` and migrator. A signed OIDC **service** JWT is required for `POST /api/v1/integrations/sources/:source/snapshots` with short token age, pinned `INTEGRATION_OIDC_ISSUER` + `INTEGRATION_OIDC_AUDIENCE` + JWKS, and `wealth:ingest` scope. Source service token subject and issuer must match an administrator-provisioned `wealth_integration.source_grants` row.

The request body must identify the exact approved `source_person_ref`. We verify its linked actively bound human subject, membership and effective subject-level `wealth.read` consent **inside the same tenant-scoped transaction**. Revocation blocks new writes. No browser origin is permitted to issue ingestion. The source must send one complete, attested, reconciled snapshot under a contract it owns. The API cannot pretend a GitHub repository URL is a running financial source.

### Canonical projection replacement
Each source snapshot includes: `schemaVersion=1`, UUID `eventId`, source name, unique revision, source snapshot timestamp, approved person reference, declared `complete=true`, source-record arrays, and an attestation with ALL coverage/count.

Source authority is strict:
- Finance OS: cash/investment positions; income projections; debts; capital pool classifications. No actual money-movement or transaction write.
- Asset OS: owned property and other asset projections; passive income projections. No money ledger or property registry write.
- Company OS: business equity and income/distribution projections. No tenant-controlled invented cash balance.

Amounts are canonical decimal strings with up to four fractional digits, currency **KES only**. Other currencies and FX need an approved authoritative FX mapping first; no hidden 1:1 conversion. Ownership fractions must be valid nonzero decimals <=1, and canonical asset refs are uniquely indexed across all economic assets per tenant. Duplicate holdings across two sources cause the entire snapshot transaction to roll back rather than counting the asset twice.

Under a per-tenant+source advisory lock, an accepted complete snapshot:
1. Verifies binding, consent, freshness, authority and schema.
2. Rejects changed replay of the same event/revision and strictly older/equal timestamps; identical exact replay responds `ALREADY_APPLIED`.
3. Retains asset identity/history via `source_active=false` for retired holdings. It replaces incomes/debts for the source and updates Finance classifications without mutating banking records.
4. Atomically updates `source_watermarks`, append-only ingestion receipt, audit evidence and pending outbox event.
5. Returns count/status, **never** executed money movements.

Source watermark `complete` and last `as_of` are read-model data, not a guarantee of regulator-grade valuation. Accepted source snapshots must be newer than the last applied; stale data blocks reconciliation.

### Wealth-state integrity
`GET /api/v1/wealth/state` never produces a net worth figure until all required sources provide fresh complete snapshots, active subject-scoped consent, and verified KES valuations. It excludes inactive source rows, requires canonical asset references, and sums ownership-weighted assets minus Finance OS obligations **once** using PostgreSQL `NUMERIC`. Capital pools are not added to asset totals. Source lapse or consent revocation returns null rather than a false zero or a fabricated result.

### Unified 22-route frontend
A global **Fictional Sample / Connected Authority** switch now uses one shared navigation. Authenticated mode keeps the existing premium design while routing Dashboard/Net Worth/Goals/Strategies/Capital/Portfolio/Income/Liabilities to authenticated API-backed views. Modules without durable APIs (forecasting, advisor, reporting, governance etc.) show **not server-backed** instead of fabricated results.

Connected sessions use browser OAuth Authorization Code + PKCE with short-lived tokens held only in memory. No sample localStorage state, bank credentials or false personal net worth can be uploaded. `GET /sources/status` displays subject-specific consent, producer-binding and source-sync freshness for each external OS. As with B1, **public GitHub Pages is intentionally unconfigured** unless external OIDC/API infrastructure is explicitly deployed.

## Manual operator activation (required)
1. Provision and certify a genuine HTTPS Personal Kernel-approved OIDC provider; confirm `iss`, public JWKS, audience, scope semantics, authentic human subject mapping, refresh/recovery/MFA and revocation lifecycle. Do not reuse a disposable Finance OS CI Keycloak realm.
2. Run migrations using `WEALTH_MIGRATOR_DATABASE_URL` (not the API role).
3. A verified Kernel administrator must insert issuer-bound `wealth_auth.identity_bindings` with actual proof reference (and active tenant member).
4. Obtain separate signed Finance/Asset/Company **service identities** with `wealth:ingest` permission, pinned integration issuer/JWKS/audience and a distinct restricted `wealth_ingest` DB principal. Use `WEALTH_INGEST_DATABASE_URL` and `INTEGRATION_OIDC_*`; no credentials in GitHub Pages.
5. A verified administrator must provision matching `source_grants` per source/tenant/person/producer with a proof reference and obtain corresponding active human consents. **There is no public self-authorization endpoint.**
6. Implement and operate trustworthy source-side publishers and source-snapshot mapping after the source OS explicitly exposes a verified transport. Correct for account coverage, asset ownership, debt evidence, policy, duplicates, completeness and FX. Feed only to the signed gateway via HTTPS.
7. Operate a protected API with managed secrets, WAF/rate limits, backup/restore tests, anomaly monitoring, producer key rotation, replay telemetry, privacy lifecycle and consent revocation purging/retention controls before real personal finances.
8. Configure public `VITE_WEALTH_* ` OIDC SPA settings and exact CORS origins. Perform real cross-OS staging UAT with verified accounts, expired/forged credentials, revoked consent, incorrect tenant and source revisions.

Until these gates are met, B2 is **integration-contract ready and locally certified**, not activated or production-connected.

## API/DB/CI
- New migration: `apps/api/db/migrations/004_identity_source_ingestion.sql`.
- New modules: `apps/api/src/b2/`.
- Separate env: `WEALTH_INGEST_DATABASE_URL`, `INTEGRATION_OIDC_ISSUER`, `INTEGRATION_OIDC_JWKS_URL`, `INTEGRATION_OIDC_AUDIENCE`.
- User API: `GET /api/v1/wealth/sources/status`; require issuer-bound user JWT and tenant identity.
- Source API: `POST /api/v1/integrations/sources/finance|asset|company/snapshots`; requires signed service JWT, producer grant, effective person consent and fresh source snapshot.
- UI: `src/connected/ConnectedWorkspace.tsx`, authority mode in `src/App.tsx`.
- CI: PostgreSQL role separation, migrations apply twice with checksums, B0/B1/B2 integration tests, frontend model tests, all routes and source-authority UX tests in Chromium.

## Remaining gates after B2

**B3 — Actual Provider Activation, Identity Federation, Staging & System Certification**: implement and deploy provider-owned signed publishers; prove OAuth and ownership mapping against live source endpoints; support currency conversion with timestamped verified rates; implement revocation purge/retention and regulatory DPIA; add reliability SLOs, backup/restore, traceable audit export, mobile accessibility; then stage full multi-OS end-to-end certification. **No real financial execution belongs in Wealth OS.**
