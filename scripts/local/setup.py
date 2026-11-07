#!/usr/bin/env python3
"""Wealth OS L1 bootstrap. Uses existing Ubuntu PostgreSQL; never runs a DB container."""
from __future__ import annotations
import argparse
import json
import os
from pathlib import Path
import secrets
import shutil
import subprocess
import sys
from urllib.parse import quote
from uuid import uuid4

ROOT = Path(__file__).resolve().parents[2]
LOCAL = ROOT / ".local" / "wealth-os"
API_ENV = ROOT / "apps" / "api" / ".env"
FRONT_ENV = ROOT / ".env.local"
STATE = LOCAL / "state.json"
ROLE_NAMES = ("wealth_os_local_migrator", "wealth_app", "wealth_ingest")
DATABASE = "wealth_os_local"
REALM = "wealth-os-local"


def sql_literal(text: str) -> str:
    return "'" + text.replace("'", "''") + "'"


def safe_port(raw: str) -> int:
    value = int(raw)
    if not (1 <= value <= 65535):
        raise ValueError("PostgreSQL port must be 1–65535")
    return value


def checked_run(args: list[str], *, sql: str | None = None, password: str | None = None) -> str:
    env = dict(os.environ)
    if password:
        env["PGPASSWORD"] = password
    result = subprocess.run(args, input=sql, text=True, capture_output=True, env=env, check=False)
    if result.returncode:
        # Avoid printing SQL commands containing generated passwords or full connection strings.
        raise RuntimeError("Command failed: " + " ".join(x for x in args if "password" not in x.lower())
                           + ". Check Ubuntu PostgreSQL authentication/role conflicts.")
    return result.stdout.strip()


def sudo_psql(port: int, query: str) -> str:
    return checked_run(
        ["sudo", "-u", "postgres", "psql", "-X", "-w", "-p", str(port),
         "-U", "postgres", "-d", "postgres", "-t", "-A", "-v", "ON_ERROR_STOP=1"],
        sql=query
    )


def ensure_new_pg(port: int) -> None:
    flags = sudo_psql(port, "SELECT rolname FROM pg_roles WHERE rolname IN ('wealth_app',"
                        "'wealth_ingest','wealth_os_local_migrator') ORDER BY rolname;")
    db = sudo_psql(port, "SELECT datname FROM pg_database WHERE datname='wealth_os_local';")
    if flags or db:
        raise RuntimeError(
            "Refusing to overwrite existing PostgreSQL roles/database without L1 ownership metadata. "
            "Existing: " + (", ".join(flags.splitlines()) if flags else "no roles") +
            ("; wealth_os_local exists" if db else "")
            + ". Other projects remain untouched. Inspect roles and choose a clean PostgreSQL instance."
        )


def create_pg(port: int, passwords: dict[str, str]) -> None:
    # Superuser SQL is piped on STDIN. Nothing containing credentials is echoed.
    statements = [
        f"CREATE ROLE {name} LOGIN PASSWORD {sql_literal(passwords[name])} "
        "NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;"
        for name in ROLE_NAMES
    ]
    statements += [
        "CREATE DATABASE wealth_os_local OWNER wealth_os_local_migrator;",
        "GRANT CONNECT ON DATABASE wealth_os_local TO wealth_app, wealth_ingest;",
    ]
    sudo_psql(port, "\n".join(statements))


def db_url(role: str, password: str, port: int) -> str:
    return f"postgresql://{role}:{quote(password, safe='')}@127.0.0.1:{port}/{DATABASE}"


