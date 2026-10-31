# Wealth OS

Wealth OS is the strategic wealth-intelligence frontend within the Personal Kernel ecosystem.

## Phase 1 — Premium UI foundation and Wealth Command Center

Static React + TypeScript + Vite prototype using *illustrative KES sample data*. No database, user accounts, live AI, provider connection or financial execution is present. All actions are local browser simulations. The visible Personal Kernel connection is explicitly marked as **planned**.

### Local development

```bash
npm ci
npm run dev
npm run typecheck
npm run build
```

### GitHub Pages

This repository uses a GitHub Actions Pages workflow from `main`, publishing Vite's `dist/` output. If Pages has not been enabled yet, select **Settings → Pages → Source: GitHub Actions**, then rerun the workflow.

### Phases

1. **Foundation & Command Center** — active release: visual tokens, responsive shell, overview dashboard, trend chart, wealth composition, goals, capital readiness, risk, opportunity radar, local scenario calculator and decision explanation.
2. Wealth management — net worth, capital, portfolio, income and liabilities.
3. Planning — goals, strategies, independence and performance.
4. Intelligence — risk, opportunity, forecasting, simulations and advisor.
5. Governance — decision journal, approvals, privacy, reports, settings.
6. Cross-screen certification, responsive polish and final frontend release.

See `docs/PHASE_1.md` for scope and acceptance criteria.
