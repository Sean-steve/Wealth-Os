# Wealth OS — Phase B0: Backend Foundation, PostgreSQL & API Contracts

**Scope:** Infrastructure and initial Wealth-owned persistence. **No actual bank/provider connections, Personal Kernel identity service integration, trading/payment execution, live valuations, or frontend–backend integration.** Phase B0 creates real server/database functionality, but not a complete backend product. Static GitHub Pages remains unchanged.

## Architecture and ownership

Canonical reference: WOS-010 Domain/Database, WOS-020 Services, WOS-030 API/Event Contracts, WOS-050 Governance/Security.

**Runtime:** Node.js 22+, Fastify 5, TypeScript, Zod, PostgreSQL 16+, jose (OIDC JWKS verification), `pg`, scoped transactions.

**Source of truth:**
- **Wealth OS:** wealth profile, goals, milestones, strategy versions, proposed capital classifications, risk/forecast/decision records and evidence-based projections.
- **Finance OS:** bank accounts, payment/transaction ledger, cash/loan payment truth and execution authority. Wealth OS stores only source references and projections, never an alternative ledger.
- **Asset OS:** asset identity, legal/economic ownership and valuation evidence.
- **Company OS:** business equity/economics and dividends.
- **Family/Legacy OS:** governance-approved purpose-limited family obligations and legacy references.
- **Personal Kernel/HumanKernelOS:** canonical human identity, consent, authorization and policy arbitration. Wealth OS does not invent its own trusted human identity.

No cross-OS foreign keys or direct cross-DB writes. Use `source_system`, `source_entity_type`, `source_entity_id`, `source_as_of`, version, provenance and quality status; reconcile ownership to avoid double counting.

## PostgreSQL schemas

| Schema | Tables | B0 status |
|---|---|---|
| `wealth_auth` | tenants, tenant_memberships, consent_grants | Exists; membership checked; administrative onboarding only |
| `wealth_core` | wealth_profiles, wealth_policies, schema_migrations | Profile API functional; policy table contract only |
| `wealth_planning` | goals, goal_milestones, strategy_versions | Goals API functional; milestones/strategies contract only |
| `wealth_capital` | pools, allocation_proposals | Schemas only; does not hold money |
| `wealth_portfolio` | holdings, holding_valuations, income_projections, liability_projections | Projection schemas only; no fake source imports |
| `wealth_risk` | exposure_signals | Schema only |
| `wealth_intelligence` | forecasts, scenarios, recommendations, decision_records | Schemas only |
| `wealth_integration` | outbox_events, inbox_receipts, idempotency_keys | Transactional outbox on profile/goal mutations; no dispatcher yet |
| `wealth_audit` | audit_events | Append-only permissions for app role; NOT tamper-evident/WORM |

Money uses `NUMERIC(20,4)` and API decimal **strings**, not JS float balances. Tenant data is scoped via PostgreSQL `FORCE ROW LEVEL SECURITY`. Tenant IDs must be UUIDs. Cross-tenant child relationships use tenant-scoped composite foreign keys where relevant.

Migrations are append-only, checksumed and serialized under a transaction-scoped advisory lock. The app cannot migrate schemas. Every tenant-scoped table in the initial migration has RLS; the application account cannot select the tenant registry or bypass RLS.

## Authentication/authorization

Protected requests require:
1. **Real** Bearer OIDC/JWT access token signed by the configured trusted JWKS; `iss`, `aud`, `iat`, `exp`, asymmetric algorithm and maximum age validated.
2. Explicit `wealth:read` or `wealth:write` scope.
3. `X-Wealth-Tenant-Id` UUID **requested** by the client, not trusted as authority.
4. Active membership for the token `sub` in `wealth_auth.tenant_memberships`, checked inside a transaction with `app.subject_id` session variable.
5. Owner role to change profile; owner/advisor to change goals. Viewer read-only.
6. RLS `app.tenant_id` transaction-local variable after membership verification.

Never use frontend demo users, unsigned tokens, `X-User-Id` headers or test sign-in bypasses in the actual server.

**OIDC provisioning is a required external dependency**: B0 does not claim Personal Kernel is already connected. Real protected routes will reject requests until a trusted issuer is configured, a tenant/membership is administratively created, and a valid token is presented. The tests inject a verifier **only in process** through dependency injection; there is no public testing login endpoint.

### Tenant provisioning (administrative, not exposed to end users)

