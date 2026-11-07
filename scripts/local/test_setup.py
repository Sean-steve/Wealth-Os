"""L1 bootstrap unit certification; does not touch PostgreSQL or sudo."""
from pathlib import Path
import sys
import unittest
from urllib.parse import urlsplit
sys.path.insert(0, str(Path(__file__).resolve().parent))
import setup
import provision_identity


class L1Safety(unittest.TestCase):
    def test_ports_and_random_local_db_credentials(self):
        self.assertEqual(setup.safe_port("5433"), 5433)
        for port in ("0", "65536", "-1"):
            with self.assertRaises(ValueError):
                setup.safe_port(port)
        self.assertEqual(setup.sql_literal("A'b"), "'A''b'")
        url = setup.db_url("wealth_app", "a:b@c", 5433)
        self.assertIn("%3A", url)
        self.assertEqual(urlsplit(url).hostname, "127.0.0.1")
        self.assertEqual(urlsplit(url).port, 5433)

    def test_generated_realm_is_test_only_pkce_and_loopback(self):
        user = "1b23bb40-8df8-44b9-ac9d-cde20cf05cde"
        realm = setup.realm_template(user, "random-dev-password", "random-service-secret")
        self.assertEqual(realm["realm"], "wealth-os-local")
        self.assertFalse(realm["registrationAllowed"])
        self.assertEqual(realm["users"][0]["id"], user)
        clients = {c["clientId"]: c for c in realm["clients"]}
        spa = clients["wealth-os-local-spa"]
        self.assertTrue(spa["publicClient"])
        self.assertEqual(spa["attributes"]["pkce.code.challenge.method"], "S256")
        self.assertTrue(all(u.startswith("http://127.0.0.1:") or
                            u.startswith("http://localhost:")
                            for u in spa["redirectUris"]))
        self.assertEqual(len(spa["redirectUris"]), 3)
        self.assertFalse(clients["wealth-os-local-source"]["publicClient"])
        self.assertTrue(clients["wealth-os-local-source"]["serviceAccountsEnabled"])

    def test_known_database_roles_and_no_implicit_production(self):
        self.assertEqual(setup.ROLE_NAMES,
                         ("wealth_os_local_migrator", "wealth_app", "wealth_ingest"))
        self.assertEqual(setup.DATABASE, "wealth_os_local")
        self.assertIn("testOnly", Path(__file__).resolve().parents[2].joinpath(
            "scripts/local/setup.py").read_text())
        self.assertEqual(provision_identity.sql_literal("O'Neil"), "'O''Neil'")

if __name__ == "__main__":
    unittest.main()
