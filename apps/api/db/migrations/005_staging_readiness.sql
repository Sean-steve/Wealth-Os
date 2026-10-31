-- B3-005. Give the restricted API only the minimum schema-readiness evidence.
-- Migration checksums, schema ownership and migration writes remain migrator-only.
DO $$
BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='wealth_app') THEN
  GRANT SELECT ON wealth_core.schema_migrations TO wealth_app;
 END IF;
END $$;
