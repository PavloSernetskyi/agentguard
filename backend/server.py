import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from .api import handle
from .service import StoreService
from .storage import SQLiteStorage
from seed.reset import DB_PATH, seed


def main():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    storage = SQLiteStorage(DB_PATH)
    if not storage.list("products"):
        seed(storage)
    service = StoreService(storage, storage)

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
            status, headers, result = handle(service, self.command, self.path, dict(self.headers), body)
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
