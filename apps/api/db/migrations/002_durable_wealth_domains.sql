-- B1-002: Durable planning, append-only strategy history, and explicit source completeness.
-- Migration is intentionally data-preserving; no synthetic financial history is seeded.
ALTER TABLE wealth_planning.goal_milestones
 ADD COLUMN version BIGINT NOT NULL DEFAULT 1 CHECK(version > 0),
 ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 ADD COLUMN created_by_subject TEXT NOT NULL DEFAULT 'legacy-unattributed';

ALTER TABLE wealth_planning.strategy_versions
 ADD CONSTRAINT strategy_allocations_nonempty CHECK(jsonb_array_length(allocation_targets)>0);

-- Strategy versions remain immutable. Current pointers live in a separate row.
CREATE TABLE wealth_planning.strategy_heads (
 tenant_id UUID NOT NULL REFERENCES wealth_auth.tenants(id),
 strategy_id UUID NOT NULL,
 goal_id UUID NOT NULL,
 latest_version INTEGER NOT NULL CHECK(latest_version > 0),
 active_version INTEGER,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,strategy_id),
 FOREIGN KEY(tenant_id,goal_id) REFERENCES wealth_planning.goals(tenant_id,id),
 FOREIGN KEY(tenant_id,strategy_id,latest_version)
  REFERENCES wealth_planning.strategy_versions(tenant_id,strategy_id,version),
 FOREIGN KEY(tenant_id,strategy_id,active_version)
  REFERENCES wealth_planning.strategy_versions(tenant_id,strategy_id,version),
 CHECK(active_version IS NULL OR active_version<=latest_version)
);
CREATE INDEX strategy_heads_goal ON wealth_planning.strategy_heads(tenant_id,goal_id);

ALTER TABLE wealth_capital.allocation_proposals
 ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 ADD COLUMN created_by_subject TEXT NOT NULL DEFAULT 'legacy-unattributed';
CREATE INDEX allocation_proposals_pool_active ON wealth_capital.allocation_proposals(tenant_id,pool_id,status)
 WHERE status IN ('DRAFT','UNDER_REVIEW','PLANNING_ACKNOWLEDGED');

-- Presence of reliable source evidence is separate from asset numbers; B1 does NOT ingest events.
-- The migrator or future trusted adapter may set source watermarks after independent reconciliation.
CREATE TABLE wealth_integration.source_watermarks (
 tenant_id UUID NOT NULL REFERENCES wealth_auth.tenants(id),
 source_system TEXT NOT NULL CHECK(source_system IN ('Finance OS','Asset OS','Company OS')),
 source_revision TEXT NOT NULL CHECK(length(source_revision)>0),
 as_of TIMESTAMPTZ NOT NULL,
 complete BOOLEAN NOT NULL DEFAULT false,
 evidence JSONB NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(evidence)='object'),
 received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,source_system),
 CHECK(as_of<=received_at+interval '5 minutes')
);

-- Enforce append-only events and version records via privileges, not fabricated claims of WORM.
-- FORCE RLS also applies to every table introduced by this migration.
ALTER TABLE wealth_planning.strategy_heads ENABLE ROW LEVEL SECURITY;
ALTER TABLE wealth_planning.strategy_heads FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON wealth_planning.strategy_heads
 USING (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid)
 WITH CHECK (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);
ALTER TABLE wealth_integration.source_watermarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE wealth_integration.source_watermarks FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_scope ON wealth_integration.source_watermarks
 USING (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid)
 WITH CHECK (tenant_id=nullif(current_setting('app.tenant_id',true),'')::uuid);

DO $$
BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='wealth_app') THEN
  GRANT SELECT,INSERT,UPDATE ON wealth_planning.strategy_heads TO wealth_app;
  GRANT SELECT ON wealth_integration.source_watermarks TO wealth_app;
  GRANT SELECT,INSERT,UPDATE ON wealth_capital.allocation_proposals TO wealth_app;
 END IF;
END $$;
