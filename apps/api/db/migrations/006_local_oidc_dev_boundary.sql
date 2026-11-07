-- L1-006: allow ONLY fake, explicitly marked loopback identity in the
-- dedicated wealth_os_local development database. All other DBs stay HTTPS-only.
DO $wealth_local_identity$
BEGIN
 IF current_database() = 'wealth_os_local' THEN
  ALTER TABLE wealth_auth.identity_bindings
    DROP CONSTRAINT identity_bindings_issuer_check;
  ALTER TABLE wealth_auth.identity_bindings
    ADD CONSTRAINT identity_bindings_issuer_check
    CHECK (
      issuer ~ '^https://' OR (
       issuer ~ '^http://127[.]0[.]0[.]1:[0-9]{2,5}/realms/wealth-os-local$'
       AND kernel_person_ref = 'local-test-person'
       AND proof_reference = 'LOCAL_TEST_IDENTITY_NOT_KERNEL_VERIFIED'
      )
    );
 END IF;
END
$wealth_local_identity$;
