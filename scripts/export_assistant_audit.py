"""Generate a v1 SOC contract fixture through the real backend with a test-only runner.

This never calls Groq, opens the store database, or performs attack probes.
Run: python -m scripts.export_assistant_audit --output artifacts/assistant-audit.json
"""
import argparse
from datetime import datetime, timedelta, timezone
import json
from pathlib import Path
import tempfile
import uuid

from backend.api import handle
from backend.assistant import AssistantService
from backend.service import StoreService
from backend.storage import SQLiteStorage
from seed.reset import seed


class ContractRunner:
    def __init__(self, unavailable=False):
        self.unavailable = unavailable

    def run(self, prompt, tools):
        if self.unavailable:
            raise RuntimeError("Test-only provider failure")
        tools["get_my_orders"]()
        tools["get_cart"]()
        return "Your own order and cart information is available."


def exercise_assistant(store, storage):
    """Exercise the merged HTTP handler; return each real HTTP request reference."""
    status, headers, _ = handle(store, "POST", "/api/session", {"Origin": "http://127.0.0.1:5173"}, json.dumps({"account": "alice", "password": "alice-demo"}))
    if status != 200:
        raise RuntimeError("Fixture sign-in failed")
    cookie = headers["Set-Cookie"].split(";", 1)[0]
    references = {}
    cases = [("success", ContractRunner(), cookie, 200), ("provider_unavailable", ContractRunner(True), cookie, 503), ("unconfigured", None, cookie, 503), ("signed_out", None, None, 401)]
    for name, runner, session, expected in cases:
        request_headers = {"Origin": "http://127.0.0.1:5173"}
        if session:
            request_headers["Cookie"] = session
        assistant = AssistantService(store, storage, runner) if runner else None
        status, headers, _ = handle(store, "POST", "/api/assistant/messages", request_headers, json.dumps({"message": "Show my own orders and cart"}), assistant=assistant)
        if status != expected:
            raise RuntimeError(f"Unexpected {name} status: {status}")
        references[name] = headers["X-Request-Id"]
    return references


def build_fixture():
    with tempfile.TemporaryDirectory() as temporary:
        storage = SQLiteStorage(Path(temporary) / "contract.sqlite3")
        seed(storage)
        references = exercise_assistant(StoreService(storage, storage), storage)
        raw = storage.list("audit")
        result = []
        for case, request_id in references.items():
            events = sorted((event for event in raw if event["request_id"] == request_id), key=lambda event: event["timestamp"])
            for index, event in enumerate(events):
                normalized = dict(event)
                normalized["request_id"] = str(uuid.uuid5(uuid.NAMESPACE_URL, "agentguard-contract/" + case))
                normalized["event_id"] = str(uuid.uuid5(uuid.NAMESPACE_URL, f"agentguard-contract/{case}/{index}"))
                normalized["timestamp"] = (datetime(2026, 10, 27, 12, tzinfo=timezone.utc) + timedelta(seconds=len(result))).isoformat()
                if event["action"] == "assistant.message" and event["resource_id"] != "new":
                    normalized["resource_id"] = str(uuid.uuid5(uuid.NAMESPACE_URL, "agentguard-conversation/" + case))
                result.append(normalized)
        return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path)
    parser.add_argument("--check", type=Path)
    args = parser.parse_args()
    fixture = build_fixture()
    if args.check:
        if json.loads(args.check.read_text(encoding="utf-8")) != fixture:
            raise SystemExit("Assistant producer fixture changed; review and regenerate the consumer contract fixture")
        print("Merged assistant producer matches the dashboard contract fixture")
    elif args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(fixture, indent=2) + "\n", encoding="utf-8")
        print(f"Wrote {len(fixture)} backend-generated v1 events")
    else:
        print(json.dumps(fixture, indent=2))


if __name__ == "__main__":
    main()
