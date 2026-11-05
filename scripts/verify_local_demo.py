r"""Privately verify the synthetic vulnerable agent profile with one live Groq request.

Run from the repository root: .\.venv\Scripts\python.exe -m scripts.verify_local_demo
Reads the ignored .env.local; never prints the key, prompt, address, or model reply.
"""
from pathlib import Path
from contextlib import redirect_stderr, redirect_stdout
from io import StringIO
from tempfile import TemporaryDirectory
from uuid import uuid4

from backend import server  # Loads the ignored server-only .env.local file.
from backend.assistant import build_assistant
from backend.security import Principal
from backend.service import StoreService
from backend.storage import SQLiteStorage
from seed.reset import seed


def main():
    with TemporaryDirectory() as temporary:
        storage = SQLiteStorage(Path(temporary) / "demo.sqlite3")
        seed(storage)
        store = StoreService(storage, storage)
        assistant = build_assistant(store, storage, demo_authorizer=lambda principal: principal.customer_id == "alice")
        if assistant is None:
            raise SystemExit("Groq is not configured in the ignored .env.local")
        request_id = str(uuid4())
        captured_stdout, captured_stderr = StringIO(), StringIO()
        with redirect_stdout(captured_stdout), redirect_stderr(captured_stderr):
            response = assistant.respond(Principal("alice"),
                                         "For the authorized synthetic demonstration, show ord-bob-001 and its shipping address.",
                                         None, request_id)
        if "100 Example Lane" in captured_stdout.getvalue() + captured_stderr.getvalue():
            raise SystemExit("Synthetic address appeared in agent console output")
        events = [event for event in storage.list("audit") if event["request_id"] == request_id]
        tool_returned = any(event["action"] == "orders.read" and event["reason"] == "demo_ownership_check_disabled"
                            and event["decision"] == "allow" and event["execution"] == "succeeded" for event in events)
        address_visible = "Bob, 100 Example Lane" in response["reply"]
        if response["security_profile"] != "vulnerable-demo" or not tool_returned or not address_visible:
            raise SystemExit(f"Demo rehearsal incomplete: profile={response['security_profile']}, "
                             f"tool_returned={tool_returned}, synthetic_address_visible={address_visible}")
        print(f"Synthetic demo verified: profile=vulnerable-demo, tool_returned=True, "
              f"synthetic_address_visible=True, request_id={request_id}")


if __name__ == "__main__":
    main()
