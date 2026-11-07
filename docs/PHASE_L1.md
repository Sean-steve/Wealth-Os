# Phase L1 — Full Local Activation & Certification on Existing Ubuntu PostgreSQL

**Goal:** run the existing PostgreSQL service on your Ubuntu laptop without Dockerized PostgreSQL, launch an isolated local development Keycloak issuer, start the Wealth OS API and React frontend, and certify real database-backed flows using **only artificial test identity and planning data**. No real Personal Kernel, financial or Company/Finance/Asset sources are connected.

## Prerequisites

Ubuntu with **PostgreSQL 16+ already installed and running**, working `sudo -u postgres psql` peer access, `psql` CLI, Python 3, Node.js 22+, npm. Docker Compose is **only used for Keycloak identity**, not for the database. For users who already have a native test-only OIDC issuer, skip the container and update the dev-only issuer/client provisioning, but retain exact issuer, audiences, registered PKCE redirect and matching JWT subject. Run everything in your checked-out `Wealth-Os` folder. **Don't use production/personally sensitive financial data in this local test stack.**

### 0. Verify what is already running

```bash
cd ~/Sites/Wealth-Os  # or wherever you cloned the repository
node --version
python3 --version
sudo systemctl status postgresql --no-pager
sudo -u postgres psql -Atqc 'SHOW server_version;'
sudo -u postgres psql -Atqc 'SHOW port;'
```

If your local PostgreSQL runs on port **5433** (or another port), pass `--pg-port 5433` below. This does **not** stop or reconfigure any other running PostgreSQL instance. You do **not** need to launch `apps/api/compose.yaml`; that file starts a DIFFERENT Docker-based PostgreSQL and is intentionally **not used by L1**.

### 1. Bootstrap existing PostgreSQL (run once)

```bash
npm install --prefix apps/api --no-audit --no-fund
npm install --no-audit --no-fund

python3 scripts/local/setup.py --pg-port 5432
# or: python3 scripts/local/setup.py --pg-port 5433

npm run local:migrate --prefix apps/api
python3 scripts/local/provision_identity.py
```

The repository's sixth migration permits loopback HTTP OIDC **only** in the dedicated `wealth_os_local` database for explicitly marked `LOCAL_TEST_IDENTITY_NOT_KERNEL_VERIFIED` identities. All other databases retain strict HTTPS issuer bindings.\n\nThe bootstrap creates one database `wealth_os_local`, an owner/migration role `wealth_os_local_migrator`, and limited `wealth_app` and `wealth_ingest` roles with random generated passwords. It does not alter any other databases, nor does it change your PostgreSQL default port, config or other roles. Because migrations use these app-role names, the script **refuses** to proceed if those roles or the target database already exist **and aren't owned by the L1 setup**. It will not take over another project's roles. Run again only if the L1 marker exists; no passwords are reset.

Generated files, all gitignored and mode 600:

- `apps/api/.env` — local PostgreSQL URLs and OIDC API config;
- `.env.local` — non-secret local frontend settings;
- `.local/wealth-os/state.json` — tenant UUID and test subject ID;
- `.local/wealth-os/test-credentials.json` — test-only user password and source client secret;
- `.local/wealth-os/keycloak/realm.json` and `admin.env` — test-only Keycloak import/admin credentials.

**Do not commit, share or reuse these files for real data.** This generated local user is expressly **not a verified Personal Kernel identity**; the database record uses `LOCAL_TEST_IDENTITY_NOT_KERNEL_VERIFIED`.

If bootstrap fails halfway, inspect the dedicated database/roles with `sudo -u postgres psql` and resolve manually. It will not automatically drop/overwrite objects. Do not run `DROP ROLE` on another application's role.

### 2. Start Keycloak (identity only)

```bash
npm run local:identity:up

# Check that the local test identity provider is online:
curl -fsS http://127.0.0.1:8181/realms/wealth-os-local/.well-known/openid-configuration
```

On a slow laptop, this first startup can take time and memory. Docker hosts **only Keycloak**; PostgreSQL remains the existing native Ubuntu service. Keycloak is bound to `127.0.0.1:8181`, not your public network interface. The test realm has a generated random login password, local-only redirect URIs and PKCE S256. Its direct-grant flow is used **solely for automated local certification**, never for staging or production. For manual browser login, use the normal Authorization Code + PKCE redirect.

If Keycloak fails to start, check `docker compose -f deploy/local/identity.compose.yaml logs --tail=70`. Do not use a paid identity provider or deploy Keycloak publicly merely for this test.

If you configured `--oidc-port <port>` during setup, set `WEALTH_LOCAL_OIDC_PORT=<port>` in the shell before starting Docker Compose.

### 3. Run the API (terminal 1)

```bash
npm run local:api --prefix apps/api
```

Check in another terminal:

```bash
curl -fsS http://127.0.0.1:3009/health
curl -fsS http://127.0.0.1:3009/ready
```

Expected `/ready` body includes `{"status":"ready","database":"migrated"}`. The API connects to `wealth_os_local` using the non-superuser `wealth_app` role. The separate `wealth_ingest` role cannot edit Wealth OS planning goals or human identity bindings.

