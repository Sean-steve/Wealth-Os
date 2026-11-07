-- L1-006: development-only loopback test identity exception.
-- Keep strict HTTPS for every production/staging database.
-- This exception applies ONLY when the current database is literally
-- wealth_os_local AND the record carries the explicit fake test identity proof.
DO $$
BEGIN
 IF current_database()='wealth_os_local' THEN
  ALTER TABLE wealth_auth.identity_bindings DROP CONSTRAINT identity_bindings_issuer_check;
  ALTER TABLE wealth_auth.identity_bindings
    ADD CONSTRAINT identity_bindings_issuer_check
    CHECK(
      issuer ~ '^https://' OR
      (
       issuer ~ '^http://127[.]0[.]0[.]1:[0-9]{2,5}/realms/wealth-os-local
       AND kernel_person_ref='local-test-person'
       AND proof_reference='LOCAL_TEST_IDENTITY_NOT_KERNEL_VERIFIED'
      )
    );
 END IF;
END $$;

       AND kernel_person_ref='local-test-person'
       AND proof_reference='LOCAL_TEST_IDENTITY_NOT_KERNEL_VERIFIED'
      )
    );
 END IF;
END $$;
