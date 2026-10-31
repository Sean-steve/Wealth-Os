-- B0 developer-only app login. Production: managed secrets, independent migrations/app principals.
DO $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='wealth_app') THEN
   CREATE ROLE wealth_app LOGIN PASSWORD 'local_dev_only_app_password'
     NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
 END IF;
END $$;
GRANT CONNECT ON DATABASE wealth_os TO wealth_app;
