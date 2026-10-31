# Wealth OS — Phase 6: Full-System Frontend Certification & Release

**Scope:** v0.6 static, browser-local prototype. **Not** a production wealth platform. No backend, authenticated users, real accounts, integrated Personal Kernel, finance execution, live AI, server security, verified prices or live compliance controls.

## Objective

Certify the complete **frontend** experience as one cohesive product, not only isolated domain-calculation functions. All 21 main navigation routes must render, workflows must preserve local state safely, scenario and planning actions must never execute real money movement, and the GitHub Pages release must be gated by actual browser checks.

## Delivery
- **Navigation:** unique labels for 21 routes, direct deep links, unknown hash fallback, mobile navigation, browser back/forward compatibility, skip-to-main, appropriate page titles and focus placement after in-app navigation.
- **State & backup:** strict validation for saved browser-local wealth positions, liabilities, income, capital pools and allocations; reject malformed imported JSON and mismatched cash/pool accounts. Import/export roundtrip for the `wealth-os-local-demo` backup format with version checks, maximum 3 MB, confirmation before replacement, and no fake performance event on restore. Legacy workspaces with no later-phase sections migrate to demo defaults for those sections.
- **Interaction accessibility:** central, shared modal behavior with Escape to close, focus containment, initial focus, focus restoration, scroll lock, proper title/description relationships; keyboard focus styles and reduced-motion support.
- **Financial integrity:** investments and cash are not double counted by strategic capital pools; cash-funded repayment reduces both cash and liability, not net worth; Phase 5 planning acknowledgement is NOT Finance OS authorization and never creates trades/transfers. Forecasts and performance remain illustrative.
- **Reports:** current KES sample report plus validated export and local backup/restore, clear non-authoritative sample labels.
- **Quality gates:** strict TypeScript, legacy model regression tests, Phase 6 recovery and integration tests, production bundle build, real Chromium e2e journeys and automated accessibility checks (excluding color-contrast scanner; this still requires visual/manual QA).
- **CI:** Pages deploy only after the `build` and `browser-certification` jobs succeed. Failure screenshots/traces retained for analysis.

## Test matrix and release criteria

| ID | Scenario | Expected result | Automation |
|---|---|---|---|
| P6-01 | 21 direct-link routes / unknown route | Every route renders; unknown routes fall back to Command Center; no uncaught browser exceptions | Playwright |
| P6-02 | Goals create → dashboard → reload | Sample goal saved across navigation and refresh | Playwright |
| P6-03 | Recommendation → case → review → planning acknowledgement → report | Local-only decision stage changes; financial state does not | Playwright + Vitest |
| P6-04 | Export → reset → import → refresh | Edited sample workspace is restored without losing planning data | Playwright + Vitest |
| P6-05 | Malformed backup | Rejected with visible feedback; existing state retained | Playwright + Vitest |
| P6-06 | Keyboard modal | Focus trapped, Escape closes, prior focus restored | Playwright |
| P6-07 | Narrow mobile viewport | Navigation can open/select/close; core screens don't overflow viewport | Playwright |
| P6-08 | Critical automated WCAG structure | No serious/critical violations other than specifically excluded contrast scans | Axe in Playwright |
| P6-09 | Corrupt stored wealth records | Fallback to fictional seed instead of fatal crash | Vitest |
| P6-10 | Cross-domain financial conservation | Derived metrics and policy checks remain consistent | Vitest |
| P6-11 | Strict typecheck / production build | Passes in GitHub Actions | CI |
| P6-12 | Pages publication | GitHub Pages environment reports successful deployment for current `main` SHA | GitHub Actions |

## Limitations

1. This is **not a genuine security, accessibility or regulatory compliance certification**. Browser-side guards cannot enforce identity, privacy, or financial authority. The security preview accurately states missing controls.
2. **Color contrast and assistive-technology testing** still require manual validation against actual devices and browser/OS combinations. Automated axe tests verify structural WCAG issues but intentionally disable color-contrast rules pending thorough token remediation.
3. E2E coverage validates representative journeys, not all possible combinations of 21 screens or every interactive element.
4. Persistence is unencrypted localStorage; backup files are unencrypted JSON and should contain only fictional data.
5. No continuous backend availability, disaster recovery or financial reconciliation can be certified because no backend exists.
6. Existing sample charts and estimates are fictional and should not be interpreted as historical realized investment returns.

## Running locally

```bash
npm install
npm run typecheck
npm test
npm run build
npx playwright install --with-deps chromium
npm run test:e2e
```

The browser test suite starts a Vite development server automatically. GitHub Actions retains traces/screenshots on failures.

## Final release verdict

Do not mark this phase **PASS** until **every CI job**, including Chromium e2e, and GitHub Pages deployment shows **success for the same SHA**. When this happens, status is **Frontend release certified for illustrative demonstration**, not production financial system readiness.

## Roadmap after frontend release

**Backend architecture → canonical Personal Kernel identity → tenant/user-scoped durable persistence → Finance OS and Asset OS authoritative read contracts → Company/Family/Legacy scopes → secure policy engine & auditable approval records → provider reconciliation → security assessment → staging UAT → production rollout.**
