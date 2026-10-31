-- B0-001: Wealth OS canonical schema. No bank/transaction execution tables.
-- Apply as an ADMIN/MIGRATOR role, never as wealth_app.
BEGIN;
CREATE SCHEMA IF NOT EXISTS wealth_auth;
CREATE SCHEMA IF NOT EXISTS wealth_core;
CREATE SCHEMA IF NOT EXISTS wealth_planning;
CREATE SCHEMA IF NOT EXISTS wealth_capital;
CREATE SCHEMA IF NOT EXISTS wealth_portfolio;
CREATE SCHEMA IF NOT EXISTS wealth_risk;
CREATE SCHEMA IF NOT EXISTS wealth_intelligence;
CREATE SCHEMA IF NOT EXISTS wealth_integration;
CREATE SCHEMA IF NOT EXISTS wealth_audit;

CREATE TABLE wealth_auth.tenants (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 external_person_ref TEXT NOT NULL, -- Personal Kernel reference, not a local identity authority
 label TEXT NOT NULL CHECK(length(label) BETWEEN 1 AND 120),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE wealth_auth.tenant_memberships (
 tenant_id UUID NOT NULL REFERENCES wealth_auth.tenants(id),
 subject_id TEXT NOT NULL CHECK(length(subject_id) BETWEEN 1 AND 255),
 role TEXT NOT NULL CHECK(role IN ('OWNER','ADVISOR','VIEWER')),
 status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','SUSPENDED','REVOKED')),
 granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,subject_id)
);
CREATE INDEX ON wealth_auth.tenant_memberships(subject_id,status);
CREATE TABLE wealth_auth.consent_grants (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id UUID NOT NULL REFERENCES wealth_auth.tenants(id),
 source_system TEXT NOT NULL CHECK(source_system IN ('Finance OS','Asset OS','Company OS','Family OS','Legacy OS')),
 purpose TEXT NOT NULL CHECK(length(purpose) BETWEEN 3 AND 250),
 scopes TEXT[] NOT NULL DEFAULT '{}',
 subject_id TEXT NOT NULL,
 effective_at TIMESTAMPTZ NOT NULL,
 expires_at TIMESTAMPTZ,
 revoked_at TIMESTAMPTZ,
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 CHECK(expires_at IS NULL OR expires_at>effective_at)
);
CREATE INDEX ON wealth_auth.consent_grants(tenant_id,source_system,subject_id);

CREATE TABLE wealth_core.wealth_profiles (
 tenant_id UUID PRIMARY KEY REFERENCES wealth_auth.tenants(id),
 base_currency CHAR(3) NOT NULL DEFAULT 'KES' CHECK(base_currency ~ '^[A-Z]{3}$'),
 wealth_stage TEXT NOT NULL DEFAULT 'BUILDING' CHECK(wealth_stage IN ('BUILDING','GROWING','PROTECTING','INDEPENDENT','LEGACY')),
 strategy_note TEXT NOT NULL DEFAULT '' CHECK(length(strategy_note)<=2000),
 version BIGINT NOT NULL DEFAULT 1 CHECK(version>0),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE wealth_core.wealth_policies (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id UUID NOT NULL REFERENCES wealth_auth.tenants(id),
 policy_kind TEXT NOT NULL CHECK(length(policy_kind) BETWEEN 3 AND 100),
 policy_version INTEGER NOT NULL CHECK(policy_version>0),
 rules JSONB NOT NULL CHECK(jsonb_typeof(rules)='object'),
 effective_from TIMESTAMPTZ NOT NULL,
 effective_until TIMESTAMPTZ,
 created_by_subject TEXT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,policy_kind,policy_version),
 CHECK(effective_until IS NULL OR effective_until>effective_from)
);

