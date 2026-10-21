from __future__ import annotations
import json
import sqlite3
from contextlib import contextmanager
from typing import Protocol


class Storage(Protocol):
    def get(self, collection: str, key: str): ...
    def put(self, collection: str, key: str, value: dict): ...
    def delete(self, collection: str, key: str): ...
    def list(self, collection: str) -> list[dict]: ...
    def list_owned(self, collection: str, customer_id: str) -> list[dict]: ...


class AuditSink(Protocol):
    def emit(self, event: dict): ...


class SQLiteStorage:
    def __init__(self, path):
        self.path = str(path)
        with self.connect() as db:
            db.execute("CREATE TABLE IF NOT EXISTS records (collection TEXT, key TEXT, value TEXT, PRIMARY KEY(collection,key))")

    @contextmanager
    def connect(self):
        db = sqlite3.connect(self.path, timeout=10)
        try:
            with db:
                yield db
        finally:
            db.close()

    def get(self, collection, key):
        with self.connect() as db:
            row = db.execute("SELECT value FROM records WHERE collection=? AND key=?", (collection, key)).fetchone()
        return json.loads(row[0]) if row else None

    def put(self, collection, key, value):
        with self.connect() as db:
            db.execute("INSERT OR REPLACE INTO records VALUES (?,?,?)", (collection, key, json.dumps(value)))

    def delete(self, collection, key):
        with self.connect() as db:
            db.execute("DELETE FROM records WHERE collection=? AND key=?", (collection, key))

    def list(self, collection):
        with self.connect() as db:
            return [json.loads(row[0]) for row in db.execute("SELECT value FROM records WHERE collection=? ORDER BY key", (collection,))]

    def list_owned(self, collection, customer_id):
        return [v for v in self.list(collection) if v.get("customer_id") == customer_id]

    def emit(self, event):
        self.put("audit", event["event_id"], event)
