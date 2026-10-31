# Wealth OS — Phase 5: Governance & Supporting Modules

**Release:** v0.5.0 · **Delivery target:** browser-only premium v2 UI · **Status:** implementation in this repository (CI/Pages must pass before release may be certified).

## Screens & functional workflows

| Route | Screen | Complete browser-local interactions |
| --- | --- | --- |
| `#decisions` | Recommendations & Decision Journal | Dynamically derive candidate recommendations from actual local goal/risk/opportunity state; create a case; revise rationale; submit/refresh a policy review; acknowledge for planning only; decline, close and review the local event trail |
| `#governance` | Policies & Planning Approvals | Display and edit versioned local planning thresholds; show review queue, blockers, current/stale signatures and historical local policy revisions |
| `#security` | Security & Privacy | Security capability matrix; functional preferences for browser-local export/Q&A storage; full sample JSON workspace backup; remove advisor transcript; confirm-before-reset entire edited demo workspace |
| `#reports` | Wealth Reports | Derived gross assets, debt, net worth, investments, capital classifications, goals, risk summary and independence metrics; export current sample report in JSON or CSV; optional local event history controlled by privacy and report settings |
| `#integrations` | Integrations & Data Contracts | Cross-OS source-of-truth map, contract descriptions, explicit `Not connected` connection status, prerequisites and non-execution invariants |
| `#settings` | Workspace Settings | Browser-persisted landing view (no URL fragment), report history scope, compact KES report display; currency fixed to KES, locale fixed to en-KE |

All screens extend the Phase 1–4 navy/violet design and remain mobile-responsive. The Command Center's old decision modal was retired in favor of the real local Decision Journal.

## Planning-only governance — never a payment approval

This release has no authenticated identities, real approvers, production policy engine, durable server audit, email, banking, money movement or trading features.

Decision case lifecycle:

`SOURCE RECOMMENDATION → DRAFT → UNDER_REVIEW → PLANNING_APPROVED → CLOSED` with alternative `DECLINED`.

`PLANNING_APPROVED` means **a local browser-user acknowledgement of a research plan**, not authorization for cash deployment, investment, purchase, payment, transfer or cross-OS execution. It cannot be used to call Finance OS. UI uses the text “Planning acknowledged” and explicitly states the boundary.

### Current local policy checks

- Emergency reserve floor, initially 6 months of entered lifestyle costs.
- Funding ≤ currently available deployable capital, not reserved or committed cash.
- Single commitment ≤ 80% of deployable cash by default.
- Business expansion exposure ≤ 50% of modeled gross assets by default.
- Phase 4 opportunity eligibility gate (non-overridable by Phase 5 heuristics).
- Source existence and current active status (risk alert still present, idea not rejected, active goal).
- Oldest position valuation freshness ≤ 365 days (demo policy default).
- At least 20 characters of rationale when enabled.

These are editable **Phase 5 local decision policies**, not authoritative global Personal Kernel policies. Existing Phase 4 risk thresholds are unchanged.

Approval checks compute a signature of the policy version, holdings, liabilities, pools, income, goals, opportunity state, and independence lifestyle assumptions. If relevant data or a policy changes, local reviews must be resubmitted. No claims of cryptographic signature, secure approvals or tamper evidence are made. Every demo case transition is recorded as a browser-local event, clearable by the user.

## Reporting & privacy

All report figures are recalculated from the shared Phase 2–4 sample workspace (ownership-adjusted assets; no double counting of capital pools). Report JSON includes a prominent fictional-data notice, and CSV escapes spreadsheet formula-looking strings. Full workspace export is a **plain-text file containing all local state**, even when the narrower report's activity events are excluded by preference.

Report event export requires both:
1. Report scope is `CURRENT + local events` (setting value `ALL`).
2. Privacy preference `includeAuditInExport` is enabled.

Only the current snapshot is authoritative **within the demo**. Historical portfolio returns cannot be inferred from sample valuations or local edits.

Browser storage key remains `wealth-os-phase2-sample-v1`; migration adds `governance` without destroying existing demo assets, income, liabilities, plans, strategies, decisions or scenarios. Advisor transcripts are **not saved** unless the user switches on that optional preference; if enabled, they are stored in a separate, unencrypted browser-local key `wealth-os-demo-advisor-session`. Reset restores fictional seed state; it is not secure erasure of already-downloaded files.

## Cross-OS boundaries

- **Personal Kernel:** identity, consent, governance and global authority — NOT connected.
- **Finance OS:** financial accounts, transactions, reconciled money movement — NOT connected.
- **Asset OS:** authoritative assets and valuations — NOT connected.
- **Company OS:** business ownership and economics — NOT connected.
- **Family OS / Legacy OS:** permitted family and succession references — NOT connected.

No UI control “connects” these systems or fabricates a working API.

## Validation

```bash
npm install
npm run typecheck
npm test
npm run build
```

Tests in `src/phase5/model.test.ts` cover migration, dynamic recommendation derivation, planning decisions, hard guardrails, policy versions and stale reviews, source invalidation, local privacy/setting validation, report reconciliation, conditional event export and CSV formula escaping.

GitHub Actions deploys the static Vite build from `main` to Pages only after typecheck, tests and build pass.

## Pending — Phase 6

- End-to-end cross-screen functional test matrix and mobile/a11y QA.
- Browser-local import/export recovery validation and data migration edge cases.
- Navigation, empty/error states, copy consistency and performance bundle checks.
- Final frontend product certification and handover. **Backend and production integrations are intentionally outside the current frontend-only scope**.

Do not enter personal secrets, actual financial records or API credentials into this prototype.
