"""Local administrator utility; never served over HTTP."""
import json
from .storage import SQLiteStorage
from seed.reset import DB_PATH

if __name__ == "__main__":
    if not DB_PATH.exists():
        raise SystemExit("No database yet. Run python -m seed.reset first.")
    for event in sorted(SQLiteStorage(DB_PATH).list("audit"), key=lambda e: e["timestamp"]):
        print(json.dumps(event))