def realm_template(user_id: str, user_password: str, admin_client_secret: str) -> dict:
    scopes = [
        {"name": name, "protocol": "openid-connect", "attributes": {
            "include.in.token.scope": "true", "display.on.consent.screen": "false"}}
        for name in ("wealth:read", "wealth:write", "wealth:ingest")
    ]
    return {
        "realm": REALM, "enabled": True,
        "displayName": "Wealth OS local TEST realm — never use real finances",
        "sslRequired": "none", "registrationAllowed": False,
        "resetPasswordAllowed": False, "verifyEmail": False,
        "accessTokenLifespan": 300, "loginWithEmailAllowed": False,
        "clientScopes": scopes,
        "clients": [
            {"clientId": "wealth-os-api", "enabled": True, "publicClient": False,
             "standardFlowEnabled": False, "serviceAccountsEnabled": False,
             "directAccessGrantsEnabled": False, "protocol": "openid-connect"},
            {"clientId": "wealth-os-source-ingest", "enabled": True, "publicClient": False,
             "standardFlowEnabled": False, "serviceAccountsEnabled": False,
             "directAccessGrantsEnabled": False, "protocol": "openid-connect"},
            {"clientId": "wealth-os-local-spa", "enabled": True, "publicClient": True,
             "standardFlowEnabled": True, "directAccessGrantsEnabled": True,
             "serviceAccountsEnabled": False,
             "redirectUris": ["http://localhost:5173/Wealth-Os/*",
                              "http://127.0.0.1:5173/Wealth-Os/*",
                              "http://127.0.0.1:4173/Wealth-Os/*"],
             "webOrigins": ["http://localhost:5173", "http://127.0.0.1:5173",
                             "http://127.0.0.1:4173"],
             "attributes": {"pkce.code.challenge.method": "S256"},
             "defaultClientScopes": ["basic", "web-origins", "roles", "profile", "email",
                                     "wealth:read", "wealth:write"],
             "protocolMappers": [
                 {"name": "wealth-api-audience", "protocol": "openid-connect",
                  "protocolMapper": "oidc-audience-mapper", "consentRequired": False,
                  "config": {"included.client.audience": "wealth-os-api",
                             "id.token.claim": "false", "access.token.claim": "true"}},
                 {"name": "local-user-subject-claim", "protocol": "openid-connect",
                  "protocolMapper": "oidc-sub-mapper", "consentRequired": False,
                  "config": {"access.token.claim": "true", "introspection.token.claim": "true"}}
             ],
             "protocol": "openid-connect"},
            {"clientId": "wealth-os-local-source", "enabled": True, "publicClient": False,
             "secret": admin_client_secret, "standardFlowEnabled": False,
             "directAccessGrantsEnabled": False, "serviceAccountsEnabled": True,
             "defaultClientScopes": ["basic", "roles", "profile", "wealth:ingest"],
             "protocolMappers": [{"name": "wealth-source-audience",
                                  "protocol": "openid-connect",
                                  "protocolMapper": "oidc-audience-mapper",
                                  "consentRequired": False,
                                  "config": {"included.client.audience": "wealth-os-source-ingest",
                                             "id.token.claim": "false",
                                             "access.token.claim": "true"}}],
             "protocol": "openid-connect"},
        ],
        "users": [
            {"id": user_id, "username": "wealth-local-tester",
             "enabled": True, "emailVerified": True,
             "email": "wealth-local-tester@example.invalid",
             "credentials": [{"type": "password", "value": user_password, "temporary": False}],
             "firstName": "Local", "lastName": "Test"}
        ]
    }


def write_secret(path: Path, content: str) -> None:
    if path.exists():
        raise RuntimeError("Refusing to overwrite existing local secret/config: " + str(path))
    flags = os.O_CREAT | os.O_WRONLY | os.O_EXCL
    fd = os.open(path, flags, 0o600)
    with os.fdopen(fd, "w", encoding="utf8") as handle:
        handle.write(content)
    path.chmod(0o600)


