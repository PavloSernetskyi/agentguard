import json
from contextlib import closing
from pathlib import Path
import sqlite3
import tempfile
import unittest
from backend.soc import response


class ReportingTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.database = Path(self.temp.name) / "audit.sqlite3"
        self.token = "test-operator-token-" + "x" * 32
        self.headers = {"Authorization": "Bearer " + self.token}
        with closing(sqlite3.connect(self.database)) as db, db:
            db.execute("CREATE TABLE records (collection TEXT, key TEXT, value TEXT)")
            for index in range(4):
                event = {"timestamp": f"2026-10-27T12:0{index}:00+00:00", "event_id": str(index)}
                db.execute("INSERT INTO records VALUES ('audit', ?, ?)", (str(index), json.dumps(event)))
            db.execute("INSERT INTO records VALUES ('sessions', 'private', '{\"secret\":true}')")

    def tearDown(self):
        self.temp.cleanup()

    def get(self, query="", headers=None, method="GET", database=None):
        return response(database or self.database, self.token, method, "/soc-api/events" + query, self.headers if headers is None else headers)

    def test_operator_auth_happens_before_storage_access(self):
        missing = Path(self.temp.name) / "missing.sqlite3"
        for headers in ({}, {"Cookie": "demomart_session=alice"}, {"Authorization": "Bearer wrong"}):
            self.assertEqual(self.get(headers=headers, database=missing)[0], 401)
        self.assertFalse(missing.exists())
        self.assertEqual(response(missing, "", "GET", "/soc-api/events", {})[0], 503)

    def test_keyset_pagination_never_returns_customer_or_session_data(self):
        status, first = self.get("?limit=2")
        self.assertEqual(status, 200)
        self.assertEqual([v["event_id"] for v in first["events"]], ["3", "2"])
        # A newly inserted event must not shift older pages or cause duplicates.
        with closing(sqlite3.connect(self.database)) as db, db:
            db.execute("INSERT INTO records VALUES ('audit', '4', ?)", (json.dumps({"timestamp": "2026-10-27T12:04:00+00:00", "event_id": "4"}),))
        status, second = self.get("?limit=2&cursor=" + first["next_cursor"])
        self.assertEqual(status, 200)
        self.assertEqual([v["event_id"] for v in second["events"]], ["1", "0"])
        self.assertIsNone(second["next_cursor"])
        self.assertNotIn("secret", json.dumps(first))

    def test_read_only_methods_and_invalid_queries(self):
        before = self.database.read_bytes()
        for method in ("POST", "PUT", "DELETE", "PATCH"):
            self.assertEqual(self.get(method=method)[0], 405)
        for query in ("?limit=0", "?limit=501", "?limit=abc", "?limit=1&limit=2", "?cursor=bad", "?customer_id=bob"):
            self.assertEqual(self.get(query)[0], 400, query)
        self.assertEqual(self.database.read_bytes(), before)

    def test_missing_storage_is_not_created_and_errors_are_sanitized(self):
        missing = Path(self.temp.name) / "missing.sqlite3"
        status, payload = self.get(database=missing)
        self.assertEqual(status, 503)
        self.assertNotIn(str(missing), json.dumps(payload))
        self.assertFalse(missing.exists())

    def test_unknown_route_and_health_require_token(self):
        self.assertEqual(response(self.database, self.token, "GET", "/soc-api/unknown", self.headers)[0], 404)
        self.assertEqual(response(self.database, self.token, "GET", "/soc-api/health", {})[0], 401)
        status, payload = response(self.database, self.token, "GET", "/soc-api/health", self.headers)
        self.assertEqual(status, 200)
        self.assertTrue(payload["read_only"])
