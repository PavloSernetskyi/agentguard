from pathlib import Path
import tempfile
import unittest
from backend.soc import response
from backend.storage import SQLiteStorage
from backend.service import StoreService
from scripts.export_assistant_audit import exercise_assistant
from seed.reset import seed


class AssistantReportingIntegrationTests(unittest.TestCase):
    def test_real_assistant_http_references_reach_the_protected_read_only_feed(self):
        with tempfile.TemporaryDirectory() as temporary:
            database = Path(temporary) / "integration.sqlite3"
            storage = SQLiteStorage(database)
            seed(storage)
            references = exercise_assistant(StoreService(storage, storage), storage)
            token = "integration-operator-token-" + "x" * 32
            status, payload = response(database, token, "GET", "/soc-api/events", {"Authorization": "Bearer " + token})
            self.assertEqual(status, 200)
            roots = {event["request_id"]: event for event in payload["events"] if event["action"] == "assistant.message"}
            self.assertEqual(set(roots), set(references.values()))
            self.assertEqual(roots[references["success"]]["execution"], "succeeded")
            self.assertEqual(roots[references["provider_unavailable"]]["execution"], "failed")
            self.assertEqual(roots[references["unconfigured"]]["execution"], "failed")
            self.assertEqual(roots[references["signed_out"]]["decision"], "deny")
            trace = [event for event in payload["events"] if event["request_id"] == references["success"]]
            self.assertEqual({event["action"] for event in trace}, {"orders.list", "cart.read", "assistant.message"})
            self.assertTrue(all(event["actor_id"] == "alice" for event in trace))
            for event in trace:
                self.assertEqual(set(event), {"schema_version", "event_id", "request_id", "timestamp", "actor_id", "action", "resource_id", "decision", "reason", "execution"})
            self.assertEqual(response(database, token, "GET", "/soc-api/events", {"Cookie": "demomart_session=alice"})[0], 401)
