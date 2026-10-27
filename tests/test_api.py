import json
import tempfile
import unittest
from pathlib import Path
from backend.api import handle
from backend.service import StoreService
from backend.storage import SQLiteStorage
from backend.security import Decision
from seed.reset import seed


class AcceptanceTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.store = SQLiteStorage(Path(self.temp.name) / "test.sqlite3")
        seed(self.store)
        self.service = StoreService(self.store, self.store)

    def tearDown(self):
        self.temp.cleanup()

    def request(self, method, path, token=None, body=None, origin="http://127.0.0.1:5173"):
        headers = {"Origin": origin}
        if token:
            headers["Cookie"] = token
        return handle(self.service, method, "/api" + path, headers, json.dumps(body) if body is not None else "")

    def login(self, account="alice"):
        status, headers, customer = self.request("POST", "/session", body={"account": account, "password": account + "-demo"})
        self.assertEqual(status, 200)
        self.assertEqual(customer["id"], account)
        self.assertIn("HttpOnly", headers["Set-Cookie"])
        return headers["Set-Cookie"].split(";")[0]

    def test_alice_own_order_allowed_bob_order_denied_and_audited(self):
        token = self.login()
        status, own_headers, own = self.request("GET", "/orders/ord-alice-001", token)
        self.assertEqual(status, 200)
        self.assertEqual(own["customer_id"], "alice")
        status, denied_headers, denied = self.request("GET", "/orders/ord-bob-001", token)
        self.assertEqual(status, 403)
        self.assertNotIn("address", denied)
        events = {e["request_id"]: e for e in self.store.list("audit")}
        allowed = events[own_headers["X-Request-Id"]]
        blocked = events[denied_headers["X-Request-Id"]]
        self.assertEqual((allowed["decision"], allowed["execution"]), ("allow", "succeeded"))
        self.assertEqual((blocked["actor_id"], blocked["decision"], blocked["execution"], blocked["reason"]), ("alice", "deny", "blocked", "ownership_mismatch"))

    def test_order_lists_and_carts_are_isolated(self):
        alice, bob = self.login(), self.login("bob")
        for token, owner in [(alice,"alice"),(bob,"bob")]:
            status, _, orders = self.request("GET", "/orders", token)
            self.assertEqual(status, 200)
            self.assertEqual([o["customer_id"] for o in orders], [owner])
        status, _, cart = self.request("PUT", "/cart/p01", alice, {"quantity": 2, "customer_id": "bob"})
        self.assertEqual(status, 200)
        self.assertEqual(cart["total"], 37800)
        self.assertEqual(self.request("GET", "/cart", bob)[2]["items"], [])
        self.assertEqual(self.request("PUT", "/cart/p01", alice, {"quantity": 0})[2]["items"], [])

    def test_identity_cannot_be_spoofed(self):
        alice = self.login()
        self.assertEqual(self.request("GET", "/orders/ord-bob-001?customer_id=bob", alice, {"customer_id":"bob"})[0], 403)
        self.assertEqual(self.request("GET", "/orders/ord-bob-001", "demomart_session=bob")[0], 401)
        self.assertEqual(self.request("GET", "/orders")[0], 401)

    def test_expiry_logout_and_rotation(self):
        old = self.login()
        status, headers, _ = self.request("POST", "/session", old, {"account":"bob","password":"bob-demo"})
        self.assertEqual(status, 200)
        self.assertEqual(self.request("GET", "/orders", old)[0], 401)
        token = headers["Set-Cookie"].split(";")[0]
        self.assertEqual(self.request("DELETE", "/session", token)[0], 200)
        self.assertEqual(self.request("GET", "/orders", token)[0], 401)
        token = self.login()
        key = self.service.digest(token.split("=",1)[1])
        session = self.store.get("sessions", key)
        session["expires"] = 0
        self.store.put("sessions",key,session)
        self.assertEqual(self.request("GET", "/orders", token)[0], 401)

    def test_validation_and_origin(self):
        alice = self.login()
        for quantity in [-1,100,True,"2",1.5,None]:
            self.assertEqual(self.request("PUT", "/cart/p01", alice, {"quantity":quantity})[0], 400)
        self.assertEqual(self.request("PUT", "/cart/p01", alice, {"quantity":1}, "https://evil.example")[0], 403)
        self.assertEqual(self.request("POST", "/session", body={"account":"alice","password":"wrong"})[0],401)
        self.assertEqual(self.request("GET", "/products/missing")[0],404)
        self.assertEqual(self.request("POST", "/checkout", alice)[0],400)

    def test_fictional_checkout_is_owned_and_audited(self):
        alice, bob = self.login(), self.login("bob")
        self.assertEqual(self.request("PUT", "/cart/p03", alice, {"quantity":2})[0], 200)
        status, headers, order = self.request("POST", "/checkout", alice, {})
        self.assertEqual(status, 201)
        self.assertEqual(order["customer_id"], "alice")
        self.assertEqual(order["total"], 7800)
        self.assertEqual(order["transaction"], "synthetic-no-payment")
        self.assertNotIn("payment", order)
        self.assertEqual(self.request("GET", "/cart", alice)[2]["items"], [])
        self.assertEqual(self.request("GET", "/orders/" + order["id"], alice)[0], 200)
        self.assertEqual(self.request("GET", "/orders/" + order["id"], bob)[0], 403)
        event = next(e for e in self.store.list("audit") if e["request_id"] == headers["X-Request-Id"])
        self.assertEqual((event["actor_id"], event["action"], event["decision"], event["execution"]), ("alice", "checkout.simulate", "allow", "succeeded"))

    def test_fictional_checkout_rejects_empty_cart_and_client_details(self):
        alice = self.login()
        status, headers, _ = self.request("POST", "/checkout", alice, {})
        self.assertEqual(status, 400)
        self.assertEqual(self.request("PUT", "/cart/p01", alice, {"quantity":1})[0], 200)
        status, _, _ = self.request("POST", "/checkout", alice, {"customer_id":"bob", "card":"fake"})
        self.assertEqual(status, 400)
        self.assertEqual(len(self.request("GET", "/orders", alice)[2]), 1)
        self.assertEqual(self.request("GET", "/cart", alice)[2]["total"], 18900)
        event = next(e for e in self.store.list("audit") if e["request_id"] == headers["X-Request-Id"])
        self.assertEqual((event["decision"], event["execution"]), ("allow", "failed"))

    def test_catalog_and_persistence(self):
        self.assertEqual(len(self.request("GET", "/products")[2]),18)
        self.assertEqual(len(self.request("GET", "/products?q=RECURVE&category=Recurve%20bows")[2]),2)
        self.assertEqual([p["id"] for p in self.request("GET", "/products?q=beginner")[2]], ["p11"])
        self.assertEqual({p["id"] for p in self.request("GET", "/products?q=hunting%20style")[2]}, {"p12", "p15"})
        self.assertEqual(self.request("GET", "/products/p11")[2]["draw_weight_lb"], {"min":10, "max":10})
        self.assertEqual(len(self.request("GET", "/products?category=Crossbows")[2]), 2)
        token = self.login()
        self.request("PUT", "/cart/p02", token, {"quantity":3})
        reopened = SQLiteStorage(self.store.path)
        self.assertEqual(reopened.list("cart")[0]["quantity"],3)

    def test_authorizer_fails_closed_and_cannot_override_ownership(self):
        class Broken:
            def authorize(self, *args):
                raise RuntimeError("policy unavailable")
        token = self.login()
        self.service.authorizer = Broken()
        self.assertEqual(self.request("GET", "/orders/ord-alice-001", token)[0],403)
        class AllowAll:
            def authorize(self, *args):
                return Decision(True,"policy_allow")
        self.service.authorizer = AllowAll()
        self.assertEqual(self.request("GET", "/orders/ord-bob-001", token)[0],403)

    def test_allowed_operation_failure_is_distinct(self):
        token = self.login()
        status, headers, _ = self.request("PUT", "/cart/p01", token, {"quantity":-1})
        self.assertEqual(status,400)
        event = next(e for e in self.store.list("audit") if e["request_id"] == headers["X-Request-Id"])
        self.assertEqual((event["decision"],event["execution"]),("allow","failed"))

    def test_unknown_order_does_not_reveal_existence(self):
        token=self.login()
        self.assertEqual(self.request("GET", "/orders/not-real",token)[0],403)


if __name__ == "__main__":
    unittest.main()
