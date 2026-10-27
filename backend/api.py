"""Transport-neutral API; a future Lambda adapter can call handle()."""
import json
import uuid
from http.cookies import SimpleCookie
from urllib.parse import urlsplit, parse_qs
from .service import ApiError

ALLOWED_ORIGINS = {"http://127.0.0.1:5173", "http://localhost:5173"}


def handle(service, method, url, headers, body="", *, allowed_origins=None, secure_cookie=False):
    allowed_origins = ALLOWED_ORIGINS if allowed_origins is None else allowed_origins
    cookie_security = "; Secure" if secure_cookie else ""
    request_id = str(uuid.uuid4())
    response_headers = {"Content-Type": "application/json", "Cache-Control": "no-store", "X-Request-Id": request_id}
    headers = {k.lower(): v for k, v in headers.items()}
    parts = urlsplit(url)
    path = parts.path.rstrip("/")
    cookie = SimpleCookie()
    try:
        cookie.load(headers.get("cookie", ""))
        token = cookie["demomart_session"].value if "demomart_session" in cookie else None
        if method in ("POST", "PUT", "DELETE") and headers.get("origin") not in allowed_origins:
            raise ApiError(403, "Untrusted request origin")
        data = json.loads(body) if body else {}
        if not isinstance(data, dict):
            raise ApiError(400, "Expected a JSON object")
        if method == "GET" and path == "/api/products":
            query = parse_qs(parts.query)
            result = service.products(query.get("q", [""])[0], query.get("category", [""])[0])
        elif method == "GET" and path.startswith("/api/products/"):
            result = service.product(path.split("/")[-1])
        elif path == "/api/session" and method == "POST":
            token, result = service.login(data.get("account"), data.get("password"), request_id, token)
            response_headers["Set-Cookie"] = f"demomart_session={token}; HttpOnly; SameSite=Strict; Path=/api; Max-Age=3600{cookie_security}"
        elif path == "/api/session" and method == "DELETE":
            service.logout(token)
            result = {"ok": True}
            response_headers["Set-Cookie"] = f"demomart_session=; HttpOnly; SameSite=Strict; Path=/api; Max-Age=0{cookie_security}"
        else:
            known = (method == "GET" and path in ("/api/session", "/api/orders", "/api/cart")) or (method == "GET" and path.startswith("/api/orders/")) or (method == "PUT" and path.startswith("/api/cart/")) or (method == "POST" and path == "/api/checkout")
            if not known:
                raise ApiError(404, "Route not found")
            action = "checkout.simulate" if path == "/api/checkout" else "orders.read" if path.startswith("/api/orders/") else "orders.list" if path == "/api/orders" else "cart.update" if method == "PUT" else "cart.read" if path == "/api/cart" else "session.read"
            principal = service.principal(token, request_id, action, path.split("/")[-1])
            if path == "/api/session":
                result = service.storage.get("customers", principal.customer_id)
            elif path == "/api/orders":
                result = service.orders(principal, request_id)
            elif path.startswith("/api/orders/"):
                result = service.order(principal, path.split("/")[-1], request_id)
            elif path == "/api/checkout":
                result = service.checkout(principal, request_id, data)
            else:
                result = service.cart(principal, request_id, path.split("/")[-1] if method == "PUT" else None, data.get("quantity"))
        return 201 if path == "/api/checkout" else 200, response_headers, result
    except (json.JSONDecodeError, UnicodeError):
        return 400, response_headers, {"error": "Invalid JSON", "request_id": request_id}
    except ApiError as error:
        return error.status, response_headers, {"error": error.message, "request_id": request_id}
    except Exception:
        return 500, response_headers, {"error": "Request failed", "request_id": request_id}
