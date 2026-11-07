# Wealth OS Backend B0

Isolated TypeScript/Fastify/PostgreSQL API. The static Vite frontend remains deployed independently on GitHub Pages.

Documentation: `../../docs/PHASE_B0.md`.

## Commands
```
docker compose -f apps/api/compose.yaml up -d
npm install --prefix apps/api
cp apps/api/.env.example apps/api/.env
set -a; . apps/api/.env; set +a
npm run db:migrate --prefix apps/api
npm run typecheck --prefix apps/api
npm run test:all --prefix apps/api
npm run start --prefix apps/api
```

No built-in fake JWT issuer. Protected API requires real OIDC trust configuration and admin-provisioned tenant/membership. Test verifier is only dependency-injected into the isolated Vitest process.

API contracts: `contracts/openapi.yaml`, `contracts/events.schema.json`. Schema: `db/migrations/`.

**Do not connect real financial accounts or enter secrets into the sample frontend.**

## L1 — Existing Ubuntu PostgreSQL (not Docker DB)

Run from the repository root: `python3 scripts/local/setup.py --pg-port 5432` (or actual PostgreSQL port); `npm run local:migrate --prefix apps/api`; `python3 scripts/local/provision_identity.py`. Start **only** Keycloak using `npm run local:identity:up`, then `npm run local:api --prefix apps/api`, and `npm run local:certify --prefix apps/api`. The local API uses Node 22 `--env-file=.env`. Run `npm run local:test --prefix apps/api` to load the PostgreSQL URLs and execute the integration suite rather than skipping it. See `../../docs/PHASE_L1.md`.
