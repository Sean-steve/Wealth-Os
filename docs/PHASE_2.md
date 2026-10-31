# Wealth OS — Phase 2: Wealth Management (Frontend-only)

**Status:** Implemented browser-local prototype; not a financial system.  
**Canonical references:** WOS-010, WOS-020, WOS-060.  
**No backend, authentication, Finance OS/Asset OS/Company OS integration, real transactions or live AI.**

## Delivered modules

| Route | Capability | Working interactions |
| --- | --- | --- |
| `#net-worth` | Consolidated wealth state | Asset/debt summaries, illustrative time-range trends, categories, balance sheet |
| `#capital` | Capital & Allocations | Reclassify free capital between pools, commit planned allocations, inspect protected balances |
| `#portfolio` | Portfolio & valuations | Filter/search positions, inspect source provenance, add position, revalue and inspect valuation journal |
| `#income` | Income Intelligence | Active/passive analysis, stream creation/removal, earning-engine chart, monthly/yearly figures |
| `#liabilities` | Liabilities | Debt register, burden ratios, debt addition, simulated repayment using free capital/cash |

## Unified sample state

The local deterministic model and shared React context live under `src/phase2/`. Initial figures:
- Gross owned assets: **KES 16,100,000**
- Outstanding liabilities: **KES 3,260,000**
- Net worth: **KES 12,840,000**
- Cash: **KES 2,160,000**
- Strategic capital: **KES 2,160,000** (not additional assets)
- Reserved: **KES 1,405,000**; committed: **KES 375,000**; deployable: **KES 380,000**
- Passive modeled income: **KES 86,500/month**

The current Phase 1 Command Center and Phase 2 screens share the same sample wealth state, updated by all browser-local operations.

Sample state is saved locally via `localStorage` (key `wealth-os-phase2-sample-v1`) and can be reset to its initial values. It is not synchronized, encrypted, backed up or safe for real confidential records.

## Domain-safety controls

1. Net worth = ownership-adjusted gross assets minus liabilities.
2. Strategic pools classify cash already held; they are not double counted in net worth.
3. Capital commitments reduce deployable capital but never transfer money.
4. Capital reclassification leaves total cash unchanged.
5. A simulated debt repayment decreases both cash and liability by the same amount. The sample's net worth therefore remains constant.
6. Reserved or committed capital cannot fund a new allocation/repayment.
7. A cash valuation cannot fall below the cash amount already classified into pools.
8. New sample positions are not real assets; source-system names are illustrative labels only.
9. Valuations retain append-only sample history; snapshots and forecast trends are not authoritative records.
10. Input validation covers overspending, non-finite/negative amounts and invalid ownership shares.

## Checks

- `npm run typecheck`
- `npm test` — deterministic model/unit tests
- `npm run build` — production static bundle
- GitHub Actions workflow triggers on `main`

GitHub Pages must be enabled at repository Settings → Pages → Source: GitHub Actions, then the workflow can deploy.

## Scope boundaries

Phase 3: Goals/Strategy, Financial Independence, Performance.
Phase 4: Risk, Opportunity, Forecasts, Scenario Lab, AI Wealth Advisor.
Phase 5: Governance, Reports, Decisions, Approvals, Settings.
Phase 6: Frontend integration and certification.