CREATE TABLE wealth_planning.goals (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id UUID NOT NULL REFERENCES wealth_auth.tenants(id),
 title TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 160),
 metric TEXT NOT NULL CHECK(metric IN ('NET_WORTH','LIQUID_WEALTH','PASSIVE_INCOME','DEPLOYABLE_CAPITAL','INVESTED_CAPITAL','CUSTOM')),
 target_amount NUMERIC(20,4) NOT NULL CHECK(target_amount>0),
 target_date DATE NOT NULL,
 priority TEXT NOT NULL DEFAULT 'MEDIUM' CHECK(priority IN ('LOW','MEDIUM','HIGH')),
 status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK(status IN ('ACTIVE','PAUSED','COMPLETED','ARCHIVED')),
 version BIGINT NOT NULL DEFAULT 1 CHECK(version>0),
 created_by_subject TEXT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,id)
);
CREATE INDEX ON wealth_planning.goals(tenant_id,status,created_at DESC,id DESC);
CREATE TABLE wealth_planning.goal_milestones (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id UUID NOT NULL REFERENCES wealth_auth.tenants(id),
 goal_id UUID NOT NULL,
 title TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 160),
 target_amount NUMERIC(20,4) NOT NULL CHECK(target_amount>0),
 due_date DATE NOT NULL,
 status TEXT NOT NULL DEFAULT 'PLANNED' CHECK(status IN ('PLANNED','REACHED','MISSED','CANCELLED')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 FOREIGN KEY(tenant_id,goal_id) REFERENCES wealth_planning.goals(tenant_id,id)
);
CREATE INDEX ON wealth_planning.goal_milestones(tenant_id,goal_id,due_date);
CREATE TABLE wealth_planning.strategy_versions (
 tenant_id UUID NOT NULL REFERENCES wealth_auth.tenants(id),
 strategy_id UUID NOT NULL,
 version INTEGER NOT NULL CHECK(version>0),
 goal_id UUID,
 name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 200),
 thesis TEXT NOT NULL DEFAULT '',
 allocation_targets JSONB NOT NULL DEFAULT '[]' CHECK(jsonb_typeof(allocation_targets)='array'),
 assumptions JSONB NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(assumptions)='object'),
 status TEXT NOT NULL CHECK(status IN ('DRAFT','ACTIVE','ARCHIVED')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 created_by_subject TEXT NOT NULL,
 PRIMARY KEY(tenant_id,strategy_id,version),
 FOREIGN KEY(tenant_id,goal_id) REFERENCES wealth_planning.goals(tenant_id,id)
);

CREATE TABLE wealth_capital.pools (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id UUID NOT NULL REFERENCES wealth_auth.tenants(id),
 name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 150),
 purpose TEXT NOT NULL,
 -- These are CLASSIFICATIONS of reconciled Finance OS cash, NOT a shadow ledger.
 classified_cash NUMERIC(20,4) NOT NULL DEFAULT 0 CHECK(classified_cash>=0),
 reserved_cash NUMERIC(20,4) NOT NULL DEFAULT 0 CHECK(reserved_cash>=0),
 committed_cash NUMERIC(20,4) NOT NULL DEFAULT 0 CHECK(committed_cash>=0),
 source_system TEXT NOT NULL DEFAULT 'Finance OS' CHECK(source_system='Finance OS'),
 source_entity_ref TEXT,
 source_as_of TIMESTAMPTZ,
 version BIGINT NOT NULL DEFAULT 1 CHECK(version>0),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 CHECK(reserved_cash+committed_cash<=classified_cash),
 UNIQUE(tenant_id,id)
);
CREATE TABLE wealth_capital.allocation_proposals (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id UUID NOT NULL REFERENCES wealth_auth.tenants(id),
 pool_id UUID NOT NULL,
 target TEXT NOT NULL,
 amount NUMERIC(20,4) NOT NULL CHECK(amount>0),
 status TEXT NOT NULL DEFAULT 'DRAFT' CHECK(status IN ('DRAFT','UNDER_REVIEW','PLANNING_ACKNOWLEDGED','CANCELLED')),
 policy_version INTEGER NOT NULL CHECK(policy_version>0),
 evidence_snapshot JSONB NOT NULL CHECK(jsonb_typeof(evidence_snapshot)='object'),
 version BIGINT NOT NULL DEFAULT 1 CHECK(version>0),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 FOREIGN KEY(tenant_id,pool_id) REFERENCES wealth_capital.pools(tenant_id,id)
);