After migration, from an authorized admin/migrator connection:
```sql
INSERT INTO wealth_auth.tenants(external_person_ref,label)
VALUES ('person-ref-from-personal-kernel','Example wealth tenant')
RETURNING id;

INSERT INTO wealth_auth.tenant_memberships(tenant_id,subject_id,role,status)
VALUES ('<returned-tenant-uuid>','<verified-oidc-subject>','OWNER','ACTIVE');
```

Never derive or accept the authoritative subject from unverified browser input.

## Implemented REST routes

Base `/api/v1/wealth`:
- `GET /health`, `GET /ready`: public status without financial facts.
- `GET /capabilities`: authenticated tenant-scoped feature readiness (only profile/goals durable).
- `GET /profile`: fetch tenant profile, 404 if not provisioned.
- `PUT /profile`: create/update with `If-Match`, `Idempotency-Key` and ETag; **owner only**.
- `GET /goals?limit=20&cursor=...`: keyset pagination, max 50.
- `GET /goals/:id`: tenant-scoped record with ETag.
- `POST /goals`: create; authenticated member with owner/advisor role and write scope.
- `PATCH /goals/:id`: partial update with optimistic concurrency, idempotency and ETag.

All write commands are atomic transactions: mutate Wealth-owned record + append an audit row + append a pending outbox event + store the idempotency response. Responses return `{data:...}`. Errors return `{error:{code,message,details,correlation_id}}`. `401/403/404/409/422/428` semantics are versioned through OpenAPI (validation is `400` for malformed HTTP data; financial domain violations in later phases use `422`).

**Important:** The outbox rows are **not** being published to other OSs. No event consumer, dispatcher, verified cross-OS source adapter, webhook ingress, auto-trading or payment processor is part of B0.

See `apps/api/contracts/openapi.yaml` and `apps/api/contracts/events.schema.json` for the machine-readable contract baseline. Contract evolution must add backward-compatible versions and expand coverage with contract tests.

## Local deployment (development only)

Requires Docker Compose, Node.js 22+.

```bash
docker compose -f apps/api/compose.yaml up -d
npm install --prefix apps/api --no-audit --no-fund
cp apps/api/.env.example apps/api/.env

# Local-only example values must not be used in production.
set -a; . apps/api/.env; set +a
npm run db:migrate --prefix apps/api
npm run typecheck --prefix apps/api
npm run test --prefix apps/api
npm run test:integration --prefix apps/api
npm run start --prefix apps/api
```

The `apps/api/compose.yaml` passwords are intentionally development-only, localhost-bound credentials. **Do not expose port 5546 publicly or deploy these passwords.** Postgres bootstraps a distinct non-superuser `wealth_app` on first initialization. Migrations must run using `WEALTH_MIGRATOR_DATABASE_URL`, not `WEALTH_APP_DATABASE_URL`.

For a real API session, change the `OIDC_*` placeholders to a real secured issuer and provision the subject/tenant mapping. Static GitHub Pages is not a suitable API host.

## CI certification

`.github/workflows/wealth-backend.yml` runs an ephemeral PostgreSQL 16 service:
- Separate privileged migrator and restricted app users.
- Apply migrations twice to verify idempotence and SHA-256 checksums.
- Strict backend TypeScript and unit contracts.
- Real PostgreSQL integration tests for authorization, tenancy/RLS, profile and goal persistence, optimistic versions, key reuse conflicts, pagination, audit and outbox.

The existing Pages pipeline remains isolated; backend CI failure does not silently replace a working frontend deployment.

## Phase B1 entry criteria

- Select/connect a genuine Personal Kernel-compatible OIDC issuer with claim/scopes mapping and subject lifecycle.
- Define trusted tenant provisioning and revocation procedures.
- Build full goal/milestone/strategy version services and profile workspaces.
- Bind consent grants to purpose-specific integration adapters; implement source freshness and ownership reconciliation.
- Implement isolated capital proposals with **server-enforced** policies and true multi-pool liquidity limits, with no money execution until Finance OS approval.
- Add real encryption/secret management, tracing, backups/restores, vulnerability management and staging deployment before any sensitive personal data.
- Build a **separate** authenticated frontend API integration wave. Never silently migrate synthetic localStorage data as real financial history.

## Non-compliance/non-production disclaimer

The B0 API uses verifiable identity tokens but the actual identity provider is not provisioned here; there is no consent enforcement workflow, production secrets manager, external audit/WORM system, disaster recovery guarantee or live market/banking data. The backend is **engineering foundation, not production certified**.
