-- B2-004: issuer-bound human identity and producer-owned source snapshots.
-- Requires administrator-provisioned bindings; NEVER backfills synthetic verified identities.
CREATE TABLE wealth_auth.identity_bindings (
 tenant_id UUID NOT NULL REFERENCES wealth_auth.tenants(id),
 issuer TEXT NOT NULL CHECK(issuer ~ '^https://'),
 subject_id TEXT NOT NULL CHECK(length(subject_id) BETWEEN 1 AND 255),
 kernel_person_ref TEXT NOT NULL CHECK(length(kernel_person_ref) BETWEEN 3 AND 255),
 state TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(state IN ('ACTIVE','REVOKED')),
 proof_reference TEXT NOT NULL CHECK(length(proof_reference) BETWEEN 5 AND 400),
 verified_at TIMESTAMPTZ NOT NULL,
 revoked_at TIMESTAMPTZ,
 PRIMARY KEY(tenant_id,issuer,subject_id),
 FOREIGN KEY(tenant_id,subject_id) REFERENCES wealth_auth.tenant_memberships(tenant_id,subject_id),
 CHECK((state='ACTIVE' AND revoked_at IS NULL) OR state='REVOKED')
);
CREATE INDEX identity_binding_subject ON wealth_auth.identity_bindings(issuer,subject_id,state);

CREATE TABLE wealth_integration.source_grants (
 tenant_id UUID NOT NULL REFERENCES wealth_auth.tenants(id),
 source_system TEXT NOT NULL CHECK(source_system IN ('Finance OS','Asset OS','Company OS')),
 producer_issuer TEXT NOT NULL CHECK(producer_issuer ~ '^https://'),
 producer_subject TEXT NOT NULL CHECK(length(producer_subject) BETWEEN 3 AND 255),
 authorized_subject TEXT NOT NULL,
 authorized_issuer TEXT NOT NULL,
 source_person_ref TEXT NOT NULL CHECK(length(source_person_ref) BETWEEN 3 AND 255),
 state TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(state IN ('ACTIVE','REVOKED')),
 proof_reference TEXT NOT NULL CHECK(length(proof_reference) BETWEEN 5 AND 400),
 provisioned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 revoked_at TIMESTAMPTZ,
 PRIMARY KEY(tenant_id,source_system),
 FOREIGN KEY(tenant_id,authorized_issuer,authorized_subject)
  REFERENCES wealth_auth.identity_bindings(tenant_id,issuer,subject_id)
);
CREATE INDEX source_grants_producer ON wealth_integration.source_grants(source_system,producer_issuer,producer_subject,state);

CREATE TABLE wealth_integration.source_ingestions (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id UUID NOT NULL REFERENCES wealth_auth.tenants(id),
 source_system TEXT NOT NULL CHECK(source_system IN ('Finance OS','Asset OS','Company OS')),
 producer_issuer TEXT NOT NULL,
 producer_subject TEXT NOT NULL,
 source_event_id UUID NOT NULL,
 source_revision TEXT NOT NULL CHECK(length(source_revision) BETWEEN 1 AND 150),
 snapshot_hash TEXT NOT NULL CHECK(length(snapshot_hash)=64),
 source_as_of TIMESTAMPTZ NOT NULL,
 record_counts JSONB NOT NULL CHECK(jsonb_typeof(record_counts)='object'),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,source_system,source_event_id),
 UNIQUE(tenant_id,source_system,source_revision)
);
CREATE INDEX source_ingestions_history ON wealth_integration.source_ingestions(tenant_id,source_system,created_at DESC);

ALTER TABLE wealth_portfolio.holdings ADD COLUMN canonical_asset_ref TEXT
 CHECK(canonical_asset_ref IS NULL OR length(canonical_asset_ref) BETWEEN 3 AND 180);
ALTER TABLE wealth_portfolio.holdings ADD COLUMN source_active BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE wealth_capital.pools ADD COLUMN source_active BOOLEAN NOT NULL DEFAULT true;
-- Cross-source duplicate property/equity/cash references are explicitly rejected.
CREATE UNIQUE INDEX holdings_single_economic_asset
 ON wealth_portfolio.holdings(tenant_id,canonical_asset_ref) WHERE canonical_asset_ref IS NOT NULL AND source_active;
-- The entire Finance OS pool classification has one canonical source reference per tenant.
CREATE UNIQUE INDEX pools_source_ref_unique
 ON wealth_capital.pools(tenant_id,source_entity_ref) WHERE source_entity_ref IS NOT NULL;
ALTER TABLE wealth_integration.source_watermarks
 ADD COLUMN producer_subject TEXT,
 ADD COLUMN snapshot_hash TEXT CHECK(snapshot_hash IS NULL OR length(snapshot_hash)=64);

-- RLS on newly introduced tenant tables (app and ingestion roles cannot BYPASSRLS).
DO $$
DECLARE tab TEXT;
BEGIN
 FOREACH tab IN ARRAY ARRAY['identity_bindings'] LOOP
  EXECUTE format('ALTER TABLE wealth_auth.%I ENABLE ROW LEVEL SECURITY',tab);
  EXECUTE format('ALTER TABLE wealth_auth.%I FORCE ROW LEVEL SECURITY',tab);
  EXECUTE format('CREATE POLICY tenant_scope ON wealth_auth.%I USING (tenant_id=nullif(current_setting(''app.tenant_id'',true),'''')::uuid) WITH CHECK (tenant_id=nullif(current_setting(''app.tenant_id'',true),'''')::uuid)',tab);
 END LOOP;
 FOREACH tab IN ARRAY ARRAY['source_grants','source_ingestions'] LOOP
  EXECUTE format('ALTER TABLE wealth_integration.%I ENABLE ROW LEVEL SECURITY',tab);
  EXECUTE format('ALTER TABLE wealth_integration.%I FORCE ROW LEVEL SECURITY',tab);
  EXECUTE format('CREATE POLICY tenant_scope ON wealth_integration.%I USING (tenant_id=nullif(current_setting(''app.tenant_id'',true),'''')::uuid) WITH CHECK (tenant_id=nullif(current_setting(''app.tenant_id'',true),'''')::uuid)',tab);
 END LOOP;
END $$;
DO $$
BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='wealth_app') THEN
  GRANT SELECT ON wealth_auth.identity_bindings TO wealth_app;
  GRANT SELECT ON wealth_integration.source_grants,wealth_integration.source_ingestions TO wealth_app;
 END IF;
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='wealth_ingest') THEN
  GRANT USAGE ON SCHEMA wealth_auth,wealth_integration,wealth_portfolio,wealth_capital,wealth_audit TO wealth_ingest;
  GRANT SELECT ON wealth_auth.tenants,wealth_auth.identity_bindings,
    wealth_auth.tenant_memberships,wealth_auth.consent_grants TO wealth_ingest;
  GRANT SELECT ON wealth_integration.source_grants TO wealth_ingest;
  GRANT SELECT,INSERT ON wealth_integration.source_ingestions TO wealth_ingest;
  GRANT SELECT,INSERT,UPDATE ON wealth_integration.source_watermarks TO wealth_ingest;
  GRANT SELECT,INSERT,UPDATE,DELETE ON wealth_portfolio.holdings,
    wealth_portfolio.income_projections,wealth_portfolio.liability_projections,
    wealth_capital.pools TO wealth_ingest;
  GRANT SELECT,INSERT ON wealth_audit.audit_events TO wealth_ingest;
  GRANT SELECT,INSERT ON wealth_integration.outbox_events TO wealth_ingest;
 END IF;
END $$;
