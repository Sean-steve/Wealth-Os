# Wealth OS — Phase 4: Wealth Intelligence

**Delivery:** React/TypeScript frontend-only prototype. All data is sample/demo, browser-local and explicitly non-authoritative.

## Integrated modules
| Route | Screen | Working interactions |
|---|---|---|
| `#risk` | Risk Center | Transparent threshold engine, sample risk exposure index, severity filters, evidence drill-down, policy assumptions and supporting navigation |
| `#opportunities` | Opportunity Lab | View, add, filter, shortlist, dismiss and compare up to three research ideas; cash/reserve guardrails precede strategic-fit scoring |
| `#forecasts` | Wealth Forecasting | Edit baseline/downside/upside nominal return assumptions, inflation, horizon and contributions; annual trajectories and present-value display |
| `#scenarios` | Scenario Lab | Create/delete, run and compare isolated investment, market, debt, property, income and business shocks; never mutate live local state |
| `#advisor` | Wealth Advisor | **Offline rules-based Q&A only**, recognized question types, cited local numeric evidence, transparent limitations and contextual navigation |

The Command Center's Risk Watch and Opportunity Radar now read the shared Phase 4 model rather than hard-coded cards. The main simulation CTA opens Scenario Lab.

## Domain rules and safety
1. Wealth intelligence consumes the existing `WealthState` (holdings, liabilities, income, capital pools, goals, strategies); no parallel transaction ledger.
2. Risk severity is calculated by deterministic thresholds on business concentration, income concentration, debt service, leverage, emergency reserve coverage and valuation freshness. The 0–100 display is a **heuristic index (100 − 12×watch − 25×high)**, NOT a loss probability, investment risk rating or credit score.
3. Opportunity research requires **uncommitted capital**, and a protected 6-month sample emergency reserve to pass funding eligibility; the heuristic strategy score never overrides a failed hard gate. Scores are not expected returns or probabilities.
4. Forecasts start from **investments + deployable cash** only, excluding private company and property estimates. Scenarios use constant explicitly assumed returns compounded monthly and hypothetical new contributions, without fees, tax, FX or market volatility calibration.
5. Scenario Lab is *pure what-if*: cash-to-investment/property exchanges create **zero immediate net-worth gain**; debt repayment reduces cash and liabilities equally; market/business shocks reduce sample asset values; income loss does not retroactively alter current assets. A failed availability check leaves the modeled balance sheet unchanged.
6. Wealth Advisor is deliberately a **non-LLM** rules-driven explanatory tool. It can only explain sample computations; there are no outbound API calls, bank integrations, trades, transfers, approval bypasses or automated decision-making.
7. Every response identifies numeric sources within the local state; unknown questions return scope/limitations instead of invented bank data.
8. No demo values should be represented as the real user's wealth information or as actual investment advice.

## Browser-local migration

The existing localStorage key `wealth-os-phase2-sample-v1` is retained. Opening a Phase 1–3 local workspace with no intelligence state adds `seedIntelligence` while preserving Phase 2 wealth records, Phase 3 goals/strategies and performance edits. Reset restores the entire fictional starting workspace.

## Verification
```sh
npm install
npm run typecheck
npm test
npm run build
```
`src/phase4/model.test.ts` contains 24 new tests for risk calculation, dynamic inputs, opportunity hard gates, forecast invariants, scenario accounting, immutability and evidence-bound Q&A.

Pages publishing uses `.github/workflows/pages.yml`; no deployment is confirmed until the corresponding GitHub Actions deployment job succeeds.

## Pending
**Phase 5:** Decision Journal, Reports, Policies, Governance/Security previews, approval and consent interfaces (all frontend-only).
**Phase 6:** Cross-module integration, accessibility, responsive certification and final frontend release.

**Production boundary:** A real deployment would still require Personal Kernel governance and identity, Finance OS execution authority, provider authorization, independently reconciled data, server-side permissions, audit and security reviews. None is implemented here.
