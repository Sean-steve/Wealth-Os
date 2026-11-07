#!/usr/bin/env python3
"""Seed one LOCAL_TEST_ONLY tenant and human binding after schema migrations.
It does NOT create real Person Kernel identity, provider consents, or financial data.
"""
from __future__ import annotations
import json
import os
from pathlib import Path
import subprocess
import sys
from urllib.parse import urlsplit, unquote

ROOT = Path(__file__).resolve().parents[2]
STATE_PATH = ROOT / ".local" / "wealth-os" / "state.json"
ENV_PATH = ROOT / "apps" / "api" / ".env"


def read_env(path: Path) -> dict[str, str]:
    out = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip() or line.lstrip().startswith("#"):
            continue
        if "=" not in line:
            raise RuntimeError("Invalid local environment file format.")
        key, value = line.split("=", 1)
        out[key] = value
    return out


def sql_literal(s: str) -> str:
    return "'" + s.replace("'", "''") + "'"


def provision(state: dict[str, object], db_url: str) -> None:
    if state.get("testOnly") is not True or state.get("database") != "wealth_os_local":
        raise RuntimeError("Refusing to provision a non-L1 or non-test database.")
    parsed = urlsplit(db_url)
    if (parsed.hostname != "127.0.0.1" or parsed.path != "/wealth_os_local"
        or parsed.username != "wealth_os_local_migrator"):
        raise RuntimeError("Refusing non-loopback/non-L1 database credentials.")
    if not parsed.password:
        raise RuntimeError("Migrator password is missing.")
    tenant = sql_literal(str(state["tenantId"]))
    subject = sql_literal(str(state["userSub"]))
    # Explicitly marked local identity proof; never a real Personal Kernel assertion.
    script = f"""
BEGIN;
DO $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM wealth_core.schema_migrations
                 WHERE version='006_local_oidc_dev_boundary.sql') THEN
  RAISE EXCEPTION 'Run all versioned Wealth OS migrations before provisioning.';
 END IF;
END $$;
INSERT INTO wealth_auth.tenants (id,external_person_ref,label)
VALUES ({tenant}::uuid,'local-test-person','LOCAL TEST ONLY — never financial truth')
ON CONFLICT (id) DO NOTHING;
INSERT INTO wealth_auth.tenant_memberships (tenant_id,subject_id,role,status)
VALUES ({tenant}::uuid,{subject},'OWNER','ACTIVE')
ON CONFLICT (tenant_id,subject_id) DO NOTHING;
INSERT INTO wealth_auth.identity_bindings
 (tenant_id,issuer,subject_id,kernel_person_ref,state,proof_reference,verified_at)
VALUES ({tenant}::uuid,'http://127.0.0.1:{state["oidcPort"]}/realms/wealth-os-local',
 {subject},'local-test-person','ACTIVE','LOCAL_TEST_IDENTITY_NOT_KERNEL_VERIFIED',now())
ON CONFLICT (tenant_id,issuer,subject_id) DO NOTHING;
COMMIT;
"""
    env = dict(os.environ)
    env["PGPASSWORD"] = unquote(parsed.password)
    args = ["psql", "-X", "-w", "-v", "ON_ERROR_STOP=1", "-q",
            "-h", "127.0.0.1", "-p", str(parsed.port or 5432),
            "-U", parsed.username, "-d", "wealth_os_local"]
    result = subprocess.run(args, input=script, env=env, text=True, capture_output=True)
    if result.returncode:
        raise RuntimeError("Local tenant provisioning failed. Verify migrations and "
                           "existing PostgreSQL permissions; no real identity was authorized.")


def main() -> int:
    if not STATE_PATH.is_file() or not ENV_PATH.is_file():
        raise RuntimeError("Run scripts/local/setup.py and local migrations first.")
    state = json.loads(STATE_PATH.read_text(encoding="utf-8"))
    url = read_env(ENV_PATH).get("WEALTH_MIGRATOR_DATABASE_URL", "")
    provision(state, url)
    print("LOCAL_TEST_TENANT_BOUND (NOT A REAL KERNEL PERSON)")
    print("Tenant:", state["tenantId"])
    print("Identity realm: wealth-os-local. No source consents or fake balances added.")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, RuntimeError, KeyError, ValueError) as error:
        print("LOCAL_PROVISION_BLOCKED:", str(error), file=sys.stderr)
        raise SystemExit(2)