CREATE TABLE wealth_portfolio.holdings (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id UUID NOT NULL REFERENCES wealth_auth.tenants(id),
 source_system TEXT NOT NULL CHECK(source_system IN ('Finance OS','Asset OS','Company OS')),
 source_entity_type TEXT NOT NULL CHECK(length(source_entity_type)>0),
 source_entity_id TEXT NOT NULL CHECK(length(source_entity_id)>0),
 category TEXT NOT NULL CHECK(category IN ('BUSINESS_EQUITY','PROPERTY','INVESTMENTS','CASH','OTHER')),
 owner_fraction NUMERIC(9,6) NOT NULL CHECK(owner_fraction>0 AND owner_fraction<=1),
 valuation_amount NUMERIC(20,4),
 valuation_currency CHAR(3),
 valuation_as_of TIMESTAMPTZ,
 valuation_method TEXT,
 provenance JSONB NOT NULL DEFAULT '{}' CHECK(jsonb_typeof(provenance)='object'),
 quality_status TEXT NOT NULL DEFAULT 'UNVERIFIED' CHECK(quality_status IN ('UNVERIFIED','ESTIMATED','VERIFIED','STALE')),
 source_version TEXT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,source_system,source_entity_type,source_entity_id),
 UNIQUE(tenant_id,id),
 CHECK((valuation_amount IS NULL AND valuation_currency IS NULL AND valuation_as_of IS NULL) OR
       (valuation_amount IS NOT NULL AND valuation_amount>=0 AND valuation_currency IS NOT NULL AND valuation_as_of IS NOT NULL))
);
CREATE INDEX ON wealth_portfolio.holdings(tenant_id,category);
CREATE TABLE wealth_portfolio.holding_valuations (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id UUID NOT NULL REFERENCES wealth_auth.tenants(id),
 holding_id UUID NOT NULL,
 valuation_amount NUMERIC(20,4) NOT NULL CHECK(valuation_amount>=0),
 currency CHAR(3) NOT NULL CHECK(currency ~ '^[A-Z]{3}$'),
 as_of TIMESTAMPTZ NOT NULL,
 source_version TEXT NOT NULL,
 evidence JSONB NOT NULL CHECK(jsonb_typeof(evidence)='object'),
 received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 FOREIGN KEY(tenant_id,holding_id) REFERENCES wealth_portfolio.holdings(tenant_id,id)
);
CREATE INDEX ON wealth_portfolio.holding_valuations(tenant_id,holding_id,as_of DESC);
CREATE TABLE wealth_portfolio.income_projections (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id UUID NOT NULL REFERENCES wealth_auth.tenants(id),
 source_system TEXT NOT NULL CHECK(source_system IN ('Finance OS','Company OS','Asset OS')),
 source_entity_id TEXT NOT NULL,
 monthly_amount NUMERIC(20,4) NOT NULL CHECK(monthly_amount>=0),
 currency CHAR(3) NOT NULL DEFAULT 'KES',
 passive BOOLEAN NOT NULL DEFAULT false,
 source_as_of TIMESTAMPTZ NOT NULL,
 provenance JSONB NOT NULL CHECK(jsonb_typeof(provenance)='object'),
 UNIQUE(tenant_id,source_system,source_entity_id)
);
CREATE TABLE wealth_portfolio.liability_projections (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id UUID NOT NULL REFERENCES wealth_auth.tenants(id),
 source_system TEXT NOT NULL DEFAULT 'Finance OS' CHECK(source_system='Finance OS'),
 source_entity_id TEXT NOT NULL,
 outstanding_amount NUMERIC(20,4) NOT NULL CHECK(outstanding_amount>=0),
 currency CHAR(3) NOT NULL DEFAULT 'KES',
 source_as_of TIMESTAMPTZ NOT NULL,
 provenance JSONB NOT NULL CHECK(jsonb_typeof(provenance)='object'),
 UNIQUE(tenant_id,source_system,source_entity_id)
);

