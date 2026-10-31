# Wealth OS — Phase B1: Durable Domains & Guarded Frontend Integration

**Scope:** Complete the first server-owned wealth planning vertical slices and provide an independently authenticated frontend. Existing GitHub Pages demo must remain isolated from actual financial records.

**Release criterion:** backend CI (PostgreSQL migrations applied twice; domain API/tenant/consent/finance correctness tests), frontend TypeScript, legacy demo tests, connected-client tests and Chromium end-to-end certification pass on the same commit. This is still **not** production data onboarding or a complete financial engine.

## Authority boundaries (non-negotiable)

| System | Authoritative ownership | What B1 may persist |
| --- | --- | --- |
| Personal Kernel / HumanKernelOS | Human identity, consent, global approval | Only external subject reference and tenant membership. OIDC issuer is external and must be configured; B1 does not create verified identities. |
| Finance OS | Accounts, transactions, reconciled cash, liabilities, money movement | Finance-source references, authorized read projections and **planning-only** classifications/proposals. No bank balance editing or execution. |
| Asset OS | Assets, ownership and valuations | Read-only, source-versioned holdings projections; no local invented asset registry. |
| Company OS | Business equity and economic distributions | Read-only, consent-limited business holdings and income projections. |
| Wealth OS | Goals, milestones, strategies, scenario/decision rationale, capital planning proposals | Durable domain state, audit records and transactional outbox entries. Never reinterpret a planning acknowledgement as payment authorization. |

### Delivered backend capabilities

- **Goal milestones:** list; create with date/target restrictions; PATCH with `If-Match` and idempotency. Tenant-scoped, journaled and outboxed.
- **Strategies:** create an immutable DRAFT v1; create a revised DRAFT vN+1; activate by appending a separate ACTIVE version. The mutable `strategy_heads` pointer keeps history immutable. A linked goal must be active. Two different strategies cannot both be active for the same goal. Allocation weights are integer basis points, totaling exactly 10,000.
- **Capital planning:** list cash classifications read-only, list proposals, create a **DRAFT only**, cancel a DRAFT. Source classification must reference Finance OS, be no more than 24 hours old, and have an effective server-side policy `CAPITAL_PROPOSAL` (`rules.maxProposalPercent` between 0 and 100). Pool-level row locking prevents concurrent oversubscription of uncommitted cash and sums other open proposals. These are research soft commitments, not money holds or bank instructions.
- **Read-only projections:** `portfolio/holdings`, `income`, `liabilities`; records require an effective subject-scoped `wealth.read` consent for the relevant source. No external adapters or public ingestion endpoints are implemented.
- **Wealth state:** `GET /state` returns `status=INCOMPLETE`, `netWorth=null`, `grossAssets=null`, `liabilities=null` until all Finance/Asset/Company consents and complete fresh source watermarks exist and all relevant holdings/liabilities are fresh, verified, and expressed in KES. When complete, PostgreSQL NUMERIC calculates ownership-weighted assets less liabilities once; capital pools are **never** added again to cash. This is still a **source-backed projection**, not an audited statement.
- **Cross-cutting:** B0 OIDC verification, transaction-local PostgreSQL FORCE RLS, non-superuser app account, caller role checks, real SQL constraints, version preconditions, request-bound idempotency, audit and transactional outbox. Browser CORS allows only explicit HTTPS origins (and localhost HTTP for development). No JWT/debug bypass route.

### Frontend integration: separate live mode, no silent fallback

A new **Connected Workspace** appears in navigation next to existing 21 fictional demo screens. It supports:
- Explicit "not configured" state when no trusted identity/backend is available. This is the **expected** public GitHub Pages behavior until separately configured.
- OAuth 2.0 Authorization Code with PKCE S256 using a public SPA OIDC client; one-time CSRF state, short session lifetime and no client secret.
- Access token held **in memory**, not localStorage, sessionStorage, URL fragments or sample persistence. OIDC redirect transient verifier/state is kept in sessionStorage for at most 10 minutes.
- Enter a provisioned tenant UUID (does not grant authority; server checks membership and subject scope).
- Read real durable Profile, Goals/Milestones, Strategy history, Capital classifications/proposals, source-backed Holdings/Income/Liabilities and completeness-gated Wealth State.
- Create/edit the real Profile, add Goals and Milestones, draft/activate Strategies and create/cancel planning-only Capital Proposals. No real account creation, source ingestion or payment execution.
- On auth/network failure: show a clear error. **Never copy sample holdings into the backend or show the fictional dashboard as a live result.**

### Setup

Local PostgreSQL (development only):
```sh
docker compose -f apps/api/compose.yaml up -d
npm install --prefix apps/api
set -a; . apps/api/.env; set +a
npm run db:migrate --prefix apps/api
npm run typecheck --prefix apps/api
npm run test:all --prefix apps/api
npm run start --prefix apps/api
```

