"""Loopback-only operator feed for existing local audit events. Never mutates the store."""
import argparse
from contextlib import closing
import base64
import json
import os
from pathlib import Path
import secrets
import sqlite3
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlsplit


def response(database, token, method, url, headers):
    """Return a read-only reporting response; shopper sessions grant no access."""
    headers = {key.lower(): value for key, value in headers.items()}
    supplied = headers.get("authorization", "")
    if len(token) < 32:
        return 503, {"error": "Operator access is not configured"}
    if not secrets.compare_digest(supplied.encode(), ("Bearer " + token).encode()):
        return 401, {"error": "Operator token required"}
    if method != "GET":
        return 405, {"error": "Reporting is read-only"}
    parts = urlsplit(url)
    if parts.path not in ("/soc-api/events", "/soc-api/health"):
        return 404, {"error": "Route not found"}
    try:
        query = parse_qs(parts.query, keep_blank_values=True, max_num_fields=8)
        if set(query) - {"limit", "cursor"} or any(len(v) != 1 for v in query.values()):
            raise ValueError()
        limit = int(query.get("limit", ["250"])[0])
        if not 1 <= limit <= 500:
            raise ValueError()
        cursor = query.get("cursor", [None])[0]
        params = []
        condition = ""
        if cursor:
            if len(cursor) > 2048:
                raise ValueError()
            decoded = json.loads(base64.urlsafe_b64decode(cursor.encode()))
            if not isinstance(decoded, list) or len(decoded) != 2 or not all(isinstance(v, str) for v in decoded):
                raise ValueError()
            timestamp, key = decoded
            condition = " AND (json_extract(value, '$.timestamp') < ? OR (json_extract(value, '$.timestamp') = ? AND key < ?))"
            params = [timestamp, timestamp, key]
    except (ValueError, TypeError, UnicodeError):
        return 400, {"error": "Invalid reporting query"}
    try:
        # mode=ro refuses missing databases and prohibits writes, even accidentally.
        uri = Path(database).resolve().as_uri() + "?mode=ro"
        with closing(sqlite3.connect(uri, uri=True, timeout=3)) as db:
            db.execute("PRAGMA query_only = ON")
            if parts.path == "/soc-api/health":
                db.execute("SELECT 1 FROM records LIMIT 1").fetchone()
                return 200, {"source": "local-sqlite", "read_only": True}
            rows = db.execute(
                "SELECT key, value FROM records WHERE collection='audit'" + condition
                + " ORDER BY json_extract(value, '$.timestamp') DESC, key DESC LIMIT ?",
                [*params, limit + 1],
            ).fetchall()
        page = rows[:limit]
        events = [json.loads(value) for _, value in page]
        next_cursor = None
        if len(rows) > limit and page:
            last_key, last_value = page[-1]
            next_cursor = base64.urlsafe_b64encode(json.dumps([json.loads(last_value)["timestamp"], last_key]).encode()).decode()
        return 200, {"source": "local-sqlite", "events": events, "next_cursor": next_cursor}
    except (sqlite3.Error, OSError, ValueError, KeyError):
        return 503, {"error": "Audit storage unavailable or invalid"}


def main():
    from seed.reset import DB_PATH
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--database", type=Path, default=DB_PATH)
    parser.add_argument("--port", type=int, default=8001)
    args = parser.parse_args()
    token = os.environ.get("AGENTGUARD_SOC_TOKEN", "")
    if len(token) < 32:
        parser.error("Set AGENTGUARD_SOC_TOKEN to a random token of at least 32 characters")

    class Handler(BaseHTTPRequestHandler):
        def dispatch(self):
            status, payload = response(args.database, token, self.command, self.path, dict(self.headers))
            encoded = json.dumps(payload).encode()
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Cache-Control", "no-store")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.send_header("Content-Length", str(len(encoded)))
            if status == 401:
                self.send_header("WWW-Authenticate", "Bearer")
            if status == 405:
                self.send_header("Allow", "GET")
            self.end_headers()
            self.wfile.write(encoded)

        do_GET = do_POST = do_PUT = do_DELETE = do_PATCH = do_OPTIONS = dispatch

        def log_message(self, format, *args):
            # Do not log authorization headers, payloads, or query strings.
            pass

    print(f"AgentGuard operator feed: http://127.0.0.1:{args.port} (read-only)", flush=True)
    ThreadingHTTPServer(("127.0.0.1", args.port), Handler).serve_forever()


if __name__ == "__main__":
    main()