CREATE TABLE wealth_risk.exposure_signals (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id UUID NOT NULL REFERENCES wealth_auth.tenants(id),
 rule_id TEXT NOT NULL,
 severity TEXT NOT NULL CHECK(severity IN ('OK','WATCH','HIGH')),
 observed_value NUMERIC(20,6),
 observed_at TIMESTAMPTZ NOT NULL,
 policy_version INTEGER NOT NULL CHECK(policy_version>0),
 evidence JSONB NOT NULL CHECK(jsonb_typeof(evidence)='object'),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON wealth_risk.exposure_signals(tenant_id,observed_at DESC);

CREATE TABLE wealth_intelligence.forecasts (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id UUID NOT NULL REFERENCES wealth_auth.tenants(id),
 model_id TEXT NOT NULL,
 model_version TEXT NOT NULL,
 assumptions JSONB NOT NULL CHECK(jsonb_typeof(assumptions)='object'),
 source_snapshot JSONB NOT NULL CHECK(jsonb_typeof(source_snapshot)='object'),
 results JSONB NOT NULL CHECK(jsonb_typeof(results)='object'),
 status TEXT NOT NULL DEFAULT 'ILLUSTRATIVE' CHECK(status IN ('ILLUSTRATIVE','VERIFIED_SOURCE')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE wealth_intelligence.scenarios (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id UUID NOT NULL REFERENCES wealth_auth.tenants(id),
 name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 180),
 assumptions JSONB NOT NULL CHECK(jsonb_typeof(assumptions)='object'),
 source_snapshot JSONB NOT NULL CHECK(jsonb_typeof(source_snapshot)='object'),
 outcome JSONB NOT NULL CHECK(jsonb_typeof(outcome)='object'),
 version INTEGER NOT NULL DEFAULT 1 CHECK(version>0),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE wealth_intelligence.recommendations (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id UUID NOT NULL REFERENCES wealth_auth.tenants(id),
 origin TEXT NOT NULL,
 proposal JSONB NOT NULL CHECK(jsonb_typeof(proposal)='object'),
 evidence JSONB NOT NULL CHECK(jsonb_typeof(evidence)='object'),
 policy_version INTEGER NOT NULL CHECK(policy_version>0),
 status TEXT NOT NULL DEFAULT 'PROPOSED' CHECK(status IN ('PROPOSED','REVIEWED','DECLINED','EXPIRED')),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 UNIQUE(tenant_id,id)
);
CREATE TABLE wealth_intelligence.decision_records (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id UUID NOT NULL REFERENCES wealth_auth.tenants(id),
 recommendation_id UUID,
 state TEXT NOT NULL DEFAULT 'DRAFT' CHECK(state IN ('DRAFT','UNDER_REVIEW','PLANNING_ACKNOWLEDGED','DECLINED','CLOSED')),
 rationale TEXT NOT NULL,
 evidence JSONB NOT NULL CHECK(jsonb_typeof(evidence)='object'),
 policy_version INTEGER NOT NULL CHECK(policy_version>0),
 version BIGINT NOT NULL DEFAULT 1 CHECK(version>0),
 created_by_subject TEXT NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 FOREIGN KEY(tenant_id,recommendation_id) REFERENCES wealth_intelligence.recommendations(tenant_id,id)
);

CREATE TABLE wealth_integration.outbox_events (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id UUID NOT NULL REFERENCES wealth_auth.tenants(id),
 event_type TEXT NOT NULL,
 event_version INTEGER NOT NULL CHECK(event_version>0),
 correlation_id UUID NOT NULL,
 causation_id UUID,
 actor_subject TEXT NOT NULL,
 payload JSONB NOT NULL CHECK(jsonb_typeof(payload)='object'),
 status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','DISPATCHED','FAILED')),
 attempt_count INTEGER NOT NULL DEFAULT 0 CHECK(attempt_count>=0),
 occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 published_at TIMESTAMPTZ
);
CREATE INDEX ON wealth_integration.outbox_events(tenant_id,status,occurred_at);
CREATE TABLE wealth_integration.inbox_receipts (
 tenant_id UUID NOT NULL REFERENCES wealth_auth.tenants(id),
 producer TEXT NOT NULL,
 event_id UUID NOT NULL,
 event_type TEXT NOT NULL,
 event_version INTEGER NOT NULL CHECK(event_version>0),
 received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY(tenant_id,producer,event_id)
);
CREATE TABLE wealth_integration.idempotency_keys (
 tenant_id UUID NOT NULL REFERENCES wealth_auth.tenants(id),
 key TEXT NOT NULL CHECK(length(key) BETWEEN 8 AND 128),
 actor_subject TEXT NOT NULL,
 request_hash TEXT NOT NULL CHECK(length(request_hash)=64),
 response_status INTEGER,
 response_body JSONB,
 response_headers JSONB,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 expires_at TIMESTAMPTZ NOT NULL DEFAULT (now()+interval '24 hours'),
 PRIMARY KEY(tenant_id,key),
 CHECK((response_status IS NULL AND response_body IS NULL) OR
       (response_status IS NOT NULL AND response_body IS NOT NULL))
);

CREATE TABLE wealth_audit.audit_events (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 tenant_id UUID NOT NULL REFERENCES wealth_auth.tenants(id),
 event_type TEXT NOT NULL,
 actor_subject TEXT NOT NULL,
 correlation_id UUID NOT NULL,
 aggregate_type TEXT NOT NULL,
 aggregate_id UUID NOT NULL,
 before_state JSONB,
 after_state JSONB,
 occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON wealth_audit.audit_events(tenant_id,occurred_at DESC,id DESC);

-- ALL tenant-scoped tables MUST use FORCE RLS, including historical reads.
DO $$
DECLARE row RECORD;
BEGIN
 FOR row IN
 SELECT table_schema,table_name
 FROM information_schema.columns
 WHERE column_name='tenant_id' AND table_schema LIKE 'wealth_%'
 GROUP BY table_schema,table_name
 LOOP
 EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY',row.table_schema,row.table_name);
 EXECUTE format('ALTER TABLE %I.%I FORCE ROW LEVEL SECURITY',row.table_schema,row.table_name);
 IF row.table_schema='wealth_auth' AND row.table_name='tenant_memberships' THEN
  EXECUTE 'CREATE POLICY membership_subject_scope ON wealth_auth.tenant_memberships FOR SELECT USING (subject_id = current_setting(''app.subject_id'',true))';
 ELSE
  EXECUTE format(
   'CREATE POLICY tenant_scope ON %I.%I USING (tenant_id = nullif(current_setting(''app.tenant_id'',true),'''')::uuid) WITH CHECK (tenant_id = nullif(current_setting(''app.tenant_id'',true),'''')::uuid)',
   row.table_schema,row.table_name);
 END IF;
 END LOOP;
END $$;

-- Restricted application account is provisioned separately (Docker init / CI).
DO $$
BEGIN
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='wealth_app') THEN
  GRANT USAGE ON SCHEMA wealth_auth,wealth_core,wealth_planning,wealth_capital,wealth_portfolio,wealth_risk,wealth_intelligence,wealth_integration,wealth_audit TO wealth_app;
  GRANT SELECT ON wealth_auth.tenant_memberships,wealth_auth.consent_grants TO wealth_app;
  GRANT SELECT,INSERT,UPDATE ON wealth_core.wealth_profiles TO wealth_app;
  GRANT SELECT ON wealth_core.wealth_policies TO wealth_app;
  GRANT SELECT,INSERT,UPDATE ON wealth_planning.goals,wealth_planning.goal_milestones,wealth_planning.strategy_versions TO wealth_app;
  GRANT SELECT ON ALL TABLES IN SCHEMA wealth_capital,wealth_portfolio,wealth_risk,wealth_intelligence TO wealth_app;
  GRANT SELECT ON ALL TABLES IN SCHEMA wealth_integration TO wealth_app;
  GRANT SELECT,INSERT,UPDATE ON wealth_integration.idempotency_keys,wealth_integration.outbox_events TO wealth_app;
  GRANT SELECT,INSERT ON wealth_audit.audit_events TO wealth_app;
 END IF;
END $$;