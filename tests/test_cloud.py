import base64
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch
from backend.auth import CognitoAuthenticator, AuthenticationUnavailable
from backend.dynamo import DynamoStorage, DynamoAuditSink
from backend.lambda_handler import adapt, handler, cloud_service
from backend.service import StoreService
from backend.storage import SQLiteStorage
from seed.reset import seed


class CloudAdapterTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.storage = SQLiteStorage(Path(self.temp.name) / "test.sqlite3")
        seed(self.storage)
        self.cognito = Mock()
        self.cognito.initiate_auth.return_value = {"AuthenticationResult": {"AccessToken": "verified-by-cognito"}}
        self.cognito.get_user.return_value = {"UserAttributes": [{"Name": "sub", "Value": "subject-alice"}]}
        self.storage.put("identities", "subject-alice", {"customer_id": "alice"})
        self.auth = CognitoAuthenticator(self.cognito, "client-id", self.storage)
        self.service = StoreService(self.storage, self.storage, authenticator=self.auth)

    def tearDown(self):
        self.temp.cleanup()

    def request(self, method, path, body=None, cookie=None, origin="https://store.example", encoded=False):
        text = json.dumps(body) if body is not None else ""
        event = {"version": "2.0", "rawPath": "/api" + path, "headers": {"origin": origin}, "requestContext": {"http": {"method": method}}, "body": base64.b64encode(text.encode()).decode() if encoded else text, "isBase64Encoded": encoded}
        if cookie:
            event["cookies"] = [cookie]
        return adapt(event, self.service, "https://store.example")

    def test_cloud_login_uses_verified_subject_not_username(self):
        response = self.request("POST", "/session", {"account": "bob", "password": "private"}, encoded=True)
        self.assertEqual(response["statusCode"], 200)
        self.assertEqual(json.loads(response["body"])["id"], "alice")
        self.assertIn("; Secure", response["cookies"][0])
        self.assertIn("HttpOnly", response["cookies"][0])
        cookie = response["cookies"][0].split(";")[0]
        self.assertEqual(self.request("GET", "/orders/ord-alice-001", cookie=cookie)["statusCode"], 200)
        denied = self.request("GET", "/orders/ord-bob-001", cookie=cookie)
        self.assertEqual(denied["statusCode"], 403)
        self.assertNotIn("address", json.loads(denied["body"]))
        event = next(e for e in self.storage.list("audit") if e["request_id"] == denied["headers"]["X-Request-Id"])
        self.assertEqual((event["decision"], event["execution"]), ("deny", "blocked"))
        logout = self.request("DELETE", "/session", cookie=cookie)
        self.assertIn("Max-Age=0; Secure", logout["cookies"][0])
        self.assertEqual(self.request("GET", "/orders", cookie=cookie)["statusCode"], 401)

    def test_unknown_subject_and_challenges_cannot_login(self):
        self.cognito.get_user.return_value = {"UserAttributes": [{"Name": "sub", "Value": "unmapped"}]}
        self.assertEqual(self.request("POST", "/session", {"account":"alice","password":"private"})["statusCode"], 401)
        self.cognito.initiate_auth.return_value = {"ChallengeName":"NEW_PASSWORD_REQUIRED"}
        self.assertEqual(self.auth.authenticate("alice", "private"), None)
        self.assertEqual(self.storage.list("sessions"), [])

    def test_cognito_failure_does_not_fall_back_to_demo_password(self):
        self.cognito.initiate_auth.side_effect = RuntimeError("provider unavailable")
        response = self.request("POST", "/session", {"account":"alice","password":"alice-demo"})
        self.assertEqual(response["statusCode"], 503)
        self.assertNotIn("provider unavailable", response["body"])
        self.assertEqual(self.storage.list("sessions"), [])

    def test_cloud_rejects_local_origin(self):
        response = self.request("POST", "/session", {"account":"alice","password":"private"}, origin="http://localhost:5173")
        self.assertEqual(response["statusCode"], 403)
        self.cognito.initiate_auth.assert_not_called()

    def test_cloud_payload_limits_and_invalid_encoding(self):
        event = {"version":"2.0", "body":"!invalid!", "isBase64Encoded":True}
        self.assertEqual(adapt(event,self.service,"https://store.example")["statusCode"],400)
        event = {"version":"2.0", "body":"x"*17000}
        self.assertEqual(adapt(event,self.service,"https://store.example")["statusCode"],413)
        self.assertEqual(adapt({},self.service,"https://store.example")["statusCode"],400)

    def test_missing_cloud_configuration_fails_closed(self):
        with patch.dict("os.environ", {}, clear=True):
            self.assertEqual(handler({}, Mock(aws_request_id="test-request"))["statusCode"],503)


class DynamoTests(unittest.TestCase):
    def test_round_trip_numeric_values_and_session_ttl(self):
        table = Mock()
        storage = DynamoStorage(table)
        value = {"customer_id":"alice", "expires":12345, "rating":4.8}
        storage.put("sessions","hashed-token",value)
        item = table.put_item.call_args.kwargs["Item"]
        self.assertEqual(item["expires"],12345)
        table.get_item.return_value = {"Item":item}
        self.assertEqual(storage.get("sessions","hashed-token"),value)
        self.assertTrue(table.get_item.call_args.kwargs["ConsistentRead"])

    def test_cart_partition_and_paginated_owner_reads(self):
        table = Mock()
        storage = DynamoStorage(table)
        storage.put("cart","alice:p01",{"customer_id":"alice","quantity":2})
        self.assertEqual(table.put_item.call_args.kwargs["Item"]["pk"],"cart#alice")
        table.query.side_effect = [{"Items":[{"value":{"quantity":2}}],"LastEvaluatedKey":{"pk":"cart#alice","sk":"p01"}}, {"Items":[{"value":{"quantity":1}}]}]
        self.assertEqual(storage.list_owned("cart","alice"),[{"quantity":2},{"quantity":1}])
        self.assertEqual(table.query.call_count,2)
        self.assertEqual(table.query.call_args.kwargs["ExpressionAttributeValues"],{":pk":"cart#alice"})
        self.assertTrue(table.query.call_args.kwargs["ConsistentRead"])
        self.assertIn("ExclusiveStartKey",table.query.call_args.kwargs)
        table.scan.assert_not_called()

    def test_orders_use_owner_index_and_private_scans_are_disallowed(self):
        table = Mock()
        table.query.return_value = {"Items":[]}
        storage = DynamoStorage(table)
        storage.list_owned("orders","alice")
        self.assertEqual(table.query.call_args.kwargs["IndexName"],"by_owner")
        self.assertNotIn("ConsistentRead",table.query.call_args.kwargs)
        with self.assertRaises(ValueError):
            storage.list("orders")

    def test_audit_sink_keeps_schema_payload_separate_from_ttl(self):
        table = Mock()
        event={"request_id":"request", "event_id":"event", "decision":"deny", "execution":"blocked"}
        DynamoAuditSink(table).emit(event)
        item=table.put_item.call_args.kwargs["Item"]
        self.assertEqual(item["value"],event)
        self.assertIn("expires",item)
        self.assertNotIn("expires",item["value"])


if __name__ == "__main__":
    unittest.main()