1. Provision a **real** Personal Kernel-compatible OIDC issuer; set `OIDC_ISSUER`, `OIDC_AUDIENCE`, `OIDC_JWKS_URL` in `apps/api/.env`. For dev, don't publish service ports except explicitly protected private networks.
2. Provision tenant/membership and necessary `wealth_auth.consent_grants` using a privileged trusted admin process. Never permit browser callers to assert their own `subject_id` or grant consent to themselves.
3. Set `CORS_ALLOWED_ORIGINS` to exact application origins (e.g., `https://sean-steve.github.io` only if deploying a real authorized frontend).
4. Configure the **public SPA client** using *non-secret* build variables in root `.env`: `VITE_WEALTH_API_URL`, `VITE_WEALTH_OIDC_AUTHORIZE_URL`, `VITE_WEALTH_OIDC_TOKEN_URL`, `VITE_WEALTH_OIDC_CLIENT_ID`. Your identity provider must register the exact frontend origin+path as an allowed redirect URI and support PKCE and cross-origin code exchange.
5. The SPA client never holds a secret. The API validates access JWTs; do not use arbitrary pasted access tokens, homemade token issuers, shared logins or disable JWT signature verification.
6. Do **not** copy the fake data under `wealth-os-phase2-sample-v1` to a PostgreSQL tenant. Real integrations require reconciled, consented source facts.

### Policy provisioning

Capital proposals are intentionally blocked until a privileged policy is created:
```sql
INSERT INTO wealth_core.wealth_policies(
 tenant_id,policy_kind,policy_version,rules,effective_from,created_by_subject
) VALUES ('<tenant-uuid>','CAPITAL_PROPOSAL',1,
 '{"maxProposalPercent":80}'::jsonb,now(),'<verified-policy-administrator>');
```
These are *planning policy gates*. Threshold values are administrative examples, not automated recommendations. The authority of real movements stays with Finance OS.

### Source verification

B1 does not expose a source ingestion API. A future trusted service must enforce source signed messages, consent/revocation, account ownership, source versioning, reconciliation, deduplication, FX, valuation freshness and complete snapshots **before** it is allowed to write `wealth_portfolio` projections or `wealth_integration.source_watermarks`. B1 tests seed these tables via the privileged migrator to verify projection correctness; this does not mean actual provider feeds are connected.

Source completeness requires `source_watermarks.complete=true` for Finance OS, Asset OS and Company OS, freshness <=24h, effective per-subject source consents, and verified eligible KES valuation data. Missing evidence produces **null metrics and descriptive blockers** rather than a false zero.

### API contract

Canonical `apps/api/contracts/openapi.yaml` covers B0 and B1 paths; `apps/api/contracts/events.schema.json` defines the future cross-OS envelope. Existing B0 routes remain backward-compatible. B1 additional endpoints:

```
GET  /api/v1/wealth/goals/{id}/milestones
POST /api/v1/wealth/goals/{id}/milestones
PATCH /api/v1/wealth/goals/{id}/milestones/{milestoneId}
GET  /api/v1/wealth/strategies
GET  /api/v1/wealth/strategies/{id}
POST /api/v1/wealth/strategies
POST /api/v1/wealth/strategies/{id}/versions
POST /api/v1/wealth/strategies/{id}/activate
GET  /api/v1/wealth/capital/pools
GET  /api/v1/wealth/capital/proposals
POST /api/v1/wealth/capital/proposals
POST /api/v1/wealth/capital/proposals/{id}/cancel
GET  /api/v1/wealth/portfolio/holdings
GET  /api/v1/wealth/income
GET  /api/v1/wealth/liabilities
GET  /api/v1/wealth/state
```

Mutations require appropriate `wealth:write` scope, tenant OWNER/ADVISOR membership, an idempotency key and `If-Match` when updating/versioning. All results stay tenant scoped under RLS.

### Certification and known limitations

- CI must test migrations twice against PostgreSQL 16 and run isolated backend suites, static frontend regression, connected-client tests and Chromium navigation.
- No backend production deployment, real identity provider connection, live source adapters, money execution, running outbox dispatcher, backup/restore certification, tenant onboarding UI or production monitoring is part of B1.
- The connected frontend is **opt-in** and publicly unconfigured by default, while the original sample screens continue working on GitHub Pages.
- No implied wealth accuracy until the authority model is fulfilled.

### Phase B2 proposal

Identity and consent production provisioning → trustworthy Finance/Asset/Company event ingest and reconciliation → complete server-side capital policies & risk intelligence → robust read models and frontend role parity → real environment staging, security/privacy assessment, resilience, data lifecycle and audited release certification.
