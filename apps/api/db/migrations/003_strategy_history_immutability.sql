-- B1-003: enforce append-only strategy version history for the application principal.
-- Strategy versions can be appended by the API; current pointers can be revised in strategy_heads.
DO $$
BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='wealth_app') THEN
  REVOKE UPDATE,DELETE ON wealth_planning.strategy_versions FROM wealth_app;
  GRANT SELECT,INSERT ON wealth_planning.strategy_versions TO wealth_app;
 END IF;
END $$;