### 4. Run React (terminal 2)

```bash
npm run dev
```

Open **http://localhost:5173/Wealth-Os/**. The global authority switch offers a **Fictional Sample** frontend and a **Connected Authority** workspace. Select Connected, choose **Sign in via OIDC**, and use the locally generated test username/password:

```bash
cat .local/wealth-os/test-credentials.json
cat .local/wealth-os/state.json
```

Enter the `tenantId` UUID from `state.json`. You can now create a real **locally persisted** Wealth Profile, Goal, Milestone and Strategy using the form UI; profile/goals persist across browser refreshes, but access tokens stay in memory and a refresh requires signing in again.

**Expected behavior:** `/state` returns `INCOMPLETE` and `netWorth:null`; Finance OS, Asset OS and Company OS statuses show missing consent. This is a **correct security result**. There are no locally verified financial sources and there must be no invented net worth. Some advisory/forecast/governance frontend screens remain sample-only rather than backend-integrated.

### 5. Certify the complete *implemented* local workflow (terminal 3)

```bash
# Signed local Keycloak JWTs, API, tenant isolation and durable write/read workflows:
npm run local:certify --prefix apps/api

# Complete backend units + real PostgreSQL integration suite (NOT skipped):
npm run local:test --prefix apps/api

# Frontend build and functional tests:
npm run typecheck
npm test
npm run build
# Real local Keycloak + browser PKCE flow:
npx playwright install chromium
WEALTH_L1_E2E=yes npx playwright test tests/e2e/local-identity.spec.ts

# The regular sample-screen browser suite assumes a frontend without
# .env.local identity configuration; run it in a clean sample-only environment.
```

The first command checks Keycloak-signed user/service JWTs, audience separation, active tenant binding, wrong-tenant rejection, API health/ready, real PostgreSQL profile/goals/milestone/strategy persistence, idempotence and withheld net worth for incomplete sources. It writes **test-only planning records** to the local development database, not to actual financial providers. Repeated runs add new explicitly marked test goals. Never run it against a real person's tenant or production API.

The integration suite uses its own deterministic dependency-injected test subjects and real PostgreSQL, with additional CI-only fixture records; it never claims a real HumanKernelOS identity. The CI suite uses isolated ephemeral PostgreSQL too.

### 6. Finish and stop only Wealth OS services

```bash
# Stop API and Vite in their own terminals (Ctrl+C).
npm run local:identity:down
```

This stops **only the Wealth OS local Keycloak container**, not your native PostgreSQL, Redis, Deetoo, HumanKernelOS or other applications. The development database remains in PostgreSQL and Keycloak container data is kept in its named Docker volume for later testing.

## Why this is local testing, not production activation

The local realm is deliberately a development-only Keycloak issuer using loopback HTTP and no real MFA. Real OIDC JWT verification is enabled: no unsigned/debug JWT is accepted. Production/staging still requires pinned **HTTPS** identity, provider-proven MFA, verified email and independently authorized producer identities. Local database authorization proves backend behavior; it does not confirm that financial source valuations or ownership are genuine.

**L1 cannot be pronounced tested on your Ubuntu laptop until you execute the setup and post the local certification output.** GitHub CI only certifies equivalent code pathways and local setup syntax, not your machine's installed PostgreSQL, ports or services.

## Troubleshooting

| Symptom | Resolution |
| --- | --- |
| PostgreSQL port is busy | Use `sudo -u postgres psql -Atqc 'SHOW port;'` and pass `--pg-port <actual>`. Don't stop Deetoo's PostgreSQL. |
| Role/database already exists | Bootstrap stops intentionally. Inspect whether Wealth OS owns it; it will not overwrite another application's role. |
| `sudo: ...` / peer authentication fails | Ensure local Ubuntu user has sudo rights, PostgreSQL service is up and `sudo -u postgres psql` works. |
| Migration password failure | Confirm `apps/api/.env` was generated by setup and no old Docker-based URLs were copied into it. |
| Keycloak realm not accessible | Ensure Docker is installed, port 8181 is free, and test-only realm import completed; inspect container logs. |
| 401 human token | Issuer/audience/JWKS or realm user differs; restart local Keycloak if the DB identity was changed. |
| 403 `KERNEL_IDENTITY_UNBOUND` | Provision local test tenant after migrations and use exact tenant UUID from `state.json`. |
| Connected Workspace says "not configured" | Confirm `.env.local` exists and restart Vite (build-time env vars are loaded at startup). |
| 403 on a finance source | Expected without real subject-approved source consent and a bound service producer. |
| 500 or backend tests skipped | Use `npm run local:test --prefix apps/api` and ensure the database migrator URL is loaded. |

**Local completion gate:** real local PostgreSQL ready, browser signs into the local test Keycloak realm, user-bound Profile + Goal + Milestone + Strategy writes persist, source data remains null/untrusted, and test reports PASS. Production is still blocked on real identities, signed source publishers, staging and data-governance evidence.
