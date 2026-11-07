# Wealth OS

Wealth OS is the strategic wealth-intelligence frontend within the Personal Kernel ecosystem.

## Phase 1–5 — Premium UI, wealth management, strategic planning, intelligence and governed local decisions

Static React + TypeScript + Vite prototype using *illustrative KES sample data*. No database, user accounts, live AI, provider connection or financial execution is present. Phase 2 includes interactive local portfolio, capital, income and liability workflows. Sample records persist in this browser through localStorage. All actions are local browser simulations. The visible Personal Kernel connection is explicitly marked as **planned**.

### Local development

```bash
npm install
npm run dev
npm run typecheck
npm test
npm run build
npx playwright install --with-deps chromium
npm run test:e2e
```

### GitHub Pages

This repository uses a GitHub Actions Pages workflow from `main`, publishing Vite's `dist/` output. If Pages has not been enabled yet, select **Settings → Pages → Source: GitHub Actions**, then rerun the workflow.

### Phases

1. **Foundation & Command Center** — delivered: visual tokens, responsive shell, overview dashboard, trend chart, wealth composition, goals, capital readiness, risk, opportunity radar, local scenario calculator and decision explanation.
2. **Wealth management** — delivered: net worth, capital, portfolio with valuation history, income and liabilities; browser-local editing/revaluation/reclassification/repayment.
3. **Planning & Performance** — delivered: dynamic Goals & Milestones, versioned strategy drafts/activation/revisions, financial independence assumptions and contribution scenarios, local performance change journal.
4. **Wealth intelligence** — delivered: threshold-based Risk Center; Opportunity Lab with eligibility and ranking; deterministic Forecasting; isolated Scenario Lab; evidence-backed rules-only Advisor. Not a real AI service.
5. **Governance & Supporting Modules** — delivered: recommendations/decision journal, versioned local review policies, planning-only acknowledgements, source freshness checks, privacy and browser data controls, JSON/CSV reports, planned integration catalog and local display settings.
6. Cross-screen certification, responsive polish and final frontend release.

See `docs/PHASE_1.md` through `docs/PHASE_6.md` for scope and acceptance criteria.

### Certification boundary

The v0.6 workflow gates GitHub Pages on unit tests, strict TypeScript, production build and Chromium end-to-end testing. This certifies a **fictional browser-local demonstration only**, not production finance, security or accessibility compliance. See `docs/PHASE_6.md` for coverage, limitations and release requirements.

## Backend Phase B0 — Separate PostgreSQL API foundation

New backend under `apps/api/` with tenant-scoped PostgreSQL, first durable Wealth OS Profile and Goals REST endpoints, authorization boundaries, transactional audit/outbox, contracts and separate CI. **The existing Pages frontend remains browser-local and has not been switched to this API.** See `docs/PHASE_B0.md` for setup, source-of-truth authority, security limitations and B1 prerequisites.

## Backend Phase B1 — Durable Wealth Planning & Guarded Live Workspace

PostgreSQL milestone/strategy lifecycle, finance-source-guarded capital proposals, consent-gated read-only portfolio/income/liability projections, and completeness-gated wealth-state aggregation are under `apps/api/src/b1/`. The **Connected Workspace** is a separate OIDC/PKCE-secured frontend route and is *unconfigured* on public GitHub Pages by default. Other screens remain fictional demos. See `docs/PHASE_B1.md` for integration details, policy setup, testing and limitations.

## Phase B2 — Kernel-Bound Identity, Source Gateway & Unified Navigation

B2 requires verified issuer+subject identity bindings for every authenticated tenant operation; a distinct signed service OIDC source token and restricted ingestion database account for replay-safe, consented Finance/Asset/Company snapshots; and an explicit **Sample / Connected Authority** switch across all navigation routes. The source repositories have no verified live publisher endpoints/production identity; **do not treat this as a live wealth integration**. Read `docs/PHASE_B2.md` and `apps/api/contracts/hos-external-engine.manifest.json` for identity provisioning, domain boundaries and activation gates.

## Phase B3 — Staging & Real Provider Protocol Assurance

B3 adds staging-only infrastructure, a protected manual deployment pipeline, HTTPS OIDC/provider preflight, actual ephemeral Keycloak identity/service JWT verification, mandatory MFA-ACR/verified-email checks for staging, and stricter source-evidence contracts. **No live staging host, production identity provider, or actual cross-OS publisher is provisioned in GitHub.** See `docs/PHASE_B3.md` and `deploy/staging/` for exact operator gates and limitations.

## Phase B3.1 — Protected Staging Provisioning and Real Provider Activation Proof

Added a non-destructive dedicated-host bootstrap, protected main-SHA release gates, and an operator-only, signed-JWT multi-provider test-tenant activation verifier. The verifier is strictly opt-in, rejects absent credentials, and requires real approved human+source signatures. **No staging server/provider account is created by code or by GitHub Pages**, and no actual financial feed is claimed active. See [B3.1 operator runbook](docs/PHASE_B3_1.md) and `apps/api/scripts/liveActivation.ts`.

## Phase L1 — Local Ubuntu PostgreSQL Activation & Certification

L1 adds a **native existing-PostgreSQL bootstrap** and a **loopback-only local Keycloak container** (identity only; no Docker PostgreSQL). Local development creates independent random DB roles and a generated isolated test tenant/password with no real financial source data. Local protected workflows are actually accessible using Keycloak-signed JWTs and PostgreSQL persistence; the API does not accept fake/unsigned bearer tokens. **Tests on a developer's actual Ubuntu installation require running these scripts on that machine; GitHub CI alone cannot certify a particular laptop.**

```bash
python3 scripts/local/setup.py --pg-port 5432  # use --pg-port 5433 if native PG uses 5433
npm run local:migrate --prefix apps/api
python3 scripts/local/provision_identity.py
npm run local:identity:up
npm run local:api --prefix apps/api          # separate terminal
npm run dev                               # separate terminal
npm run local:certify --prefix apps/api    # third terminal
npm run local:test --prefix apps/api    # safe local unit tests, not privileged fixture tests
```

**Read [Full L1 Ubuntu Runbook](docs/PHASE_L1.md) before starting.** Never use this test realm for actual financial data or production identity.
