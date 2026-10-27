import hashlib
import secrets
import time
import uuid
from datetime import datetime, timezone
from .security import Principal, Decision, OwnershipAuthorizer
from .storage import Storage, AuditSink
from .auth import LocalDemoAuthenticator, AuthenticationUnavailable


class ApiError(Exception):
    def __init__(self, status, message):
        self.status, self.message = status, message


class StoreService:
    def __init__(self, storage: Storage, audit: AuditSink, authorizer=None, authenticator=None):
        self.storage, self.audit = storage, audit
        self.authorizer = authorizer or OwnershipAuthorizer()
        self.authenticator = authenticator or LocalDemoAuthenticator()

    def record(self, request_id, actor, action, resource, decision, execution):
        self.audit.emit(dict(schema_version=1, event_id=str(uuid.uuid4()), request_id=request_id, timestamp=datetime.now(timezone.utc).isoformat(), actor_id=actor, action=action, resource_id=resource, decision="allow" if decision.allowed else "deny", reason=decision.reason, execution=execution))

    def login(self, account, password, request_id, old_token=None):
        if not isinstance(account, str) or not isinstance(password, str) or not 1 <= len(account) <= 128 or not 1 <= len(password) <= 256:
            customer_id = None
        else:
            try:
                customer_id = self.authenticator.authenticate(account, password)
            except AuthenticationUnavailable:
                self.record(request_id, None, "session.create", "session", Decision(False, "identity_provider_unavailable"), "blocked")
                raise ApiError(503, "Sign-in temporarily unavailable")
        if not customer_id:
            self.record(request_id, None, "session.create", "session", Decision(False, "invalid_credentials"), "blocked")
            raise ApiError(401, "Invalid credentials or account setup incomplete")
        self.logout(old_token)
        token = secrets.token_urlsafe(32)
        self.storage.put("sessions", self.digest(token), {"customer_id": customer_id, "expires": int(time.time()) + 3600})
        self.record(request_id, customer_id, "session.create", "session", Decision(True, "credentials_valid"), "succeeded")
        return token, self.storage.get("customers", customer_id)

    @staticmethod
    def digest(token):
        return hashlib.sha256(token.encode()).hexdigest()

    def logout(self, token):
        if token:
            self.storage.delete("sessions", self.digest(token))

    def principal(self, token, request_id, action, resource):
        session = self.storage.get("sessions", self.digest(token)) if token else None
        if not session or session["expires"] <= time.time():
            self.record(request_id, None, action, resource, Decision(False, "invalid_session"), "blocked")
            raise ApiError(401, "Sign in to continue")
        return Principal(session["customer_id"])

    def execute(self, principal, action, resource, request_id, operation):
        try:
            decision = self.authorizer.authorize(principal, action, resource)
            if resource.get("customer_id") != principal.customer_id:
                decision = Decision(False, "ownership_mismatch")
        except Exception:
            decision = Decision(False, "authorization_error")
        if not decision.allowed:
            self.record(request_id, principal.customer_id, action, resource["id"], decision, "blocked")
            raise ApiError(403, "Access denied")
        try:
            result = operation()
        except Exception:
            self.record(request_id, principal.customer_id, action, resource["id"], decision, "failed")
            raise
        self.record(request_id, principal.customer_id, action, resource["id"], decision, "succeeded")
        return result

    def products(self, q="", category=""):
        needle = q.casefold()
        return [p for p in self.storage.list("products") if (not category or p["category"] == category) and needle in " ".join((p["name"], p["category"], p["description"], p.get("use_case") or "")).casefold()]

    def product(self, pid):
        product = self.storage.get("products", pid)
        if not product:
            raise ApiError(404, "Product not found")
        return product

    def orders(self, principal, request_id):
        return self.execute(principal, "orders.list", {"id": "orders", "customer_id": principal.customer_id}, request_id, lambda: [o for o in self.storage.list_owned("orders", principal.customer_id) if o["customer_id"] == principal.customer_id])

    def order(self, principal, oid, request_id):
        order = self.storage.get("orders", oid)
        resource = {"id": oid, "customer_id": order["customer_id"] if order else None}
        return self.execute(principal, "orders.read", resource, request_id, lambda: order)

    def cart(self, principal, request_id, pid=None, quantity=None):
        def operation():
            if pid is not None:
                self.product(pid)
                if type(quantity) is not int or not 0 <= quantity <= 99:
                    raise ApiError(400, "Quantity must be an integer from 0 to 99")
                key = principal.customer_id + ":" + pid
                if quantity == 0:
                    self.storage.delete("cart", key)
                else:
                    self.storage.put("cart", key, {"customer_id": principal.customer_id, "product_id": pid, "quantity": quantity})
            items = [{"product": self.product(row["product_id"]), "quantity": row["quantity"]} for row in self.storage.list_owned("cart", principal.customer_id) if row["customer_id"] == principal.customer_id]
            return {"items": items, "total": sum(i["product"]["price"] * i["quantity"] for i in items)}
        return self.execute(principal, "cart.update" if pid else "cart.read", {"id": "cart:" + principal.customer_id, "customer_id": principal.customer_id}, request_id, operation)

    def checkout(self, principal, request_id, data=None):
        """Create a synthetic order from the trusted customer's cart; no payment occurs."""
        def operation():
            if data:
                raise ApiError(400, "Fictional checkout accepts no payment or address details")
            rows = [row for row in self.storage.list_owned("cart", principal.customer_id) if row["customer_id"] == principal.customer_id]
            if not rows:
                raise ApiError(400, "Your cart is empty")
            items = []
            for row in rows:
                product = self.product(row["product_id"])
                items.append({"product_id": product["id"], "name": product["name"], "quantity": row["quantity"], "unit_price": product["price"]})
            customer = self.storage.get("customers", principal.customer_id)
            if not customer:
                raise ApiError(401, "Account not found")
            order_id = "ord-" + principal.customer_id + "-" + uuid.uuid4().hex[:12]
            order = {
                "id": order_id,
                "customer_id": principal.customer_id,
                "date": datetime.now(timezone.utc).date().isoformat(),
                "status": "Placed (fictional)",
                "address": customer.get("address") or customer["name"] + ", 100 Example Lane, Fiction City, ZZ 00000",
                "items": items,
                "total": sum(item["unit_price"] * item["quantity"] for item in items),
                "transaction": "synthetic-no-payment",
            }
            self.storage.put("orders", order_id, order)
            for row in rows:
                self.storage.delete("cart", principal.customer_id + ":" + row["product_id"])
            return order
        return self.execute(principal, "checkout.simulate", {"id": "checkout:" + principal.customer_id, "customer_id": principal.customer_id}, request_id, operation)