def main() -> int:
    parser = argparse.ArgumentParser(description="Wealth OS local-only existing PostgreSQL bootstrap")
    parser.add_argument("--pg-port", type=safe_port, default=5432)
    parser.add_argument("--oidc-port", type=safe_port, default=8181)
    args = parser.parse_args()
    if sys.platform != "linux":
        raise RuntimeError("Only Ubuntu/Linux workstation bootstrap is supported.")
    if not all(shutil.which(x) for x in ("sudo", "psql", "python3")):
        raise RuntimeError("Install Ubuntu PostgreSQL client (psql), Python3 and sudo.")
    if STATE.exists():
        saved = json.loads(STATE.read_text())
        if saved.get("testOnly") is not True:
            raise RuntimeError("Existing state is not confirmed as test-only.")
        print("LOCAL_SETUP_ALREADY_EXISTS — no passwords/database changed.")
        print("Tenant:", saved["tenantId"], "PostgreSQL port:", saved["postgresPort"])
        print("Run: npm run local:migrate --prefix apps/api")
        return 0
    if any(p.exists() for p in (API_ENV, FRONT_ENV, LOCAL / "keycloak" / "realm.json")):
        raise RuntimeError("Refusing to replace existing .env or local identity. "
                           "Review/backup those files manually before running L1 bootstrap.")
    if args.oidc_port == args.pg_port:
        raise RuntimeError("Identity and PostgreSQL ports must not overlap.")
    # Authenticate sudo and confirm version+dedicated names before creating anything.
    checked_run(["sudo", "-v"])
    version = int(sudo_psql(args.pg_port, "SHOW server_version_num;"))
    if version < 160000:
        raise RuntimeError("Wealth OS L1 requires PostgreSQL 16+; detected an older server.")
    ensure_new_pg(args.pg_port)
    passwords = {role: secrets.token_urlsafe(38) for role in ROLE_NAMES}
    test_pass = secrets.token_urlsafe(22)
    admin_pass = secrets.token_urlsafe(28)
    source_pass = secrets.token_urlsafe(28)
    user_id, tenant_id = str(uuid4()), str(uuid4())
    # Namespaced folders are never mounted in external projects.
    create_pg(args.pg_port, passwords)
    (LOCAL / "keycloak").mkdir(parents=True, mode=0o700, exist_ok=False)
    (LOCAL / "keycloak" / "data" / "import").mkdir(parents=True, mode=0o700, exist_ok=False)
    (LOCAL / "keycloak" / "data").chmod(0o700)
    api = [
        "# WEALTH OS LOCAL TEST ONLY; never deploy this file.",
        "RUNTIME_MODE=development", "HOST=127.0.0.1", "PORT=3009",
        f"WEALTH_APP_DATABASE_URL={db_url('wealth_app',passwords['wealth_app'],args.pg_port)}",
        f"WEALTH_MIGRATOR_DATABASE_URL={db_url('wealth_os_local_migrator',passwords['wealth_os_local_migrator'],args.pg_port)}",
        f"WEALTH_INGEST_DATABASE_URL={db_url('wealth_ingest',passwords['wealth_ingest'],args.pg_port)}",
        f"OIDC_ISSUER=http://127.0.0.1:{args.oidc_port}/realms/{REALM}",
        f"OIDC_JWKS_URL=http://127.0.0.1:{args.oidc_port}/realms/{REALM}/protocol/openid-connect/certs",
        "OIDC_AUDIENCE=wealth-os-api",
        f"INTEGRATION_OIDC_ISSUER=http://127.0.0.1:{args.oidc_port}/realms/{REALM}",
        f"INTEGRATION_OIDC_JWKS_URL=http://127.0.0.1:{args.oidc_port}/realms/{REALM}/protocol/openid-connect/certs",
        "INTEGRATION_OIDC_AUDIENCE=wealth-os-source-ingest",
        "CORS_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,http://127.0.0.1:4173",
        "OIDC_REQUIRE_VERIFIED_EMAIL=false",
    ]
    write_secret(API_ENV, "\n".join(api) + "\n")
    front = [
        "# L1 local TEST identity; NEVER paste bearer tokens here.",
        "VITE_WEALTH_API_URL=http://127.0.0.1:3009",
        f"VITE_WEALTH_OIDC_AUTHORIZE_URL=http://127.0.0.1:{args.oidc_port}/realms/{REALM}/protocol/openid-connect/auth",
        f"VITE_WEALTH_OIDC_TOKEN_URL=http://127.0.0.1:{args.oidc_port}/realms/{REALM}/protocol/openid-connect/token",
        "VITE_WEALTH_OIDC_CLIENT_ID=wealth-os-local-spa",
    ]
    write_secret(FRONT_ENV, "\n".join(front) + "\n")
    write_secret(LOCAL / "keycloak" / "realm.json",
                 json.dumps(realm_template(user_id, test_pass, source_pass), indent=2) + "\n")
    write_secret(LOCAL / "keycloak" / "admin.env",
                 "KC_BOOTSTRAP_ADMIN_USERNAME=wealth-local-admin\n"
                 f"KC_BOOTSTRAP_ADMIN_PASSWORD={admin_pass}\n")
    write_secret(LOCAL / "test-credentials.json", json.dumps({
        "testOnly": True, "username": "wealth-local-tester", "password": test_pass,
        "serviceClientId": "wealth-os-local-source", "serviceSecret": source_pass,
        "oidcPort": args.oidc_port}, indent=2) + "\n")
    write_secret(STATE, json.dumps({
        "testOnly": True, "tenantId": tenant_id, "userSub": user_id,
        "postgresPort": args.pg_port, "oidcPort": args.oidc_port,
        "database": DATABASE}, indent=2) + "\n")
    print("LOCAL_PG_PROVISIONED — separate database and restricted app/ingest roles.")
    print("Tenant ID (local test only):", tenant_id)
    print("No real user, assets, providers or consent has been provisioned.")
    print("Next: npm run local:migrate --prefix apps/api")
    print("Next: python3 scripts/local/provision_identity.py")
    print("Identity credentials (mode 600): .local/wealth-os/test-credentials.json")
    print("Your existing PostgreSQL server and other databases were left running.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (RuntimeError, ValueError, subprocess.SubprocessError, OSError) as error:
        print("LOCAL_SETUP_BLOCKED:", str(error), file=sys.stderr)
        raise SystemExit(2)
