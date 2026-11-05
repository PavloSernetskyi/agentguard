import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


def load_local_env():
    """Read server-only settings from the ignored project .env.local file."""
    root = Path(__file__).resolve().parents[1]
    path = root / ".env.local"
    if not path.is_file():
        return
    for line in path.read_text(encoding="utf-8-sig").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        key, separator, value = line.partition("=")
        key = key.strip()
        if not separator or key not in {"DAYWELL_DB_PATH", "GROQ_API_KEY", "GROQ_MODEL"}:
            continue
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
            value = value[1:-1]
        if key == "DAYWELL_DB_PATH" and value and not Path(value).is_absolute():
            value = str(root / value)
        os.environ.setdefault(key, value)


load_local_env()

from .api import handle
from .assistant import build_assistant
from .service import StoreService
from .storage import SQLiteStorage
from seed.reset import DB_PATH, seed


def main():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    storage = SQLiteStorage(DB_PATH)
    if not storage.list("products"):
        seed(storage)
    service = StoreService(storage, storage)
    assistant = build_assistant(service, storage)

    class Handler(BaseHTTPRequestHandler):
        def dispatch(self):
            try:
                size = int(self.headers.get("Content-Length", 0))
                if not 0 <= size <= 16384:
                    self.send_error(413)
                    return
                body = self.rfile.read(size).decode("utf-8")
            except (ValueError, UnicodeError):
                self.send_error(400)
                return
            status, headers, result = handle(service, self.command, self.path, dict(self.headers), body, assistant=assistant)
            payload = json.dumps(result).encode()
            self.send_response(status)
            for key, value in headers.items():
                self.send_header(key, value)
            self.send_header("Content-Length", str(len(payload)))
            self.end_headers()
            self.wfile.write(payload)

        do_GET = do_POST = do_PUT = do_DELETE = dispatch

    print("Archery Pro Shopping API: http://127.0.0.1:8000", flush=True)
    ThreadingHTTPServer(("127.0.0.1", 8000), Handler).serve_forever()


if __name__ == "__main__":
    main()
