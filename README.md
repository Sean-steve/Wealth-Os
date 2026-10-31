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
