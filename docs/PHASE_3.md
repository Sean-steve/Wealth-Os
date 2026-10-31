# Wealth OS — Phase 3: Wealth Planning & Performance

**Delivery:** frontend-only React/TypeScript prototype. This release has no backend, user authentication, market data, bank links, AI model, Finance OS, Asset OS or Company OS connection. All wealth values are fictional and browser-local.

## Implemented screens
| Route | Scope | Interactions |
| --- | --- | --- |
| `#goals` | Goals & Milestones | Create/edit/pause/resume/archive goals; add/remove milestone checkpoints; dynamically calculate progress/gaps from Phase 2 local wealth state; inspect linked strategies |
| `#strategies` | Wealth Strategies | Create drafts; edit allocations (must sum to 100%); activate only one per goal; clone active strategy as next version without overwriting previous; inspect allocations |
| `#independence` | Financial Independence | Configure lifestyle, withdrawal, inflation, nominal returns, contributions, target year; calculate eligible capital/required capital, passive coverage, gap and hypothetical contribution comparison chart |
| `#performance` | Wealth Performance | Record browser-local before/after mutations; filter journal by period; show net-worth change, asset/debt movement, category breakdown, local event ledger and ownership-adjusted cost-basis estimates |

## Connected Command Center

The Command Center's Goals card reads the same derived goal state as the Goals screen; the Financial Independence KPI reads the same eligible capital and plan assumptions. Existing Phase 2 charts/metrics and capital/portfolio/income/liability interactions remain available.

Phase 1's stylized trend remains **explicitly labeled illustrative**, not presented as a verified wealth return. The Performance screen is the source for **genuine changes within this browser demo**.

## Local state and migration

The existing `wealth-os-phase2-sample-v1` localStorage key is retained. Opening an older Phase 2 workspace automatically fills in Phase 3 planning records and a performance baseline **without destroying user-edited Phase 2 sample assets, loans, income streams or pools**. All sample workspace resets clear all phases back to default seed state.

## Mathematical definitions

- Goal progress: current measured metric / target. Current values are computed from live local portfolio/net worth/income/pool states, never typed into goal progress fields.
- Goal required uplift/month: positive gap / months remaining, **without** assuming returns or future asset appreciation.
- Strategy activation: local planning state only; **no investment, transfer or capital allocation**.
- Strategy revision: new draft with incremented version, linked to prior revision; historical strategy is retained.
- Independence required capital: 12 × desired monthly lifestyle / assumed annual withdrawal fraction.
- Eligible independence capital: current investment positions + **deployable (unreserved, uncommitted) cash**. Illiquid property and private business valuations are excluded, as are protected reserves.
- Passive-income coverage: current illustrative passive monthly income / desired monthly lifestyle.
- Illustrative future value: current eligible capital compounded at stated nominal assumed annual return (monthly compounding), plus stated monthly contributions; inflation-adjusted future required capital is shown separately.
- Performance journal: local edit snapshots with opening/current assets, debt, income and category valuations; no implied realized returns.
- Unrealized estimate: ownership-adjusted holding value minus entered ownership-adjusted cost basis; **not** total portfolio return.

## Validation and truthfulness
Automated tests in `src/phase3/model.test.ts` verify Phase 2 migration preservation, goal derivation, milestone rules, strategy allocation and versioning, independence assumptions, future-value arithmetic, and performance cash/debt conservation.

Run:
```sh
npm install
npm run typecheck
npm test
npm run build
```

Pages deploy uses the existing `main` workflow. Publishing requires GitHub Pages to be enabled with **Source: GitHub Actions** in repository settings. No live deployment should be claimed until GitHub confirms success.

## Next phases
**Phase 4:** Risk Center, Opportunity Lab, advanced Forecast & Scenario Lab, AI Wealth Advisor (frontend demonstration).
**Phase 5:** Decision journal, permissions/governance preview, reports, privacy and settings.
**Phase 6:** cross-workflow UX certification, accessibility, responsive testing and final frontend release.
